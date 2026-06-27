"""M11 read-only query tools for the health agent."""
from __future__ import annotations

import json
from typing import Any

from llm_kit import ToolDefinition
from agent_kit.tools.base import Tool

from health_agent.tools.client import http_client


async def _get(user_id: str, path: str, params: dict[str, Any] | None = None) -> str:
    try:
        r = await http_client.get(
            path,
            params=params or {},
            headers={"X-User-Id": user_id},
        )
        if r.status_code != 200:
            return f"error {r.status_code}: {r.text[:200]}"
        return r.text
    except Exception as e:
        return f"error: {e}"


def get_read_tools() -> list[Tool]:
    return [
        _workout_history_tool(),
        _exercises_tool(),
        _workouts_tool(),
        _active_plans_tool(),
        _goals_tool(),
        _personal_records_tool(),
        _exercise_progression_tool(),
        _adherence_stats_tool(),
        _muscle_volume_tool(),
        _body_metrics_tool(),
        _plan_adherence_tool(),
    ]


def _workout_history_tool() -> Tool:
    async def handler(user_id: str, args: dict[str, Any]) -> str:
        days = int(args.get("days", 30))
        result = await _get(user_id, "/api/internal/sessions", {"days": days})
        try:
            data = json.loads(result)
        except Exception:
            return result
        if not data:
            return f"No completed sessions in the last {days} days."
        lines = [f"Recent sessions (last {days} days):"]
        for s in data[:20]:
            meta_parts = []
            if s["workoutName"]:
                meta_parts.append(s["workoutName"])
            if s["durationMinutes"] is not None:
                meta_parts.append(f"{s['durationMinutes']}min")
            if s["overallEffort"] is not None:
                meta_parts.append(f"RPE {s['overallEffort']}")
            meta_str = " | ".join(meta_parts)
            lines.append(f"  - Session on {s['date']} (session_id: {s['id']}){': ' + meta_str if meta_str else ''}")
            for ex in s.get("exercises", []):
                set_parts = []
                for st in ex["sets"]:
                    if st["weightKg"] is not None and st["reps"] is not None:
                        set_parts.append(f"{st['weightKg']}kg×{st['reps']}")
                    elif st["reps"] is not None:
                        set_parts.append(f"{st['reps']} reps")
                sets_str = ", ".join(set_parts) if set_parts else "no sets logged"
                lines.append(f"      {ex['name']} (exercise_id: {ex['id']}): {sets_str}")
            if s.get("notes"):
                lines.append(f"      Notes: {s['notes']}")
        return "\n".join(lines)

    return Tool(
        definition=ToolDefinition(
            name="get_workout_history",
            description="Fetch the user's recent completed workout sessions including date, workout name, duration, and set count.",
            parameters={
                "type": "object",
                "properties": {
                    "days": {
                        "type": "integer",
                        "description": "How many days back to fetch (default 30, max 365).",
                        "default": 30,
                    }
                },
                "required": [],
            },
        ),
        handler=handler,
    )


def _exercises_tool() -> Tool:
    async def handler(user_id: str, args: dict[str, Any]) -> str:
        query = str(args.get("query", ""))
        equipment = str(args.get("equipment", ""))
        params: dict[str, Any] = {}
        if query:
            params["q"] = query
        if equipment:
            params["equipment"] = equipment
        result = await _get(user_id, "/api/internal/exercises", params)
        try:
            data = json.loads(result)
        except Exception:
            return result
        if not data:
            return "No exercises found matching the criteria."
        lines = ["Exercises:"]
        for ex in data:
            muscles = ex["primaryMuscles"]
            if isinstance(muscles, str):
                muscles = json.loads(muscles)
            lines.append(
                f"  - {ex['name']} (id: {ex['id']}, equipment: {ex['equipment']}, muscles: {', '.join(muscles)})"
            )
        return "\n".join(lines)

    return Tool(
        definition=ToolDefinition(
            name="get_exercises",
            description="Search the exercise library for exercises by name and/or equipment type.",
            parameters={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Name to search for (partial match, e.g. 'squat', 'bench').",
                        "default": "",
                    },
                    "equipment": {
                        "type": "string",
                        "description": "Filter by equipment type (e.g. BARBELL, DUMBBELL, BODYWEIGHT).",
                        "default": "",
                    },
                },
                "required": [],
            },
        ),
        handler=handler,
    )


