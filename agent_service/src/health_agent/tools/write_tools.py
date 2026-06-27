"""M13 write tools — agent creates workouts, plans, goals, and logs metrics."""
from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from llm_kit import ToolDefinition
from agent_kit.tools.base import Tool

from health_agent.tools.client import http_client, NEXTJS_BASE_URL
from health_agent.context import user_timezone


def _today_str() -> str:
    """Return today's date as YYYY-MM-DD in the user's timezone."""
    tz_name = user_timezone.get()
    try:
        tz = ZoneInfo(tz_name)
    except (ZoneInfoNotFoundError, Exception):
        from datetime import timezone as _tz
        tz = _tz.utc
    return datetime.now(tz).date().isoformat()

_DAY_NAME_TO_INT: dict[str, int] = {
    "sunday": 0,
    "monday": 1,
    "tuesday": 2,
    "wednesday": 3,
    "thursday": 4,
    "friday": 5,
    "saturday": 6,
}


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


async def _post(user_id: str, path: str, payload: dict[str, Any]) -> tuple[int, str]:
    try:
        r = await http_client.post(
            path,
            json=payload,
            headers={"X-User-Id": user_id},
        )
        return r.status_code, r.text
    except Exception as e:
        return 0, f"error: {e}"


async def _patch(user_id: str, path: str, payload: dict[str, Any]) -> tuple[int, str]:
    try:
        r = await http_client.patch(
            path,
            json=payload,
            headers={"X-User-Id": user_id},
        )
        return r.status_code, r.text
    except Exception as e:
        return 0, f"error: {e}"


async def _resolve_exercise_id(user_id: str, name: str) -> str | None:
    """Return the first matching exerciseId for a given name, or None."""
    result = await _get(user_id, "/api/internal/exercises", {"q": name})
    try:
        data = json.loads(result)
        return data[0]["id"] if data else None
    except Exception:
        return None


async def _resolve_workout_id(user_id: str, name: str, workouts: list[dict]) -> str | None:
    """Case-insensitive lookup of workout name in a pre-fetched list."""
    name_lower = name.lower()
    for w in workouts:
        if w["name"].lower() == name_lower:
            return w["id"]
    return None


def get_write_tools() -> list[Tool]:
    return [
        _create_workout_tool(),
        _create_training_plan_tool(),
        _create_goal_tool(),
        _log_body_metric_tool(),
        _update_goal_tool(),
        _create_exercise_tool(),
        _log_session_tool(),
        _start_session_tool(),
    ]


def _create_workout_tool() -> Tool:
    async def handler(user_id: str, args: dict[str, Any]) -> str:
        name = str(args.get("name", "")).strip()
        if not name:
            return "error: name is required"

        description = str(args.get("description", "")).strip() or None
        exercises_raw: list[dict] = args.get("exercises", [])

        # Resolve exercise names → IDs
        resolved: list[dict] = []
        unresolved: list[str] = []
        for ex in exercises_raw:
            ex_name = str(ex.get("exercise_name", "")).strip()
            if not ex_name:
                continue
            ex_id = await _resolve_exercise_id(user_id, ex_name)
            if ex_id is None:
                unresolved.append(ex_name)
            else:
                resolved.append({
                    "exerciseId": ex_id,
                    "targetSets": ex.get("target_sets"),
                    "targetReps": ex.get("target_reps"),
                    "targetWeightKg": ex.get("target_weight_kg"),
                    "restSeconds": ex.get("rest_seconds"),
                    "notes": ex.get("notes"),
                })

        if unresolved:
            return f"error: could not find exercises: {', '.join(unresolved)}. Use get_exercises to search."

        payload: dict[str, Any] = {"name": name, "exercises": resolved}
        if description:
            payload["description"] = description

        status, text = await _post(user_id, "/api/internal/workouts", payload)
        if status not in (200, 201):
            return f"error {status}: {text[:200]}"

        try:
            result = json.loads(text)
            return f"Created workout '{name}' (id: {result['id']}) with {len(resolved)} exercises."
        except Exception:
            return f"Created workout '{name}'."

    return Tool(
        definition=ToolDefinition(
            name="create_workout",
            description=(
                "Create a new saved workout template with a list of exercises. "
                "Each exercise entry should include exercise_name (required), and optionally "
                "target_sets, target_reps, target_weight_kg (in kg), rest_seconds, notes. "
                "Always describe the workout and ask for confirmation before calling this tool."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Name of the workout (e.g. 'Push Day', 'Upper Body A').",
                    },
                    "description": {
                        "type": "string",
                        "description": "Optional description of the workout.",
                        "default": "",
                    },
                    "exercises": {
                        "type": "array",
                        "description": "Ordered list of exercises to include.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "exercise_name": {"type": "string", "description": "Name of the exercise (used to look up the ID)."},
                                "target_sets": {"type": "integer", "description": "Target number of sets."},
                                "target_reps": {"type": "integer", "description": "Target reps per set."},
                                "target_weight_kg": {"type": "number", "description": "Target weight in kg."},
                                "rest_seconds": {"type": "integer", "description": "Rest between sets in seconds."},
                                "notes": {"type": "string", "description": "Exercise-specific coaching notes."},
                            },
                            "required": ["exercise_name"],
                        },
                        "default": [],
                    },
                },
                "required": ["name"],
            },
        ),
        handler=handler,
    )


