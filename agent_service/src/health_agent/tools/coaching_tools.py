"""M12 coaching intelligence synthesis tools for the health agent."""
from __future__ import annotations

import asyncio
import json
import statistics
from datetime import date, timedelta
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


def get_coaching_tools() -> list[Tool]:
    return [
        _analyze_training_balance_tool(),
        _assess_goal_trajectory_tool(),
        _suggest_next_workout_tool(),
        _get_training_summary_tool(),
    ]


def _analyze_training_balance_tool() -> Tool:
    async def handler(user_id: str, args: dict[str, Any]) -> str:
        vol_raw, adherence_raw = await asyncio.gather(
            _get(user_id, "/api/internal/analytics/muscle-volume", {"weeks": 4}),
            _get(user_id, "/api/internal/analytics/adherence"),
        )

        try:
            vol_data = json.loads(vol_raw)
        except Exception:
            return vol_raw

        week_data = vol_data.get("weeks", [])
        muscle_groups = vol_data.get("muscleGroups", [])

        if not week_data or not muscle_groups:
            return "Not enough training data to analyse muscle balance. Log a few sessions first."

        totals: dict[str, float] = {
            mg: sum(week.get(mg) or 0 for week in week_data) for mg in muscle_groups
        }

        values = list(totals.values())
        mean = statistics.mean(values) if values else 0.0
        stdev = statistics.stdev(values) if len(values) > 1 else 0.0

        over_trained: list[tuple[str, float]] = []
        under_trained: list[tuple[str, float]] = []
        balanced: list[tuple[str, float]] = []

        for mg, vol in sorted(totals.items(), key=lambda x: x[1], reverse=True):
            if stdev > 0 and vol > mean + stdev:
                over_trained.append((mg, vol))
            elif vol == 0 or (stdev > 0 and vol < mean - stdev):
                under_trained.append((mg, vol))
            else:
                balanced.append((mg, vol))

        lines = ["Training balance analysis (last 4 weeks, volume in kg load = weight × reps):"]
        lines.append(f"  Average: {mean:.0f} kg/muscle group  |  Std dev: {stdev:.0f} kg")

        if over_trained:
            lines.append("\nOver-trained (significantly above average):")
            for mg, vol in over_trained:
                lines.append(f"  - {mg}: {vol:.0f} kg — consider a deload or reducing frequency")

        if under_trained:
            lines.append("\nUnder-trained (below average or untrained):")
            for mg, vol in under_trained:
                note = "0 kg — completely neglected" if vol == 0 else f"{vol:.0f} kg"
                lines.append(f"  - {mg}: {note} — prioritise in upcoming sessions")

        if balanced:
            lines.append("\nWell-balanced:")
            for mg, vol in balanced:
                lines.append(f"  - {mg}: {vol:.0f} kg")

        if not over_trained and not under_trained:
            lines.append("\nYour muscle training is well-balanced — great work!")

        try:
            adh = json.loads(adherence_raw)
            lines.append(
                f"\nTraining frequency context: {adh['sessionsThisWeek']} sessions this week, "
                f"{adh['currentStreak']}-day streak."
            )
        except Exception:
            pass

        return "\n".join(lines)

    return Tool(
        definition=ToolDefinition(
            name="analyze_training_balance",
            description=(
                "Analyse whether the user is over- or under-training specific muscle groups "
                "by comparing volume across all muscle groups over the last 4 weeks. "
                "Use this for questions about muscle imbalance, overtraining, or neglected areas."
            ),
            parameters={"type": "object", "properties": {}, "required": []},
        ),
        handler=handler,
    )


