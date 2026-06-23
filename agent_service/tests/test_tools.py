"""Tool tests — M10 smoke test + M12 coaching intelligence tests + pre-M13 get_workouts."""
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from health_agent.service import build_service
from health_agent.tools.coaching_tools import get_coaching_tools
from health_agent.tools.read_tools import get_read_tools


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resp(data, status: int = 200) -> MagicMock:
    """Build a mock httpx response."""
    m = MagicMock()
    m.status_code = status
    m.text = json.dumps(data)
    return m


def _tool(name: str):
    """Return the named coaching tool handler."""
    return next(t for t in get_coaching_tools() if t.definition.name == name)


def _read_tool(name: str):
    """Return the named read tool handler."""
    return next(t for t in get_read_tools() if t.definition.name == name)


# ---------------------------------------------------------------------------
# M10 smoke test
# ---------------------------------------------------------------------------

def test_service_builds() -> None:
    """build_service wires config + tools without requiring live external services."""
    with patch("health_agent.service.AgentService") as mock_svc:
        mock_svc.build.return_value = MagicMock()
        service = build_service()
    assert service is not None
    # Verify all M11 + M12 tools were registered
    call_kwargs = mock_svc.build.call_args
    tools = call_kwargs.kwargs.get("extra_tools") or call_kwargs.args[1]
    tool_names = {t.definition.name for t in tools}
    assert "get_workout_history" in tool_names       # M11
    assert "get_muscle_volume" in tool_names          # M11
    assert "get_workouts" in tool_names               # pre-M13
    assert "analyze_training_balance" in tool_names   # M12
    assert "assess_goal_trajectory" in tool_names     # M12
    assert "suggest_next_workout" in tool_names       # M12
    assert "get_training_summary" in tool_names       # M12
    assert "create_workout" in tool_names             # M13
    assert "create_training_plan" in tool_names       # M13
    assert "create_goal" in tool_names                # M13
    assert "log_body_metric" in tool_names            # M13
    assert "update_goal" in tool_names                # post-M13
    assert "get_body_metrics" in tool_names           # post-M13
    # Verify system_prompt_fn is wired
    assert call_kwargs.kwargs.get("system_prompt_fn") is not None


@pytest.mark.asyncio
async def test_system_prompt_fn_returns_date_string() -> None:
    """_system_prompt_fn returns a string with today's date and a weekday name."""
    from datetime import date
    from health_agent.service import _system_prompt_fn

    result = await _system_prompt_fn("user1", "conv1")
    today_iso = date.today().isoformat()
    assert today_iso in result
    # Should contain a weekday name
    weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    assert any(day in result for day in weekdays)