def _create_training_plan_tool() -> Tool:
    async def handler(user_id: str, args: dict[str, Any]) -> str:
        name = str(args.get("name", "")).strip()
        start_date = str(args.get("start_date", "")).strip()
        end_date = str(args.get("end_date", "")).strip()
        weekly_schedule: dict[str, str] = args.get("weekly_schedule", {})

        if not name:
            return "error: name is required"
        if not start_date or not end_date:
            return "error: start_date and end_date are required (YYYY-MM-DD)"
        if not weekly_schedule:
            return "error: weekly_schedule must have at least one day"

        # Fetch all user workouts for name resolution
        workouts_result = await _get(user_id, "/api/internal/workouts")
        try:
            workouts: list[dict] = json.loads(workouts_result)
        except Exception:
            return f"error fetching workouts: {workouts_result}"

        # Build schedule array, resolving day names and workout names
        schedule: list[dict] = []
        unresolved_days: list[str] = []
        unresolved_workouts: list[str] = []

        for day_name, workout_name in weekly_schedule.items():
            day_int = _DAY_NAME_TO_INT.get(day_name.lower())
            if day_int is None:
                unresolved_days.append(day_name)
                continue
            workout_id = await _resolve_workout_id(user_id, workout_name, workouts)
            if workout_id is None:
                unresolved_workouts.append(workout_name)
                continue
            schedule.append({"dayOfWeek": day_int, "workoutId": workout_id})

        if unresolved_days:
            return f"error: unknown day names: {', '.join(unresolved_days)}. Use: monday, tuesday, wednesday, thursday, friday, saturday, sunday."
        if unresolved_workouts:
            return f"error: workout templates not found: {', '.join(unresolved_workouts)}. Use get_workouts to list saved workouts."

        payload = {
            "name": name,
            "startDate": start_date,
            "endDate": end_date,
            "schedule": schedule,
        }
        if args.get("description"):
            payload["description"] = str(args["description"]).strip()

        status, text = await _post(user_id, "/api/internal/plans", payload)
        if status not in (200, 201):
            return f"error {status}: {text[:200]}"

        try:
            result = json.loads(text)
            return f"Created plan '{name}' (id: {result['id']}) from {start_date} to {end_date} with {len(schedule)} scheduled days."
        except Exception:
            return f"Created plan '{name}'."

    return Tool(
        definition=ToolDefinition(
            name="create_training_plan",
            description=(
                "Create a new training plan with a weekly workout schedule. "
                "Resolves workout names to IDs automatically using get_workouts. "
                "Always use get_workouts first to confirm workout names exist before calling this tool. "
                "Always describe the plan and ask for confirmation before calling."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Plan name (e.g. 'PPL 8-Week')."},
                    "start_date": {"type": "string", "description": "Start date in YYYY-MM-DD format."},
                    "end_date": {"type": "string", "description": "End date in YYYY-MM-DD format."},
                    "description": {"type": "string", "description": "Optional plan description.", "default": ""},
                    "weekly_schedule": {
                        "type": "object",
                        "description": (
                            "Map of day name to workout name, e.g. "
                            '{\"monday\": \"Push Day\", \"wednesday\": \"Pull Day\", \"friday\": \"Legs\"}. '
                            "Day names: monday, tuesday, wednesday, thursday, friday, saturday, sunday."
                        ),
                    },
                },
                "required": ["name", "start_date", "end_date", "weekly_schedule"],
            },
        ),
        handler=handler,
    )