def _assess_goal_trajectory_tool() -> Tool:
    async def handler(user_id: str, args: dict[str, Any]) -> str:
        goal_id = str(args.get("goal_id", "")).strip()
        if not goal_id:
            return "error: goal_id is required. Call get_goals_with_progress first to list goal IDs."

        result = await _get(user_id, "/api/internal/goals")
        try:
            goals = json.loads(result)
        except Exception:
            return result

        goal = next((g for g in goals if g["id"] == goal_id), None)
        if not goal:
            return (
                f"Goal ID '{goal_id}' not found. "
                "Call get_goals_with_progress to see your goals and their IDs."
            )

        progress = goal["progress"]
        config = goal.get("config") or {}
        pct: float = float(progress.get("percentage") or 0)
        target_date_str: str | None = goal.get("targetDate")
        created_at_str: str = goal["createdAt"]
        today = date.today()
        created = date.fromisoformat(created_at_str)
        days_elapsed = max((today - created).days, 0)

        lines = [f"Goal trajectory: {goal['title']} ({goal['type']}, status: {goal['status']})"]

        # Add starting-point and direction context so the LLM understands the full arc
        goal_type = goal["type"]
        unit = progress.get("unit", "")
        current_val = progress.get("current", "N/A")
        target_val = progress.get("target", "N/A")

        if goal_type == "BODY_METRIC":
            start = config.get("startingValue")
            target = config.get("targetValue")
            if start is not None and target is not None:
                direction = "decrease" if target < start else "increase"
                lines.append(
                    f"  Goal direction: {direction} from {start} {unit} → {target} {unit}"
                )
                lines.append(f"  Current value: {current_val} {unit}")
        elif goal_type == "STRENGTH":
            start_kg = config.get("startingValueKg")
            target_kg = config.get("targetValueKg")
            metric = config.get("metric", "")
            if start_kg is not None and target_kg is not None:
                lines.append(
                    f"  Goal direction: increase {metric} from {start_kg} kg → {target_kg} kg"
                )
                lines.append(f"  Current estimate: {current_val} {unit}")
            else:
                lines.append(f"  Target: {target_val} {unit}  |  Current: {current_val} {unit}")
        else:
            lines.append(f"  Current: {current_val} {unit}  |  Target: {target_val} {unit}")

        lines.append(f"  Progress: {pct:.1f}% complete")

        if not target_date_str:
            lines.append("  No target date set — cannot project completion date.")
            if days_elapsed > 0 and pct > 0:
                rate = pct / days_elapsed
                days_to_complete = (100 - pct) / rate
                projected = today + timedelta(days=int(days_to_complete))
                lines.append(f"  At current pace, projected completion: {projected.isoformat()}")
            return "\n".join(lines)

        target_date = date.fromisoformat(target_date_str)
        days_remaining = (target_date - today).days
        total_days = max((target_date - created).days, 1)

        lines.append(f"  Deadline: {target_date_str}")

        if days_remaining < 0:
            status = "ACHIEVED" if pct >= 100 else f"MISSED (deadline was {abs(days_remaining)} days ago)"
            lines.append(f"  Status: {status}")
            return "\n".join(lines)

        lines.append(f"  Time remaining: {days_remaining} days")

        if pct >= 100:
            lines.append("  Status: ACHIEVED — goal complete!")
            return "\n".join(lines)

        if days_elapsed == 0 or pct == 0:
            lines.append("  Status: Just started — not enough data to project yet.")
            expected_pct = days_elapsed / total_days * 100
            lines.append(f"  Expected progress by now: {expected_pct:.1f}%")
            return "\n".join(lines)

        rate_per_day = pct / days_elapsed
        days_to_complete = (100 - pct) / rate_per_day
        projected = today + timedelta(days=int(days_to_complete))
        expected_pct = days_elapsed / total_days * 100

        lines.append(
            f"  Pace: {rate_per_day:.2f}% per day "
            f"(expected {expected_pct:.1f}% by now, actual {pct:.1f}%)"
        )
        lines.append(f"  Projected completion: {projected.isoformat()}")

        if projected <= target_date:
            days_ahead = (target_date - projected).days
            if days_ahead > 7:
                lines.append(
                    f"  Status: AHEAD OF SCHEDULE — on track to finish ~{days_ahead} days early"
                )
            else:
                lines.append("  Status: ON TRACK — projected to hit the deadline")
        else:
            days_behind = (projected - target_date).days
            lines.append(
                f"  Status: AT RISK — at current pace you'll finish ~{days_behind} days after the "
                "deadline. Consider increasing training frequency or adjusting the target."
            )

        return "\n".join(lines)

    return Tool(
        definition=ToolDefinition(
            name="assess_goal_trajectory",
            description=(
                "Project whether the user is on track to hit a specific goal by its deadline. "
                "Returns current pace, projected completion date, and on-track/at-risk verdict. "
                "Call get_goals_with_progress first to obtain the goal_id."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "goal_id": {
                        "type": "string",
                        "description": "The ID of the goal to assess (from get_goals_with_progress).",
                    }
                },
                "required": ["goal_id"],
            },
        ),
        handler=handler,
    )


