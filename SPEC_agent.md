# SPECv2 — AI Coach Feature

Builds on the health app (Milestones 1–9). Adds an AI coaching chatbot powered by [`agent_kit`](https://github.com/sharma-n/agent_kit.git) — a stateful, multi-turn Python agentic service. The agent converses about workout history and goals, and creates/edits exercises, workouts, and plans on behalf of the user.

---

## Architecture

### Deployment: Python Sidecar

```
Browser (React)
    │  SSE streaming  /  REST
    ▼
Next.js App (port 3000)
    ├── POST /api/agent/chat   ──────►  Python agent_kit service (port 8000)
    │     Proxies SSE stream            │  agent_kit run_turn()
    │     Injects X-User-Id             │  Tools call back ▼
    └── GET|POST /api/internal/*  ◄─────┘  HTTP + X-Internal-Secret + X-User-Id
          Prisma queries (existing DB)      (read + write health data)
```

**Why this pattern:**
- Python service never touches SQLite directly → no concurrent-write hazard
- All business logic (Zod validation, userId scoping, rate limiting) stays in Next.js
- Auth boundary: Next.js verifies NextAuth session, extracts `userId`, injects as trusted header
- Internal API routes protected by `INTERNAL_API_SECRET` shared between services

### Auth & Multi-User

agent_kit is multi-user by design — memory, sessions, and permissions are all scoped to `user_id` automatically. The only requirement is to identify the user and pass `user_id` into the pipeline correctly.

**Per-turn flow:**
1. User sends message in chat UI
2. Browser POSTs to `/api/agent/chat` (Next.js) with session cookie
3. Next.js calls `auth()` → extracts `userId`
4. Next.js proxies to `AGENT_SERVICE_URL/v1/turn` with `X-User-Id` + `X-Internal-Secret` headers and `conversation_id = f"health-{userId}"`
5. Python sidecar calls `agent.run_turn(user_id, conversation_id, message)` — agent_kit handles all isolation from here
6. Agent tools call `/api/internal/*` with the same two headers; Next.js routes scope queries to `userId`
7. SSE stream flows back: sidecar → Next.js proxy → browser

### Write Confirmation Pattern

Before calling any write tool the agent must:
1. Describe the proposed action in plain text
2. Ask the user to confirm ("Shall I go ahead?")
3. Only call the tool after the user explicitly agrees

This is enforced via the system prompt — no special UI required, though confirmation cards can be added as a UX enhancement.

### Tool Interface (verified against agent_kit source)

Tools are native Python `Tool` objects (not MCP) injected via `AgentService.build(cfg, extra_tools=[...])`. Handler signature:

```python
async def handler(user_id: str, args: dict[str, Any]) -> str: ...
```

`user_id` is injected by the registry at call time; all internal HTTP calls include `X-User-Id: user_id`.

### New Environment Variables

```env
AGENT_SERVICE_URL="http://localhost:8000"
INTERNAL_API_SECRET="replace-me-random-secret"
ANTHROPIC_API_KEY="sk-ant-..."
EMBED_BASE_URL="http://localhost:1234"        # LM Studio local embedding server
EMBED_MODEL="text-embedding-qwen3-embedding-0.6b"
```

---

## Repository Layout

```
health/
├── agent_service/               Python sidecar
│   ├── pyproject.toml           uv-managed; agent_kit git dep
│   ├── config.yaml              agent_kit config (LLM, memory, tools)
│   ├── src/health_agent/
│   │   ├── main.py              FastAPI entry point
│   │   ├── service.py           AgentService setup + system prompt
│   │   └── tools/
│   │       ├── client.py        shared httpx client for internal API
│   │       ├── read_tools.py    query tools (M11)
│   │       └── write_tools.py   mutation tools (M13)
│   └── tests/
│       ├── conftest.py
│       └── test_tools.py
├── src/
│   ├── app/
│   │   ├── (app)/chat/page.tsx  new /chat route
│   │   └── api/
│   │       ├── agent/route.ts   SSE proxy
│   │       └── internal/        internal data bridge (M11+)
│   │           ├── exercises/route.ts
│   │           ├── workouts/route.ts
│   │           ├── plans/route.ts
│   │           ├── sessions/route.ts
│   │           ├── goals/route.ts
│   │           ├── metrics/route.ts
│   │           └── analytics/{adherence,prs,progression,muscle-volume}/route.ts
│   └── components/chat/
│       ├── ChatWindow.tsx        "use client" SSE stream + message list
│       ├── ChatInput.tsx
│       ├── MessageBubble.tsx
│       └── ToolCallBadge.tsx
├── docker-compose.yml           add agent_service container
└── .env.example                 add 5 new vars
```

---

## Milestones

### M10 — AI Foundation

End-to-end streaming chat with no tools. Proves the architecture before building tools.

**Python sidecar (`agent_service/`):**
- `pyproject.toml`: `uv`-managed; `agent_kit = { git = "https://github.com/sharma-n/agent_kit.git" }`
- `config.yaml`: Anthropic LLM (`claude-haiku-4-5-20251001`), local LM Studio embedder, in-memory stores
- `service.py`: fitness coach system prompt; builds `AgentService` with `extra_tools=[]`
- `main.py`: FastAPI app with `POST /v1/turn` — validates `X-Internal-Secret`, calls `agent.run_turn()`, streams SSE events

**Next.js:**
- `src/app/api/agent/route.ts`: POST handler — calls `auth()`, asserts `userId`, proxies SSE stream to sidecar with injected headers
- `next.config.ts`: CSP unchanged (proxy is same-origin `'self'`)
- `.env.example`: add 5 new vars

**Chat UI:**
- `src/app/(app)/chat/page.tsx`: full page inside `(app)/` layout
- `ChatWindow.tsx` ("use client"): `fetch()` with `ReadableStream` to consume SSE, renders message history
- `ChatInput.tsx`: textarea, Enter to send, Shift+Enter for newline
- `ToolCallBadge.tsx`: inline indicator for tool calls (used from M11 onward)
- Conversation history in React state (server-side working memory persists across page refreshes)

**Bottom nav:**
- Replace "More" with "Chat" (MessageCircle icon) → `/chat`
- Move secondary items (Exercises, Workouts, Goals, Metrics, Profile) into a More page accessible from the Chat header or a link inside `/chat`

**Docker Compose:**
- Add `agent_service` container (Python image, `uv run`)
- Shares same Docker network as `web`; env vars forwarded

**Verification:** Start both services → open `/chat` → "Hello, what can you do?" → see streaming response.

---

### M11 — Query Tools (Read-Only)

Agent answers questions about the user's fitness data.

**Internal API routes (`src/app/api/internal/`):**

All routes: validate `X-Internal-Secret` first (401 otherwise), read `X-User-Id`, scope Prisma queries to `userId`.

| Route | Returns |
|---|---|
| `GET /api/internal/sessions?days=30` | Recent sessions (date, workout, duration, sets) |
| `GET /api/internal/exercises?q=&equipment=` | Matching exercises |
| `GET /api/internal/workouts` | User's workout templates |
| `GET /api/internal/plans?status=ACTIVE` | Plans with weekly schedule |
| `GET /api/internal/goals` | Goals with computed progress (reuses `computeGoalProgress`) |
| `GET /api/internal/analytics/adherence` | Calls `getAdherenceStats` |
| `GET /api/internal/analytics/prs` | Calls `getPersonalRecords` |
| `GET /api/internal/analytics/progression?exerciseId=` | Calls `getExerciseProgression` |
| `GET /api/internal/analytics/muscle-volume?weeks=8` | Calls `getMuscleVolumeByWeek` |

**Python tools (`read_tools.py`):** 8 tools, all using shared `httpx.AsyncClient`:
1. `get_workout_history(days)` 
2. `get_exercises(query, equipment)`
3. `get_active_plans()`
4. `get_goals_with_progress()`
5. `get_personal_records(exercise_name)`
6. `get_exercise_progression(exercise_name)`
7. `get_adherence_stats()`
8. `get_muscle_volume(weeks)`

Add all tool names to `config.yaml` `tools.default_allowed`.

**Verification:** "What's my longest streak?" / "Show me squat progress" / "What muscles am I neglecting?" — agent calls tools, weaves results into natural response.

---

### M12 — Coaching Intelligence

Agent gives proactive, synthesized coaching advice — not just data retrieval.

**No new routes.** Builds on M11 data with synthesis tools and enriched system prompt.

**System prompt enrichment:** add exercise science principles (progressive overload, periodization, muscle balance, recovery), proactive coaching persona.

**New Python tools:**
1. `analyze_training_balance()` — combines muscle volume + adherence; identifies over/under-trained groups
2. `assess_goal_trajectory(goal_id)` — fetches goal + progression; linear-projects whether user hits deadline
3. `suggest_next_workout(available_time_minutes, equipment)` — recommends what to train based on recovery and active plan
4. `get_training_summary(weeks)` — comprehensive 4-week summary for open-ended "how am I doing?" queries

**Verification:** "Am I overtraining any muscles?" / "Will I hit my bench goal by March?" / "What should I train tomorrow?" — agent synthesizes multiple data points.

---

### M13 — Write Tools (Create & Modify)

Agent creates workouts, plans, goals, and logs metrics — always with user confirmation.

**System prompt addition:**
> Before calling any create/update tool: (1) describe exactly what you will create in plain text, (2) ask the user to confirm, (3) only call the tool after explicit agreement. If the user corrects you, incorporate the change and confirm again.

**Internal mutation routes:**
- `POST /api/internal/workouts` — `{ name, description, exercises: [{exerciseId, targetSets, targetReps, targetWeightKg, restSeconds, order}] }`
- `POST /api/internal/plans` — `{ name, startDate, endDate, schedule: {[dayOfWeek]: workoutId} }`
- `POST /api/internal/goals` — `{ title, type, config, targetDate }`
- `POST /api/internal/metrics` — `{ type, value, date, note }`

Routes reuse existing Zod validation schemas from `src/lib/validation/`. They write via Prisma directly (not Server Actions, which expect `FormData`). Rate-limited per userId.

**Python write tools (`write_tools.py`):**
1. `create_workout(name, description, exercises)` — agent resolves exercise names → IDs via `get_exercises` first
2. `create_training_plan(name, start_date, end_date, weekly_schedule)` — maps day names → workout names
3. `create_goal(title, type, target_date, config)`
4. `log_body_metric(metric_type, value, date)`

**Verification:** "Create a PPL split starting next Monday for 8 weeks" → agent proposes plan in text → user confirms → plan visible in `/plans`.

---

### M14 — Memory & Personalization

Agent remembers user facts across conversations; dashboard shows AI-generated insights.

**agent_kit config changes:**
- Switch factual + session stores to `sqlite` backend (shared volume, separate from `app.db`)
- Configure Qdrant in `file` mode for episodic vectors (or in-memory if Qdrant not available)

**Factual memory:**
- Enable `remember_fact` / `forget_fact` / `list_facts` native tools in `default_allowed`
- System prompt: instruct agent to store injuries, equipment preferences, training schedule, stated motivations
- agent_kit's automatic post-turn fact extraction surfaces facts without explicit tool calls

**Episodic memory:**
- agent_kit embeds each conversation at end (idle sweep or disconnect)
- Relevant past conversations retrieved and injected into future turns automatically

**Dashboard AI insights widget:**
- New `AiInsightsCard` server component on `/dashboard`
- Calls `GET /api/internal/insights` → Python service returns 2–3 cached facts/insights for the user
- Not a live LLM call on page load — pulled from factual memory store

**Verification:** "I have a bad left knee, avoid lunges" → close chat → new conversation → "Design me a leg day" → agent avoids lunges without being reminded.

---

## Reused Utilities

| Function | File |
|---|---|
| `computeGoalProgress` | `src/lib/analytics/goals.ts` |
| `getAdherenceStats` | `src/lib/analytics/adherence.ts` |
| `getPersonalRecords` | `src/lib/analytics/prs.ts` |
| `getExerciseProgression` | `src/lib/analytics/progression.ts` |
| `getMuscleVolumeByWeek` | `src/lib/analytics/volume.ts` |
| `getMuscleRecentVolume` | `src/lib/analytics/muscle-recent.ts` |
| `getDashboardStats` | `src/lib/analytics/dashboard.ts` |

Internal API routes import and call these directly — they already accept `(userId, prisma)`.

Zod schemas from `src/lib/validation/` are reused for write route validation.

---

## Security Rules for Internal API Routes

Follow the same rules as server actions:
1. **Secret first** — check `X-Internal-Secret` before any query; 401 on failure
2. **userId from header** — never from query string or body
3. **Scope all queries** — `where: { userId, id }`, never `where: { id }` alone
4. **Explicit Prisma select** — only return fields the agent needs
5. **Rate-limit writes** — use `checkRateLimit` on all mutation routes (per userId)
6. **Generic errors** — "not found" and "forbidden" indistinguishable to caller