def _create_goal_tool() -> Tool:
    async def handler(user_id: str, args: dict[str, Any]) -> str:
        title = str(args.get("title", "")).strip()
        goal_type = str(args.get("type", "")).strip().upper()
        target_date = args.get("target_date")
        config_raw: dict = args.get("config", {})

        if not title:
            return "error: title is required"
        if goal_type not in ("STRENGTH", "BODY_METRIC", "CONSISTENCY"):
            return "error: type must be STRENGTH, BODY_METRIC, or CONSISTENCY"

        # Transform config keys and resolve exerciseId for STRENGTH goals
        config: dict[str, Any] = {}
        if goal_type == "STRENGTH":
            exercise_name = str(config_raw.get("exercise_name", "")).strip()
            if not exercise_name:
                return "error: STRENGTH goals require config.exercise_name"
            exercise_id = await _resolve_exercise_id(user_id, exercise_name)
            if exercise_id is None:
                return f"error: exercise '{exercise_name}' not found. Use get_exercises to search."
            config = {
                "exerciseId": exercise_id,
                "metric": config_raw.get("metric", "1RM"),
                "targetValueKg": config_raw.get("target_value_kg"),
            }
            if config_raw.get("reps") is not None:
                config["reps"] = config_raw["reps"]
            if config_raw.get("starting_value_kg") is not None:
                config["startingValueKg"] = config_raw["starting_value_kg"]

        elif goal_type == "BODY_METRIC":
            config = {
                "metricType": config_raw.get("metric_type"),
                "startingValue": config_raw.get("starting_value"),
                "targetValue": config_raw.get("target_value"),
            }

        elif goal_type == "CONSISTENCY":
            config = {"workoutsPerWeek": config_raw.get("workouts_per_week")}
            if config_raw.get("window_start"):
                config["windowStart"] = config_raw["window_start"]
            if config_raw.get("window_end"):
                config["windowEnd"] = config_raw["window_end"]

        payload: dict[str, Any] = {
            "title": title,
            "type": goal_type,
            "config": config,
        }
        if target_date:
            payload["targetDate"] = str(target_date)

        status, text = await _post(user_id, "/api/internal/goals", payload)
        if status not in (200, 201):
            return f"error {status}: {text[:200]}"

        try:
            result = json.loads(text)
            return f"Created goal '{title}' (id: {result['id']})."
        except Exception:
            return f"Created goal '{title}'."

    return Tool(
        definition=ToolDefinition(
            name="create_goal",
            description=(
                "Create a new fitness goal. Three goal types:\n"
                "- STRENGTH: track progress toward a weight/rep target. "
                "config: {exercise_name, metric ('1RM' or 'weightForReps'), target_value_kg, reps? (for weightForReps), starting_value_kg?}\n"
                "- BODY_METRIC: track a body measurement toward a target. "
                "config: {metric_type (BODYWEIGHT|WAIST|HIPS|CHEST|ARM_LEFT|ARM_RIGHT|THIGH_LEFT|THIGH_RIGHT|CALF|NECK|BODY_FAT_PCT), starting_value, target_value} (values in kg/cm/%)\n"
                "- CONSISTENCY: track session frequency. "
                "config: {workouts_per_week, window_start? (YYYY-MM-DD), window_end? (YYYY-MM-DD)}\n"
                "Always describe the goal and ask for confirmation before calling."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Goal title (e.g. 'Bench 100 kg by year end')."},
                    "type": {"type": "string", "description": "Goal type: STRENGTH, BODY_METRIC, or CONSISTENCY."},
                    "target_date": {"type": "string", "description": "Optional deadline in YYYY-MM-DD format.", "default": ""},
                    "config": {
                        "type": "object",
                        "description": "Type-specific config object. See tool description for required fields per type.",
                    },
                },
                "required": ["title", "type", "config"],
            },
        ),
        handler=handler,
    )