def _workouts_tool() -> Tool:
    async def handler(user_id: str, args: dict[str, Any]) -> str:
        result = await _get(user_id, "/api/internal/workouts")
        try:
            data = json.loads(result)
        except Exception:
            return result
        if not data:
            return "No workout templates saved yet."
        lines = ["Saved workout templates:"]
        for w in data:
            desc = f" — {w['description']}" if w.get("description") else ""
            lines.append(
                f"  - {w['name']} (id: {w['id']}, {w['exerciseCount']} exercises){desc}"
            )
        return "\n".join(lines)

    return Tool(
        definition=ToolDefinition(
            name="get_workouts",
            description="List all saved workout templates (name, id, exercise count). Use this before scheduling workouts in a plan or when the user asks what workouts they have.",
            parameters={"type": "object", "properties": {}, "required": []},
        ),
        handler=handler,
    )


def _active_plans_tool() -> Tool:
    async def handler(user_id: str, args: dict[str, Any]) -> str:
        result = await _get(user_id, "/api/internal/plans", {"status": "ACTIVE"})
        try:
            data = json.loads(result)
        except Exception:
            return result
        if not data:
            return "No active training plans."
        day_names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        lines = ["Active plans:"]
        for p in data:
            lines.append(f"  Plan: {p['name']} (plan_id: {p['id']}, {p['startDate']} to {p['endDate']})")
            for day_idx, workout_info in sorted(p["schedule"].items(), key=lambda x: int(x[0])):
                lines.append(f"    {day_names[int(day_idx)]}: {workout_info['workoutName']} (workout_id: {workout_info['workoutId']})")
        return "\n".join(lines)

    return Tool(
        definition=ToolDefinition(
            name="get_active_plans",
            description="Fetch the user's active training plan(s) with their weekly workout schedule.",
            parameters={"type": "object", "properties": {}, "required": []},
        ),
        handler=handler,
    )


def _goals_tool() -> Tool:
    async def handler(user_id: str, args: dict[str, Any]) -> str:
        result = await _get(user_id, "/api/internal/goals")
        try:
            data = json.loads(result)
        except Exception:
            return result
        if not data:
            return "No goals set."
        lines = ["Goals:"]
        for g in data:
            p = g["progress"]
            deadline = f" by {g['targetDate']}" if g["targetDate"] else ""
            lines.append(
                f"  - [{g['status']}] {g['title']} (goal_id: {g['id']}, {g['type']}) — "
                f"{p['percentage']:.0f}% ({p['current']} / {p['target']} {p['unit']}){deadline}"
            )
        return "\n".join(lines)

    return Tool(
        definition=ToolDefinition(
            name="get_goals_with_progress",
            description="Fetch all the user's goals with their current progress percentage.",
            parameters={"type": "object", "properties": {}, "required": []},
        ),
        handler=handler,
    )


def _personal_records_tool() -> Tool:
    async def handler(user_id: str, args: dict[str, Any]) -> str:
        exercise_name = str(args.get("exercise_name", "")).strip()
        result = await _get(user_id, "/api/internal/analytics/prs")
        try:
            data = json.loads(result)
        except Exception:
            return result
        if exercise_name:
            data = [pr for pr in data if exercise_name.lower() in pr["exerciseName"].lower()]
        if not data:
            return f"No personal records found{f' for {exercise_name}' if exercise_name else ''}."
        lines = ["Personal records:"]
        for pr in data:
            new_flag = " ★ NEW" if pr.get("isNew") else ""
            lines.append(
                f"  - {pr['exerciseName']} (exercise_id: {pr['exerciseId']}): "
                f"{pr['prType']} = {pr['value']:.1f} {pr['unit']}"
                f" (on {pr['achievedAt']}){new_flag}"
            )
        return "\n".join(lines)

    return Tool(
        definition=ToolDefinition(
            name="get_personal_records",
            description="Fetch the user's personal records (PRs). Optionally filter by exercise name.",
            parameters={
                "type": "object",
                "properties": {
                    "exercise_name": {
                        "type": "string",
                        "description": "Filter to PRs for a specific exercise (partial match, e.g. 'squat').",
                        "default": "",
                    }
                },
                "required": [],
            },
        ),
        handler=handler,
    )