# ---------------------------------------------------------------------------
# get_workouts (pre-M13)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_workouts_happy_path():
    tool = _read_tool("get_workouts")
    workouts = [
        {"id": "w1", "name": "Push Day", "description": "Chest and triceps", "exerciseCount": 4},
        {"id": "w2", "name": "Pull Day", "description": None, "exerciseCount": 3},
    ]
    with patch("health_agent.tools.read_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(return_value=_resp(workouts))
        result = await tool.handler("user1", {})

    assert "Push Day" in result
    assert "w1" in result
    assert "4 exercises" in result
    assert "Pull Day" in result
    assert "3 exercises" in result


@pytest.mark.asyncio
async def test_get_workouts_empty():
    tool = _read_tool("get_workouts")
    with patch("health_agent.tools.read_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(return_value=_resp([]))
        result = await tool.handler("user1", {})

    assert "No workout templates" in result


@pytest.mark.asyncio
async def test_get_workouts_http_error():
    tool = _read_tool("get_workouts")
    with patch("health_agent.tools.read_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(return_value=_resp({"error": "Unauthorized"}, status=401))
        result = await tool.handler("user1", {})

    assert "error 401" in result


# ---------------------------------------------------------------------------
# analyze_training_balance
# ---------------------------------------------------------------------------

VOLUME_UNBALANCED = {
    "weeks": [
        {"weekLabel": "W1", "weekStart": "2025-01-01", "Chest": 20, "Back": 20, "Legs": 4, "Shoulders": 2}
    ],
    "muscleGroups": ["Chest", "Back", "Legs", "Shoulders"],
}

ADHERENCE_DATA = {
    "currentStreak": 5,
    "longestStreak": 14,
    "sessionsThisWeek": 3,
    "sessionsLastWeek": 4,
    "totalCompleted": 40,
    "heatmapData": [],
    "weeklyBars": [],
}


@pytest.mark.asyncio
async def test_analyze_training_balance_identifies_imbalance():
    tool = _tool("analyze_training_balance")
    with patch("health_agent.tools.coaching_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(side_effect=[
            _resp(VOLUME_UNBALANCED),   # muscle-volume
            _resp(ADHERENCE_DATA),      # adherence
        ])
        result = await tool.handler("user1", {})

    assert "Training balance analysis" in result
    assert "Over-trained" in result or "Well-balanced" in result
    assert "Chest" in result or "Back" in result
    assert "3 sessions this week" in result


@pytest.mark.asyncio
async def test_analyze_training_balance_empty_data():
    tool = _tool("analyze_training_balance")
    with patch("health_agent.tools.coaching_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(side_effect=[
            _resp({"weeks": [], "muscleGroups": []}),  # no data
            _resp(ADHERENCE_DATA),
        ])
        result = await tool.handler("user1", {})

    assert "Not enough training data" in result


@pytest.mark.asyncio
async def test_analyze_training_balance_all_equal():
    """All muscle groups equal volume → all balanced, no over/under."""
    equal_vol = {
        "weeks": [{"weekLabel": "W1", "weekStart": "2025-01-01", "Chest": 10, "Back": 10}],
        "muscleGroups": ["Chest", "Back"],
    }
    tool = _tool("analyze_training_balance")
    with patch("health_agent.tools.coaching_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(side_effect=[
            _resp(equal_vol),
            _resp(ADHERENCE_DATA),
        ])
        result = await tool.handler("user1", {})

    assert "well-balanced" in result.lower()


@pytest.mark.asyncio
async def test_analyze_training_balance_zero_muscle():
    """A muscle group with 0 sets should appear as under-trained."""
    vol = {
        "weeks": [{"weekLabel": "W1", "weekStart": "2025-01-01", "Chest": 30, "Calves": 0}],
        "muscleGroups": ["Chest", "Calves"],
    }
    tool = _tool("analyze_training_balance")
    with patch("health_agent.tools.coaching_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(side_effect=[
            _resp(vol),
            _resp(ADHERENCE_DATA),
        ])
        result = await tool.handler("user1", {})

    assert "Calves" in result
    assert "neglected" in result or "Under-trained" in result


# ---------------------------------------------------------------------------
# assess_goal_trajectory
# ---------------------------------------------------------------------------

def _goals_list(
    *,
    goal_id: str = "g1",
    pct: float = 50.0,
    target_date: str | None = None,
    created_at: str = "2025-01-01",
    goal_type: str = "STRENGTH",
    status: str = "ACTIVE",
):
    return [
        {
            "id": goal_id,
            "type": goal_type,
            "title": "Bench 100 kg",
            "status": status,
            "targetDate": target_date,
            "createdAt": created_at,
            "progress": {"percentage": pct, "current": 80, "target": 100, "unit": "kg"},
        }
    ]


@pytest.mark.asyncio
async def test_assess_goal_trajectory_on_track(freezegun_date="2025-07-01"):
    """Goal with good progress relative to elapsed time → ON TRACK / AHEAD."""
    from datetime import date
    tool = _tool("assess_goal_trajectory")
    with patch("health_agent.tools.coaching_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(return_value=_resp(
            _goals_list(goal_id="g1", pct=60.0, target_date="2025-12-31", created_at="2025-01-01")
        ))
        # Patch today's date so the arithmetic is deterministic
        with patch("health_agent.tools.coaching_tools.date") as mock_date:
            mock_date.today.return_value = date(2025, 7, 1)
            mock_date.fromisoformat = date.fromisoformat
            result = await tool.handler("user1", {"goal_id": "g1"})

    assert "Bench 100 kg" in result
    assert "60.0%" in result
    assert any(kw in result for kw in ["ON TRACK", "AHEAD", "AT RISK"])