def _log_body_metric_tool() -> Tool:
    async def handler(user_id: str, args: dict[str, Any]) -> str:
        metric_type = str(args.get("metric_type", "")).strip().upper()
        value = args.get("value")
        log_date = str(args.get("date", _today_str())).strip()
        note = str(args.get("note", "")).strip() or None

        if not metric_type:
            return "error: metric_type is required"
        if value is None:
            return "error: value is required"

        payload: dict[str, Any] = {
            "type": metric_type,
            "value": float(value),
            "date": log_date,
        }
        if note:
            payload["note"] = note

        status, text = await _post(user_id, "/api/internal/metrics", payload)
        if status not in (200, 201):
            return f"error {status}: {text[:200]}"

        return f"Logged {metric_type} = {value} on {log_date}."

    return Tool(
        definition=ToolDefinition(
            name="log_body_metric",
            description=(
                "Log a body measurement for the user. "
                "Canonical units: kg for BODYWEIGHT, cm for all length measurements "
                "(WAIST, HIPS, CHEST, ARM_LEFT, ARM_RIGHT, THIGH_LEFT, THIGH_RIGHT, CALF, NECK), "
                "% for BODY_FAT_PCT. "
                "Always describe what will be logged and ask for confirmation before calling."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "metric_type": {
                        "type": "string",
                        "description": "Measurement type: BODYWEIGHT, WAIST, HIPS, CHEST, ARM_LEFT, ARM_RIGHT, THIGH_LEFT, THIGH_RIGHT, CALF, NECK, or BODY_FAT_PCT.",
                    },
                    "value": {
                        "type": "number",
                        "description": "Measurement value in canonical units (kg / cm / %).",
                    },
                    "date": {
                        "type": "string",
                        "description": "Date in YYYY-MM-DD format (defaults to today).",
                        "default": "",
                    },
                    "note": {
                        "type": "string",
                        "description": "Optional note about the measurement.",
                        "default": "",
                    },
                },
                "required": ["metric_type", "value"],
            },
        ),
        handler=handler,
    )


def _create_exercise_tool() -> Tool:
    async def handler(user_id: str, args: dict[str, Any]) -> str:
        name = str(args.get("name", "")).strip()
        equipment = str(args.get("equipment", "")).strip()
        primary_muscles: list[str] = args.get("primary_muscles", [])

        if not name:
            return "error: name is required"
        if not equipment:
            return "error: equipment is required"
        if not primary_muscles:
            return "error: primary_muscles must have at least one entry"

        payload: dict[str, Any] = {
            "name": name,
            "equipment": equipment,
            "primaryMuscles": primary_muscles,
            "secondaryMuscles": args.get("secondary_muscles", []),
        }
        if args.get("description"):
            payload["description"] = str(args["description"]).strip()
        if args.get("instructions"):
            payload["instructions"] = str(args["instructions"]).strip()
        if args.get("common_pitfalls"):
            payload["commonPitfalls"] = str(args["common_pitfalls"]).strip()

        status, text = await _post(user_id, "/api/internal/exercises", payload)
        if status not in (200, 201):
            return f"error {status}: {text[:200]}"

        try:
            result = json.loads(text)
            return f"Created exercise '{name}' (id: {result['id']})."
        except Exception:
            return f"Created exercise '{name}'."

    return Tool(
        definition=ToolDefinition(
            name="create_exercise",
            description=(
                "Add a new custom exercise to the user's exercise library. "
                "Only call this tool when the user explicitly asks to create a new exercise by name. "
                "Do not call it as a side-effect of creating a workout — if an exercise is missing, "
                "use get_exercises to find an existing substitute that targets the same primary muscles instead. "
                "Always describe what will be created and ask for confirmation before calling."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Exercise name (e.g. 'Banded Pull-Apart').",
                    },
                    "equipment": {
                        "type": "string",
                        "description": "Equipment type: BARBELL, DUMBBELL, MACHINE, CABLE, KETTLEBELL, BODYWEIGHT, BAND, or OTHER.",
                    },
                    "primary_muscles": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": (
                            "Primary muscles targeted. At least one required. "
                            "Valid values: CHEST, BACK, SHOULDERS, BICEPS, TRICEPS, FOREARMS, "
                            "QUADS, HAMSTRINGS, GLUTES, CALVES, ABS, OBLIQUES, TRAPS, LATS, NECK, FULL_BODY."
                        ),
                    },
                    "secondary_muscles": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Secondary muscles targeted (same valid values as primary_muscles).",
                        "default": [],
                    },
                    "description": {
                        "type": "string",
                        "description": "Short description of the exercise.",
                        "default": "",
                    },
                    "instructions": {
                        "type": "string",
                        "description": "Step-by-step instructions for performing the exercise.",
                        "default": "",
                    },
                    "common_pitfalls": {
                        "type": "string",
                        "description": "Common mistakes to avoid when performing the exercise.",
                        "default": "",
                    },
                },
                "required": ["name", "equipment", "primary_muscles"],
            },
        ),
        handler=handler,
    )