def _exercise_progression_tool() -> Tool:
    async def handler(user_id: str, args: dict[str, Any]) -> str:
        exercise_name = str(args.get("exercise_name", "")).strip()
        if not exercise_name:
            return "error: exercise_name is required"

        # Resolve name → id
        ex_result = await _get(user_id, "/api/internal/exercises", {"q": exercise_name})
        try:
            exercises = json.loads(ex_result)
        except Exception:
            return ex_result
        if not exercises:
            return f"No exercise found matching '{exercise_name}'."
        exercise_id = exercises[0]["id"]
        resolved_name = exercises[0]["name"]

        result = await _get(
            user_id, "/api/internal/analytics/progression", {"exerciseId": exercise_id}
        )
        try:
            data = json.loads(result)
        except Exception:
            return result
        if not data:
            return f"No progression data for {resolved_name} yet."
        lines = [f"Progression for {resolved_name} (showing last {min(len(data), 10)} sessions):"]
        for pt in data[-10:]:
            parts = [pt["date"]]
            if pt.get("topWeightKg") is not None:
                parts.append(f"top weight {pt['topWeightKg']:.1f}kg")
            if pt.get("estimatedOneRM") is not None:
                parts.append(f"est. 1RM {pt['estimatedOneRM']:.1f}kg")
            parts.append(f"{pt['totalSets']} sets")
            lines.append("  " + " | ".join(parts))
        return "\n".join(lines)

    return Tool(
        definition=ToolDefinition(
            name="get_exercise_progression",
            description="Show session-by-session strength progression for a specific exercise.",
            parameters={
                "type": "object",
                "properties": {
                    "exercise_name": {
                        "type": "string",
                        "description": "Name of the exercise to show progression for (e.g. 'squat', 'bench press').",
                    }
                },
                "required": ["exercise_name"],
            },
        ),
        handler=handler,
    )


def _adherence_stats_tool() -> Tool:
    async def handler(user_id: str, args: dict[str, Any]) -> str:
        result = await _get(user_id, "/api/internal/analytics/adherence")
        try:
            d = json.loads(result)
            return (
                f"Training adherence:\n"
                f"  Current streak: {d['currentStreak']} days\n"
                f"  Longest streak: {d['longestStreak']} days\n"
                f"  This week: {d['sessionsThisWeek']} sessions\n"
                f"  Last week: {d['sessionsLastWeek']} sessions\n"
                f"  Total completed: {d['totalCompleted']} sessions"
            )
        except Exception:
            return result

    return Tool(
        definition=ToolDefinition(
            name="get_adherence_stats",
            description="Fetch training consistency stats: current/longest streaks, sessions this/last week, total sessions.",
            parameters={"type": "object", "properties": {}, "required": []},
        ),
        handler=handler,
    )


def _muscle_volume_tool() -> Tool:
    async def handler(user_id: str, args: dict[str, Any]) -> str:
        weeks = int(args.get("weeks", 8))
        result = await _get(user_id, "/api/internal/analytics/muscle-volume", {"weeks": weeks})
        try:
            d = json.loads(result)
        except Exception:
            return result
        week_data = d.get("weeks", [])
        muscle_groups = d.get("muscleGroups", [])
        if not week_data or not muscle_groups:
            return "No muscle volume data available yet."
        totals: dict[str, float] = {}
        for week in week_data:
            for mg in muscle_groups:
                totals[mg] = totals.get(mg, 0) + (week.get(mg) or 0)
        sorted_muscles = sorted(totals.items(), key=lambda x: x[1], reverse=True)
        lines = [f"Muscle volume over last {weeks} weeks (total sets per muscle group):"]
        for mg, vol in sorted_muscles:
            bar = "█" * min(20, int(vol / 2)) if vol > 0 else "—"
            lines.append(f"  {mg:<20} {vol:>5.0f}  {bar}")
        return "\n".join(lines)

    return Tool(
        definition=ToolDefinition(
            name="get_muscle_volume",
            description="Show total training volume (sets) per muscle group over recent weeks to identify over/under-trained muscles.",
            parameters={
                "type": "object",
                "properties": {
                    "weeks": {
                        "type": "integer",
                        "description": "Number of weeks to include (default 8, max 52).",
                        "default": 8,
                    }
                },
                "required": [],
            },
        ),
        handler=handler,
    )