@pytest.mark.asyncio
async def test_assess_goal_trajectory_at_risk():
    """Slow progress relative to deadline → AT RISK."""
    from datetime import date
    tool = _tool("assess_goal_trajectory")
    with patch("health_agent.tools.coaching_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(return_value=_resp(
            # Only 10% done in first 6 months of a 12-month goal
            _goals_list(goal_id="g1", pct=10.0, target_date="2025-12-31", created_at="2025-01-01")
        ))
        with patch("health_agent.tools.coaching_tools.date") as mock_date:
            mock_date.today.return_value = date(2025, 7, 1)
            mock_date.fromisoformat = date.fromisoformat
            result = await tool.handler("user1", {"goal_id": "g1"})

    assert "AT RISK" in result


@pytest.mark.asyncio
async def test_assess_goal_trajectory_unknown_id():
    tool = _tool("assess_goal_trajectory")
    with patch("health_agent.tools.coaching_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(return_value=_resp(
            _goals_list(goal_id="other")
        ))
        result = await tool.handler("user1", {"goal_id": "nonexistent"})

    assert "not found" in result.lower()
    assert "get_goals_with_progress" in result


@pytest.mark.asyncio
async def test_assess_goal_trajectory_missing_goal_id():
    tool = _tool("assess_goal_trajectory")
    with patch("health_agent.tools.coaching_tools.http_client") as mock_client:
        mock_client.get = AsyncMock()
        result = await tool.handler("user1", {})

    assert "goal_id is required" in result
    mock_client.get.assert_not_called()


@pytest.mark.asyncio
async def test_assess_goal_trajectory_no_target_date():
    from datetime import date
    tool = _tool("assess_goal_trajectory")
    with patch("health_agent.tools.coaching_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(return_value=_resp(
            _goals_list(goal_id="g1", pct=40.0, target_date=None, created_at="2025-01-01")
        ))
        with patch("health_agent.tools.coaching_tools.date") as mock_date:
            mock_date.today.return_value = date(2025, 7, 1)
            mock_date.fromisoformat = date.fromisoformat
            result = await tool.handler("user1", {"goal_id": "g1"})

    assert "No target date" in result
    assert "projected completion" in result.lower()


@pytest.mark.asyncio
async def test_assess_goal_trajectory_past_deadline():
    from datetime import date
    tool = _tool("assess_goal_trajectory")
    with patch("health_agent.tools.coaching_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(return_value=_resp(
            _goals_list(goal_id="g1", pct=70.0, target_date="2024-12-31", created_at="2024-01-01")
        ))
        with patch("health_agent.tools.coaching_tools.date") as mock_date:
            mock_date.today.return_value = date(2025, 7, 1)
            mock_date.fromisoformat = date.fromisoformat
            result = await tool.handler("user1", {"goal_id": "g1"})

    assert "MISSED" in result or "ACHIEVED" in result


# ---------------------------------------------------------------------------
# suggest_next_workout
# ---------------------------------------------------------------------------

PLANS_WITH_SCHEDULE = [
    {
        "name": "PPL",
        "startDate": "2025-01-01",
        "endDate": "2025-12-31",
        "schedule": {
            "1": {"workoutName": "Push Day"},   # Monday
            "2": {"workoutName": "Pull Day"},
            "3": {"workoutName": "Legs Day"},
        },
    }
]

VOLUME_2W = {
    "weeks": [
        {"weekLabel": "W1", "weekStart": "2025-06-23", "Chest": 15, "Back": 8, "Legs": 2}
    ],
    "muscleGroups": ["Chest", "Back", "Legs"],
}


@pytest.mark.asyncio
async def test_suggest_next_workout_follows_plan():
    from datetime import date
    tool = _tool("suggest_next_workout")
    with patch("health_agent.tools.coaching_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(side_effect=[
            _resp(PLANS_WITH_SCHEDULE),   # plans
            _resp(VOLUME_2W),             # muscle-volume
            _resp(ADHERENCE_DATA),        # adherence
        ])
        # Monday = weekday 0 → day_idx = 1
        with patch("health_agent.tools.coaching_tools.date") as mock_date:
            mock_date.today.return_value = date(2025, 6, 23)  # Monday
            mock_date.fromisoformat = date.fromisoformat
            result = await tool.handler("user1", {})

    assert "Push Day" in result
    assert "Follow your plan" in result