def _log_session_tool() -> Tool:
    async def handler(user_id: str, args: dict[str, Any]) -> str:
        exercises_raw: list[dict] = args.get("exercises", [])
        if not exercises_raw:
            return "error: exercises is required and must have at least one entry"

        log_date = str(args.get("date") or _today_str()).strip()
        notes = str(args.get("notes") or "").strip() or None
        overall_effort = args.get("overall_effort")
        base_workout_name = str(args.get("base_workout_name") or "").strip() or None
        workout_id_for_post: str | None = None

        if base_workout_name:
            workouts_raw = await _get(user_id, "/api/internal/workouts")
            try:
                workouts: list[dict] = json.loads(workouts_raw)
            except Exception:
                return f"error fetching workouts: {workouts_raw}"
            workout_id_for_post = await _resolve_workout_id(user_id, base_workout_name, workouts)
            if workout_id_for_post is None:
                return f"error: workout '{base_workout_name}' not found. Use get_workouts to list saved workouts."

        resolved: list[dict] = []
        unresolved: list[str] = []
        for ex in exercises_raw:
            ex_name = str(ex.get("exercise_name", "")).strip()
            if not ex_name:
                continue
            ex_id = await _resolve_exercise_id(user_id, ex_name)
            if ex_id is None:
                unresolved.append(ex_name)
            else:
                sets = [
                    {k: v for k, v in {
                        "weightKg": s.get("weight_kg"),
                        "reps": s.get("reps"),
                        "restSeconds": s.get("rest_seconds"),
                    }.items() if v is not None}
                    for s in ex.get("sets", [])
                ]
                resolved.append({"exerciseId": ex_id, "sets": sets})

        if unresolved:
            return f"error: could not find exercises: {', '.join(unresolved)}. Use get_exercises to search."

        payload: dict[str, Any] = {"date": log_date, "exercises": resolved}
        if notes:
            payload["notes"] = notes
        if overall_effort is not None:
            payload["overallEffort"] = int(overall_effort)
        if workout_id_for_post:
            payload["workoutId"] = workout_id_for_post

        status, text = await _post(user_id, "/api/internal/sessions", payload)
        if status not in (200, 201):
            return f"error {status}: {text[:200]}"

        try:
            result = json.loads(text)
            template_note = f" (based on '{base_workout_name}')" if base_workout_name else ""
            return f"Logged session on {log_date}{template_note} (id: {result['id']}) with {len(resolved)} exercise(s)."
        except Exception:
            return f"Logged session on {log_date}."

    return Tool(
        definition=ToolDefinition(
            name="log_session",
            description=(
                "Log a completed historical workout session with exercises and sets. "
                "Use when the user is reporting a past workout (e.g. 'log yesterday's push day'). "
                "If base_workout_name is provided, the session is linked to that template in the DB. "
                "Always describe the date, exercises, and sets; ask for confirmation before calling. "
                "Dates must be YYYY-MM-DD in the user's local timezone (already in your system prompt)."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "exercises": {
                        "type": "array",
                        "description": "Exercises performed, in order. At least one required.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "exercise_name": {"type": "string", "description": "Exercise name (used to look up ID)."},
                                "sets": {
                                    "type": "array",
                                    "description": "Sets performed. At least one required.",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "weight_kg": {"type": "number", "description": "Weight in kg."},
                                            "reps": {"type": "integer", "description": "Reps performed."},
                                            "rest_seconds": {"type": "integer", "description": "Rest after this set in seconds."},
                                        },
                                    },
                                },
                            },
                            "required": ["exercise_name", "sets"],
                        },
                    },
                    "date": {
                        "type": "string",
                        "description": "Session date in YYYY-MM-DD (user's local timezone). Defaults to today.",
                        "default": "",
                    },
                    "notes": {
                        "type": "string",
                        "description": "Optional session notes.",
                        "default": "",
                    },
                    "overall_effort": {
                        "type": "integer",
                        "description": "Session RPE 1-10.",
                    },
                    "base_workout_name": {
                        "type": "string",
                        "description": "If the session was based on a saved workout template, provide its name here to link the session to that template.",
                        "default": "",
                    },
                },
                "required": ["exercises"],
            },
        ),
        handler=handler,
    )


