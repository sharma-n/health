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
        _active_plans_tool(),
        _goals_tool(),
        _personal_records_tool(),
        _exercise_progression_tool(),
        _adherence_stats_tool(),
        _muscle_volume_tool(),
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
            header_parts = [s["date"]]
            if s["workoutName"]:
                header_parts.append(s["workoutName"])
            if s["durationMinutes"] is not None:
                header_parts.append(f"{s['durationMinutes']}min")
            if s["overallEffort"] is not None:
                header_parts.append(f"RPE {s['overallEffort']}")
            lines.append("  - " + " | ".join(header_parts))
            for ex in s.get("exercises", []):
                set_parts = []
                for st in ex["sets"]:
                    if st["weightKg"] is not None and st["reps"] is not None:
                        set_parts.append(f"{st['weightKg']}kg×{st['reps']}")
                    elif st["reps"] is not None:
                        set_parts.append(f"{st['reps']} reps")
                sets_str = ", ".join(set_parts) if set_parts else "no sets logged"
                lines.append(f"      {ex['name']}: {sets_str}")
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
            lines.append(f"  Plan: {p['name']} ({p['startDate']} to {p['endDate']})")
            for day_idx, workout_info in sorted(p["schedule"].items(), key=lambda x: int(x[0])):
                lines.append(f"    {day_names[int(day_idx)]}: {workout_info['workoutName']}")
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
                f"  - [{g['status']}] {g['title']} ({g['type']}) — "
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
                f"  - {pr['exerciseName']}: {pr['prType']} = {pr['value']:.1f} {pr['unit']}"
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