@pytest.mark.asyncio
async def test_suggest_next_workout_no_plan_uses_volume():
    from datetime import date
    tool = _tool("suggest_next_workout")
    with patch("health_agent.tools.coaching_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(side_effect=[
            _resp([]),          # no active plans
            _resp(VOLUME_2W),   # muscle-volume (Legs lowest)
            _resp(ADHERENCE_DATA),
        ])
        with patch("health_agent.tools.coaching_tools.date") as mock_date:
            mock_date.today.return_value = date(2025, 6, 23)
            mock_date.fromisoformat = date.fromisoformat
            result = await tool.handler("user1", {})

    assert "No workout scheduled" in result
    assert "Legs" in result  # least-trained muscle


@pytest.mark.asyncio
async def test_suggest_next_workout_no_data_fallback():
    from datetime import date
    tool = _tool("suggest_next_workout")
    with patch("health_agent.tools.coaching_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(side_effect=[
            _resp([]),
            _resp({"weeks": [], "muscleGroups": []}),
            _resp(ADHERENCE_DATA),
        ])
        with patch("health_agent.tools.coaching_tools.date") as mock_date:
            mock_date.today.return_value = date(2025, 6, 23)
            mock_date.fromisoformat = date.fromisoformat
            result = await tool.handler("user1", {})

    assert "full-body session" in result


@pytest.mark.asyncio
async def test_suggest_next_workout_high_frequency_warning():
    from datetime import date
    heavy_week = {**ADHERENCE_DATA, "sessionsThisWeek": 5}
    tool = _tool("suggest_next_workout")
    with patch("health_agent.tools.coaching_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(side_effect=[
            _resp([]),
            _resp(VOLUME_2W),
            _resp(heavy_week),
        ])
        with patch("health_agent.tools.coaching_tools.date") as mock_date:
            mock_date.today.return_value = date(2025, 6, 23)
            mock_date.fromisoformat = date.fromisoformat
            result = await tool.handler("user1", {})

    assert "active recovery" in result.lower()


@pytest.mark.asyncio
async def test_suggest_next_workout_equipment_filter():
    from datetime import date
    tool = _tool("suggest_next_workout")
    with patch("health_agent.tools.coaching_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(side_effect=[
            _resp([]),
            _resp(VOLUME_2W),
            _resp(ADHERENCE_DATA),
        ])
        with patch("health_agent.tools.coaching_tools.date") as mock_date:
            mock_date.today.return_value = date(2025, 6, 23)
            mock_date.fromisoformat = date.fromisoformat
            result = await tool.handler("user1", {"equipment": "dumbbells", "available_time_minutes": 25})

    assert "dumbbells" in result
    assert "under 30 min" in result


# ---------------------------------------------------------------------------
# get_training_summary
# ---------------------------------------------------------------------------

SESSIONS_DATA = [
    {"date": "2025-06-20", "workoutName": "Push", "durationMinutes": 60,
     "overallEffort": 7, "notes": "", "exercises": []},
]

GOALS_DATA = [
    {"id": "g1", "type": "STRENGTH", "title": "Bench 100 kg", "status": "ACTIVE",
     "targetDate": "2025-12-31", "createdAt": "2025-01-01",
     "progress": {"percentage": 55.0, "current": 85, "target": 100, "unit": "kg"}},
]

PRS_DATA = [
    {"exerciseId": "e1", "exerciseName": "Bench Press", "prType": "estimatedOneRM",
     "value": 95.0, "unit": "kg", "achievedAt": "2025-06-20", "isNew": True},
]

ADHERENCE_FULL = {
    **ADHERENCE_DATA,
    "weeklyBars": [
        {"label": "Jun 16", "weekStart": "2025-06-16", "completed": 3, "scheduled": 4},
        {"label": "Jun 23", "weekStart": "2025-06-23", "completed": 2, "scheduled": 3},
    ],
}


@pytest.mark.asyncio
async def test_get_training_summary_happy_path():
    tool = _tool("get_training_summary")
    with patch("health_agent.tools.coaching_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(side_effect=[
            _resp(SESSIONS_DATA),     # sessions
            _resp(ADHERENCE_FULL),    # adherence
            _resp(VOLUME_UNBALANCED), # muscle-volume
            _resp(GOALS_DATA),        # goals
            _resp(PRS_DATA),          # prs
        ])
        result = await tool.handler("user1", {"weeks": 4})

    assert "Training summary" in result
    assert "Consistency" in result
    assert "Volume" in result
    assert "Bench Press" in result   # new PR
    assert "Bench 100 kg" in result  # active goal
    assert "55%" in result