def _start_session_tool() -> Tool:
    async def handler(user_id: str, args: dict[str, Any]) -> str:
        exercise_names: list[str] = args.get("exercises", [])
        if not exercise_names:
            return "error: exercises is required and must have at least one entry"

        workout_name = str(args.get("workout_name") or "").strip() or None
        plan_name = str(args.get("plan_name") or "").strip() or None
        workout_id_for_post: str | None = None
        plan_id_for_post: str | None = None
        scheduled_date = str(args.get("scheduled_date") or "").strip() or None

        if workout_name:
            workouts_raw = await _get(user_id, "/api/internal/workouts")
            try:
                workouts: list[dict] = json.loads(workouts_raw)
            except Exception:
                return f"error fetching workouts: {workouts_raw}"
            workout_id_for_post = await _resolve_workout_id(user_id, workout_name, workouts)
            if workout_id_for_post is None:
                return f"error: workout '{workout_name}' not found. Use get_workouts to list saved workouts."

        if plan_name:
            plans_raw = await _get(user_id, "/api/internal/plans", {"status": "ACTIVE"})
            try:
                plans: list[dict] = json.loads(plans_raw)
            except Exception:
                return f"error fetching plans: {plans_raw}"
            plan_name_lower = plan_name.lower()
            matched_plan = next((p for p in plans if p.get("name", "").lower() == plan_name_lower), None)
            if matched_plan is None:
                return f"error: active plan '{plan_name}' not found. Use get_active_plans to list plans."
            plan_id_for_post = matched_plan["id"]

        if scheduled_date:
            try:
                date.fromisoformat(scheduled_date)
            except ValueError:
                return f"error: scheduled_date '{scheduled_date}' is not a valid YYYY-MM-DD date."

        resolved_ids: list[str] = []
        unresolved: list[str] = []
        for name in exercise_names:
            name = str(name).strip()
            if not name:
                continue
            ex_id = await _resolve_exercise_id(user_id, name)
            if ex_id is None:
                unresolved.append(name)
            else:
                resolved_ids.append(ex_id)

        if unresolved:
            return f"error: could not find exercises: {', '.join(unresolved)}. Use get_exercises to search."

        payload: dict[str, Any] = {"exerciseIds": resolved_ids}
        if workout_id_for_post:
            payload["workoutId"] = workout_id_for_post
        if plan_id_for_post:
            payload["planId"] = plan_id_for_post
        if scheduled_date:
            payload["scheduledDate"] = scheduled_date + "T00:00:00Z"

        status, text = await _post(user_id, "/api/internal/sessions/start", payload)
        if status not in (200, 201):
            return f"error {status}: {text[:200]}"

        try:
            result = json.loads(text)
            session_url = result.get("sessionUrl", "")
            full_url = f"{NEXTJS_BASE_URL}{session_url}"
            exercises_list = ", ".join(exercise_names)
            return (
                f"Session started! Open the logger to track your sets:\n\n"
                f"[Start logging →]({full_url})\n\n"
                f"Exercises loaded: {exercises_list}. "
                f"When you're done, complete the session in the app."
            )
        except Exception:
            return "Session started! Open the app to continue logging."

    return Tool(
        definition=ToolDefinition(
            name="start_session",
            description=(
                "Start a new live workout session and pre-load exercises into the app's logger. "
                "Returns a link the user clicks to open the session — they log sets and complete it in the app, not in chat. "
                "Use get_workouts + GET /api/internal/workouts/{id} first to see the exercise list if the user named a workout template. "
                "Confirm the exercise lineup (including any substitutions) with the user before calling. "
                "If the user wants to log a past session instead, use log_session."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "exercises": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Ordered list of exercise names to pre-load. At least one required.",
                    },
                    "workout_name": {
                        "type": "string",
                        "description": "If based on a saved workout template, its name (links session for analytics).",
                        "default": "",
                    },
                    "plan_name": {
                        "type": "string",
                        "description": "If part of an active plan, the plan name (links session for adherence tracking).",
                        "default": "",
                    },
                    "scheduled_date": {
                        "type": "string",
                        "description": (
                            "The date this session was scheduled for in the plan (YYYY-MM-DD, user's local timezone). "
                            "Provide when plan_name is also given so the session counts toward plan adherence tracking. "
                            "For example, if the user is doing their Monday workout on Tuesday, pass Monday's date."
                        ),
                        "default": "",
                    },
                },
                "required": ["exercises"],
            },
        ),
        handler=handler,
    )