def _suggest_next_workout_tool() -> Tool:
    async def handler(user_id: str, args: dict[str, Any]) -> str:
        available_time = int(args.get("available_time_minutes", 60))
        equipment = str(args.get("equipment", "")).strip()

        plans_raw, volume_raw, adherence_raw = await asyncio.gather(
            _get(user_id, "/api/internal/plans", {"status": "ACTIVE"}),
            _get(user_id, "/api/internal/analytics/muscle-volume", {"weeks": 2}),
            _get(user_id, "/api/internal/analytics/adherence"),
        )

        # API schedule: 0=Sun, 1=Mon ... 6=Sat
        # Python weekday(): 0=Mon, 6=Sun → convert: (weekday + 1) % 7
        day_idx = str((date.today().weekday() + 1) % 7)

        scheduled_workout: str | None = None
        try:
            plans = json.loads(plans_raw)
            for plan in plans:
                schedule = plan.get("schedule", {})
                if day_idx in schedule:
                    scheduled_workout = schedule[day_idx].get("workoutName")
                    break
        except Exception:
            pass

        least_trained: list[str] = []
        try:
            vol_data = json.loads(volume_raw)
            week_data = vol_data.get("weeks", [])
            muscle_groups = vol_data.get("muscleGroups", [])
            if week_data and muscle_groups:
                totals = {
                    mg: sum(week.get(mg) or 0 for week in week_data) for mg in muscle_groups
                }
                least_trained = [mg for mg, _ in sorted(totals.items(), key=lambda x: x[1])[:3]]
        except Exception:
            pass

        streak = 0
        sessions_this_week = 0
        try:
            adh = json.loads(adherence_raw)
            streak = adh.get("currentStreak", 0)
            sessions_this_week = adh.get("sessionsThisWeek", 0)
        except Exception:
            pass

        lines = [f"Workout suggestion (time available: {available_time} min):"]

        if scheduled_workout:
            lines.append(f"\n  Your active plan has scheduled: {scheduled_workout}")
            lines.append("  Recommendation: Follow your plan — consistency is key to long-term progress.")
        elif least_trained:
            lines.append("\n  No workout scheduled today in your active plan.")
            lines.append(f"  Most under-trained muscles (last 2 weeks): {', '.join(least_trained)}")
            lines.append(f"  Recommendation: Target {least_trained[0]} today to restore muscle balance.")
        else:
            lines.append("\n  No plan or volume data available yet.")
            lines.append("  Recommendation: Start with a full-body session to build your baseline.")

        if sessions_this_week >= 5:
            lines.append(
                f"\n  Note: You've trained {sessions_this_week} times this week — "
                "consider whether today is better as active recovery."
            )
        elif streak > 0:
            lines.append(f"\n  You're on a {streak}-day streak — keep the momentum going!")

        if equipment:
            lines.append(f"\n  Equipment constraint: {equipment}")
            lines.append("  Filter your exercise selection to match the available equipment.")

        if available_time < 30:
            lines.append("\n  With under 30 min: stick to 2–3 compound lifts, minimal rest.")
        elif available_time < 45:
            lines.append("\n  With 30–45 min: 4–5 exercises, 60s rest between sets.")
        elif available_time >= 75:
            lines.append("\n  With 75+ min: good time for warm-up, main work, and accessory exercises.")

        return "\n".join(lines)

    return Tool(
        definition=ToolDefinition(
            name="suggest_next_workout",
            description=(
                "Recommend what to train next based on the active training plan schedule, "
                "recent muscle volume (to identify least-trained areas), and available time. "
                "Use this for 'what should I train today/tomorrow?' questions."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "available_time_minutes": {
                        "type": "integer",
                        "description": "How many minutes the user has available (default 60).",
                        "default": 60,
                    },
                    "equipment": {
                        "type": "string",
                        "description": "Equipment available (e.g. 'barbell only', 'dumbbells', 'bodyweight'). Optional.",
                        "default": "",
                    },
                },
                "required": [],
            },
        ),
        handler=handler,
    )