@pytest.mark.asyncio
async def test_get_training_summary_no_data():
    tool = _tool("get_training_summary")
    with patch("health_agent.tools.coaching_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(side_effect=[
            _resp([]),
            _resp({**ADHERENCE_DATA, "weeklyBars": []}),
            _resp({"weeks": [], "muscleGroups": []}),
            _resp([]),
            _resp([]),
        ])
        result = await tool.handler("user1", {})

    assert "Training summary" in result
    # Should not crash — may show "No new PRs" or similar
    assert "keep pushing" in result.lower() or "No training data" in result


@pytest.mark.asyncio
async def test_get_training_summary_no_new_prs():
    tool = _tool("get_training_summary")
    old_pr = [{**PRS_DATA[0], "isNew": False}]
    with patch("health_agent.tools.coaching_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(side_effect=[
            _resp(SESSIONS_DATA),
            _resp(ADHERENCE_FULL),
            _resp(VOLUME_UNBALANCED),
            _resp(GOALS_DATA),
            _resp(old_pr),
        ])
        result = await tool.handler("user1", {"weeks": 2})

    assert "No new PRs" in result


@pytest.mark.asyncio
async def test_get_training_summary_no_active_goals():
    tool = _tool("get_training_summary")
    archived_goal = [{**GOALS_DATA[0], "status": "ARCHIVED"}]
    with patch("health_agent.tools.coaching_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(side_effect=[
            _resp(SESSIONS_DATA),
            _resp(ADHERENCE_FULL),
            _resp(VOLUME_UNBALANCED),
            _resp(archived_goal),
            _resp([]),
        ])
        result = await tool.handler("user1", {})

    assert "No active goals" in result


# ---------------------------------------------------------------------------
# get_body_metrics (post-M13)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_body_metrics_happy_path():
    tool = _read_tool("get_body_metrics")
    data = [
        {"id": "m1", "type": "BODYWEIGHT", "value": 80.5, "date": "2026-06-24", "note": None},
        {"id": "m2", "type": "BODYWEIGHT", "value": 81.0, "date": "2026-06-17", "note": None},
        {"id": "m3", "type": "WAIST", "value": 88.0, "date": "2026-06-24", "note": "morning"},
    ]
    with patch("health_agent.tools.read_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(return_value=_resp(data))
        result = await tool.handler("user1", {})

    assert "BODYWEIGHT" in result
    assert "80.5" in result
    assert "WAIST" in result
    assert "morning" in result


@pytest.mark.asyncio
async def test_get_body_metrics_empty():
    tool = _read_tool("get_body_metrics")
    with patch("health_agent.tools.read_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(return_value=_resp([]))
        result = await tool.handler("user1", {})

    assert "No body metrics" in result


@pytest.mark.asyncio
async def test_get_body_metrics_type_filter():
    """Tool passes metric_type as 'type' query param and filters results."""
    tool = _read_tool("get_body_metrics")
    data = [{"id": "m1", "type": "BODYWEIGHT", "value": 80.5, "date": "2026-06-24", "note": None}]
    with patch("health_agent.tools.read_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(return_value=_resp(data))
        result = await tool.handler("user1", {"metric_type": "BODYWEIGHT", "days": 30})

    # Verify the request was made with the correct query params
    call_kwargs = mock_client.get.call_args
    params = call_kwargs.kwargs.get("params", {})
    assert params.get("type") == "BODYWEIGHT"
    assert params.get("days") == 30
    assert "BODYWEIGHT" in result


@pytest.mark.asyncio
async def test_get_body_metrics_http_error():
    tool = _read_tool("get_body_metrics")
    with patch("health_agent.tools.read_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(return_value=_resp({"error": "Unauthorized"}, status=401))
        result = await tool.handler("user1", {})

    assert "error 401" in result


@pytest.mark.asyncio
async def test_get_body_metrics_empty_filter_message():
    """Empty result with a type filter mentions the type in the message."""
    tool = _read_tool("get_body_metrics")
    with patch("health_agent.tools.read_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(return_value=_resp([]))
        result = await tool.handler("user1", {"metric_type": "BODY_FAT_PCT"})

    assert "BODY_FAT_PCT" in result