def _update_goal_tool() -> Tool:
    async def handler(user_id: str, args: dict[str, Any]) -> str:
        goal_id = str(args.get("goal_id", "")).strip()
        if not goal_id:
            return "error: goal_id is required"

        payload: dict[str, Any] = {}
        if "title" in args:
            payload["title"] = args["title"]
        if "target_date" in args:
            payload["targetDate"] = args["target_date"]
        if "status" in args:
            payload["status"] = args["status"]
        if "config_patch" in args:
            payload["config"] = args["config_patch"]

        if not payload:
            return "error: no fields to update provided"

        status_code, text = await _patch(user_id, f"/api/internal/goals/{goal_id}", payload)
        if status_code == 404:
            return f"error: goal '{goal_id}' not found. Use get_goals_with_progress to list goals."
        if status_code != 200:
            return f"error {status_code}: {text[:200]}"

        changes = ", ".join(payload.keys())
        return f"Updated goal '{goal_id}' — changed: {changes}."

    return Tool(
        definition=ToolDefinition(
            name="update_goal",
            description=(
                "Update an existing goal. All fields are optional — only provided fields are changed. "
                "Use get_goals_with_progress to find the goal_id before calling.\n\n"
                "config_patch keys per goal type:\n"
                "- STRENGTH: targetValueKg (float, kg), startingValueKg (float)\n"
                "- BODY_METRIC: targetValue (float), startingValue (float)\n"
                "- CONSISTENCY: workoutsPerWeek (int)\n\n"
                "status values: ACTIVE, ACHIEVED, FAILED, ARCHIVED\n\n"
                "Confirm before calling if the change is non-trivial (e.g. lowering a target, "
                "marking FAILED). Status changes to ACHIEVED or ARCHIVED when the user's intent "
                "is unambiguous may proceed without additional confirmation."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "goal_id": {"type": "string", "description": "ID of the goal to update."},
                    "title": {"type": "string", "description": "New goal title."},
                    "target_date": {
                        "type": ["string", "null"],
                        "description": "New deadline in YYYY-MM-DD format, or null to remove it.",
                    },
                    "status": {
                        "type": "string",
                        "enum": ["ACTIVE", "ACHIEVED", "FAILED", "ARCHIVED"],
                        "description": "New goal status.",
                    },
                    "config_patch": {
                        "type": "object",
                        "description": "Partial config dict — shallow-merged into existing config. See description for keys per goal type.",
                    },
                },
                "required": ["goal_id"],
            },
        ),
        handler=handler,
    )