def _plan_adherence_tool() -> Tool:
    async def handler(user_id: str, args: dict[str, Any]) -> str:
        plan_name = str(args.get("plan_name", "")).strip()

        # Fetch all active (and completed) plans to resolve name → ID
        all_plans: list[dict] = []
        for status in ("ACTIVE", "COMPLETED"):
            raw = await _get(user_id, "/api/internal/plans", {"status": status})
            try:
                all_plans.extend(json.loads(raw))
            except Exception:
                pass

        if not all_plans:
            return "No active or completed plans found."

        plan_id: str | None = None
        resolved_plan_name: str = ""
        if plan_name:
            plan_name_lower = plan_name.lower()
            match = next((p for p in all_plans if p.get("name", "").lower() == plan_name_lower), None)
            if match is None:
                names = ", ".join(f"'{p['name']}'" for p in all_plans)
                return f"Plan '{plan_name}' not found. Available plans: {names}."
            plan_id = match["id"]
            resolved_plan_name = match["name"]
        else:
            # Default to first active plan
            plan_id = all_plans[0]["id"]
            resolved_plan_name = all_plans[0]["name"]

        result = await _get(
            user_id, "/api/internal/analytics/plan-adherence", {"planId": plan_id}
        )
        try:
            d = json.loads(result)
        except Exception:
            return result

        overall = d.get("overall", {})
        adherence_pct = overall.get("adherencePct")
        adherence_str = f"{adherence_pct}%" if adherence_pct is not None else "N/A (no past occurrences yet)"

        lines = [
            f"Plan adherence for '{resolved_plan_name}':",
            f"  Completed: {overall.get('completed', 0)} sessions",
            f"  Missed:    {overall.get('missed', 0)} sessions",
            f"  Upcoming:  {overall.get('upcoming', 0)} sessions",
            f"  Adherence: {adherence_str}",
        ]

        day_names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        this_week = d.get("thisWeek", [])
        if this_week:
            lines.append("  This week:")
            for occ in this_week:
                dow = day_names[occ["dayOfWeek"]]
                status = occ["status"]
                badge = {
                    "completed": "✓ Done",
                    "completed_late": "✓ Done (late)",
                    "completed_early": "✓ Done (early)",
                    "missed": "✗ Missed",
                    "upcoming": "Scheduled",
                }.get(status, status)
                lines.append(f"    {dow} ({occ['occurrenceDate']}): {occ['workoutName']} — {badge}")

        return "\n".join(lines)

    return Tool(
        definition=ToolDefinition(
            name="get_plan_adherence",
            description=(
                "Fetch detailed adherence stats for a training plan: how many sessions were completed, "
                "missed, or are upcoming; the overall adherence percentage; and this week's day-by-day status. "
                "Use this when the user asks how they are doing on a plan, what they missed, "
                "or when giving adherence-based coaching feedback."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "plan_name": {
                        "type": "string",
                        "description": (
                            "Name of the plan to check (e.g. 'PPL Strength Program'). "
                            "If omitted, defaults to the first active/completed plan."
                        ),
                        "default": "",
                    }
                },
                "required": [],
            },
        ),
        handler=handler,
    )


def _body_metrics_tool() -> Tool:
    async def handler(user_id: str, args: dict[str, Any]) -> str:
        metric_type = str(args.get("metric_type", "")).strip()
        days = int(args.get("days", 90))
        params: dict[str, Any] = {"days": days}
        if metric_type:
            params["type"] = metric_type
        result = await _get(user_id, "/api/internal/metrics", params)
        try:
            data = json.loads(result)
        except Exception:
            return result
        if not data:
            filter_str = f" for {metric_type}" if metric_type else ""
            return f"No body metrics logged{filter_str} in the last {days} days."
        lines = [f"Body metrics (last {days} days):"]
        by_type: dict[str, list] = {}
        for m in data:
            by_type.setdefault(m["type"], []).append(m)
        for mtype, entries in by_type.items():
            lines.append(f"  {mtype}:")
            for e in entries[:10]:
                note_str = f" — {e['note']}" if e.get("note") else ""
                lines.append(f"    {e['date']}: {e['value']}{note_str}")
        return "\n".join(lines)

    return Tool(
        definition=ToolDefinition(
            name="get_body_metrics",
            description=(
                "Fetch the user's logged body measurements over time "
                "(bodyweight, waist, body fat %, etc.). "
                "Use this to answer questions about weight trends, measurement history, "
                "or progress toward body-composition goals."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "metric_type": {
                        "type": "string",
                        "description": (
                            "Filter to one measurement type. Valid values: "
                            "BODYWEIGHT, WAIST, HIPS, CHEST, ARM_LEFT, ARM_RIGHT, "
                            "THIGH_LEFT, THIGH_RIGHT, CALF, NECK, BODY_FAT_PCT. "
                            "Omit to return all types."
                        ),
                        "default": "",
                    },
                    "days": {
                        "type": "integer",
                        "description": "How many days back to fetch (default 90, max 365).",
                        "default": 90,
                    },
                },
                "required": [],
            },
        ),
        handler=handler,
    )