def _get_training_summary_tool() -> Tool:
    async def handler(user_id: str, args: dict[str, Any]) -> str:
        weeks = max(1, int(args.get("weeks", 4)))
        days = weeks * 7

        sessions_raw, adherence_raw, volume_raw, goals_raw, prs_raw = await asyncio.gather(
            _get(user_id, "/api/internal/sessions", {"days": days}),
            _get(user_id, "/api/internal/analytics/adherence"),
            _get(user_id, "/api/internal/analytics/muscle-volume", {"weeks": weeks}),
            _get(user_id, "/api/internal/goals"),
            _get(user_id, "/api/internal/analytics/prs"),
        )

        lines = [f"Training summary — last {weeks} week{'s' if weeks != 1 else ''}:"]

        try:
            adh = json.loads(adherence_raw)
            recent_bars = adh.get("weeklyBars", [])[-weeks:]
            completed = sum(b["completed"] for b in recent_bars)
            scheduled = sum(b.get("scheduled") or 0 for b in recent_bars)
            lines.append("\nConsistency:")
            if scheduled > 0:
                pct = completed / scheduled * 100
                lines.append(f"  Sessions: {completed} / {scheduled} scheduled ({pct:.0f}%)")
            else:
                lines.append(f"  Sessions completed: {completed}")
            lines.append(
                f"  Current streak: {adh['currentStreak']} days "
                f"(longest: {adh['longestStreak']} days)"
            )
        except Exception:
            pass

        try:
            vol_data = json.loads(volume_raw)
            week_data = vol_data.get("weeks", [])
            muscle_groups = vol_data.get("muscleGroups", [])
            if week_data and muscle_groups:
                totals = {
                    mg: sum(week.get(mg) or 0 for week in week_data) for mg in muscle_groups
                }
                sorted_muscles = sorted(totals.items(), key=lambda x: x[1], reverse=True)
                lines.append("\nVolume by muscle group (kg load = weight × reps):")
                for mg, vol in sorted_muscles[:6]:
                    lines.append(f"  {mg}: {vol:.0f} kg")
        except Exception:
            pass

        try:
            prs = json.loads(prs_raw)
            new_prs = [pr for pr in prs if pr.get("isNew")]
            if new_prs:
                lines.append(f"\nNew PRs this period ({len(new_prs)} total):")
                for pr in new_prs[:5]:
                    lines.append(
                        f"  - {pr['exerciseName']}: {pr['prType']} = {pr['value']:.1f} {pr['unit']}"
                    )
            else:
                lines.append("\nNo new PRs in this window — keep pushing!")
        except Exception:
            pass

        try:
            goals = json.loads(goals_raw)
            active_goals = [g for g in goals if g["status"] == "ACTIVE"]
            if active_goals:
                lines.append(f"\nActive goals ({len(active_goals)}):")
                for g in active_goals[:4]:
                    p = g["progress"]
                    deadline = f" by {g['targetDate']}" if g["targetDate"] else ""
                    lines.append(f"  - {g['title']}: {p['percentage']:.0f}% complete{deadline}")
            elif goals:
                lines.append(
                    "\nNo active goals — consider setting a new target to stay motivated."
                )
        except Exception:
            pass

        if len(lines) == 1:
            lines.append(
                "\nNo training data found yet. Start logging sessions to see your summary."
            )

        return "\n".join(lines)

    return Tool(
        definition=ToolDefinition(
            name="get_training_summary",
            description=(
                "Generate a comprehensive training summary covering consistency, volume by muscle "
                "group, new PRs, and active goal progress. Use this for open-ended questions like "
                "'how am I doing?', 'give me a training recap', or 'how was my last month?'."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "weeks": {
                        "type": "integer",
                        "description": "Number of weeks to summarise (default 4).",
                        "default": 4,
                    }
                },
                "required": [],
            },
        ),
        handler=handler,
    )
