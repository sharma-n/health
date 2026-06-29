"""M13 write tool tests."""
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from health_agent.tools.write_tools import get_write_tools


def _resp(data, status: int = 200) -> MagicMock:
    m = MagicMock()
    m.status_code = status
    m.text = json.dumps(data)
    return m


def _tool(name: str):
    return next(t for t in get_write_tools() if t.definition.name == name)


# ---------------------------------------------------------------------------
# create_workout
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_workout_happy_path():
    tool = _tool("create_workout")
    exercises_resp = [{"id": "ex1", "name": "Bench Press", "equipment": "BARBELL", "primaryMuscles": ["CHEST"]}]
    created_resp = {"id": "wk1"}

    with patch("health_agent.tools.write_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(return_value=_resp(exercises_resp))
        mock_client.post = AsyncMock(return_value=_resp(created_resp, status=201))
        result = await tool.handler("user1", {
            "name": "Push Day",
            "exercises": [{"exercise_name": "Bench Press", "target_sets": 3, "target_reps": 8}],
        })

    assert "Push Day" in result
    assert "wk1" in result
    assert "1 exercises" in result


@pytest.mark.asyncio
async def test_create_workout_unresolved_exercise():
    tool = _tool("create_workout")
    with patch("health_agent.tools.write_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(return_value=_resp([]))  # no match
        result = await tool.handler("user1", {
            "name": "Push Day",
            "exercises": [{"exercise_name": "Unknown Exercise"}],
        })

    assert "error" in result.lower()
    assert "Unknown Exercise" in result
    assert "get_exercises" in result


@pytest.mark.asyncio
async def test_create_workout_missing_name():
    tool = _tool("create_workout")
    with patch("health_agent.tools.write_tools.http_client"):
        result = await tool.handler("user1", {"exercises": []})

    assert "error" in result.lower()
    assert "name" in result.lower()


@pytest.mark.asyncio
async def test_create_workout_http_error():
    tool = _tool("create_workout")
    with patch("health_agent.tools.write_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(return_value=_resp([{"id": "ex1", "name": "Squat"}]))
        mock_client.post = AsyncMock(return_value=_resp({"error": "Server error"}, status=500))
        result = await tool.handler("user1", {
            "name": "Leg Day",
            "exercises": [{"exercise_name": "Squat"}],
        })

    assert "error" in result.lower()
    assert "500" in result


@pytest.mark.asyncio
async def test_create_workout_no_exercises():
    """Empty exercise list is valid."""
    tool = _tool("create_workout")
    with patch("health_agent.tools.write_tools.http_client") as mock_client:
        mock_client.post = AsyncMock(return_value=_resp({"id": "wk2"}, status=201))
        result = await tool.handler("user1", {"name": "Empty Workout"})

    assert "wk2" in result or "Empty Workout" in result


# ---------------------------------------------------------------------------
# create_training_plan
# ---------------------------------------------------------------------------

WORKOUTS_LIST = [
    {"id": "wk1", "name": "Push Day", "exerciseCount": 4},
    {"id": "wk2", "name": "Pull Day", "exerciseCount": 3},
    {"id": "wk3", "name": "Legs", "exerciseCount": 5},
]


@pytest.mark.asyncio
async def test_create_training_plan_happy_path():
    tool = _tool("create_training_plan")
    with patch("health_agent.tools.write_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(return_value=_resp(WORKOUTS_LIST))
        mock_client.post = AsyncMock(return_value=_resp({"id": "pl1"}, status=201))
        result = await tool.handler("user1", {
            "name": "PPL 8-Week",
            "start_date": "2026-07-01",
            "end_date": "2026-08-25",
            "weekly_schedule": {"monday": "Push Day", "wednesday": "Pull Day", "friday": "Legs"},
        })

    assert "PPL 8-Week" in result
    assert "pl1" in result
    assert "3 scheduled days" in result


@pytest.mark.asyncio
async def test_create_training_plan_unknown_workout():
    tool = _tool("create_training_plan")
    with patch("health_agent.tools.write_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(return_value=_resp(WORKOUTS_LIST))
        result = await tool.handler("user1", {
            "name": "Bad Plan",
            "start_date": "2026-07-01",
            "end_date": "2026-08-25",
            "weekly_schedule": {"monday": "Nonexistent Workout"},
        })

    assert "error" in result.lower()
    assert "Nonexistent Workout" in result
    assert "get_workouts" in result


@pytest.mark.asyncio
async def test_create_training_plan_unknown_day():
    tool = _tool("create_training_plan")
    with patch("health_agent.tools.write_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(return_value=_resp(WORKOUTS_LIST))
        result = await tool.handler("user1", {
            "name": "Bad Plan",
            "start_date": "2026-07-01",
            "end_date": "2026-08-25",
            "weekly_schedule": {"funday": "Push Day"},
        })

    assert "error" in result.lower()
    assert "funday" in result


@pytest.mark.asyncio
async def test_create_training_plan_missing_required():
    tool = _tool("create_training_plan")
    with patch("health_agent.tools.write_tools.http_client"):
        result = await tool.handler("user1", {"name": "Incomplete"})

    assert "error" in result.lower()


@pytest.mark.asyncio
async def test_create_training_plan_day_name_case_insensitive():
    """Workout name matching should be case-insensitive."""
    tool = _tool("create_training_plan")
    with patch("health_agent.tools.write_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(return_value=_resp(WORKOUTS_LIST))
        mock_client.post = AsyncMock(return_value=_resp({"id": "pl2"}, status=201))
        result = await tool.handler("user1", {
            "name": "PPL",
            "start_date": "2026-07-01",
            "end_date": "2026-08-25",
            "weekly_schedule": {"MONDAY": "push day"},  # different case
        })

    assert "pl2" in result


# ---------------------------------------------------------------------------
# create_goal
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_goal_consistency():
    tool = _tool("create_goal")
    with patch("health_agent.tools.write_tools.http_client") as mock_client:
        mock_client.post = AsyncMock(return_value=_resp({"id": "g1"}, status=201))
        result = await tool.handler("user1", {
            "title": "Train 3x/week",
            "type": "CONSISTENCY",
            "config": {"workouts_per_week": 3},
        })

    assert "Train 3x/week" in result
    assert "g1" in result


@pytest.mark.asyncio
async def test_create_goal_body_metric():
    tool = _tool("create_goal")
    with patch("health_agent.tools.write_tools.http_client") as mock_client:
        mock_client.post = AsyncMock(return_value=_resp({"id": "g2"}, status=201))
        result = await tool.handler("user1", {
            "title": "Lose 5 kg",
            "type": "BODY_METRIC",
            "target_date": "2026-12-31",
            "config": {"metric_type": "BODYWEIGHT", "starting_value": 80, "target_value": 75},
        })

    assert "g2" in result


@pytest.mark.asyncio
async def test_create_goal_strength_resolves_exercise():
    tool = _tool("create_goal")
    exercises_resp = [{"id": "ex1", "name": "Bench Press"}]
    with patch("health_agent.tools.write_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(return_value=_resp(exercises_resp))
        mock_client.post = AsyncMock(return_value=_resp({"id": "g3"}, status=201))
        result = await tool.handler("user1", {
            "title": "Bench 100 kg",
            "type": "STRENGTH",
            "config": {"exercise_name": "Bench Press", "metric": "1RM", "target_value_kg": 100},
        })

    assert "g3" in result
    # Verify post payload contained exerciseId (not exercise_name)
    posted_body = mock_client.post.call_args.kwargs.get("json", {})
    assert posted_body.get("config", {}).get("exerciseId") == "ex1"


@pytest.mark.asyncio
async def test_create_goal_strength_unknown_exercise():
    tool = _tool("create_goal")
    with patch("health_agent.tools.write_tools.http_client") as mock_client:
        mock_client.get = AsyncMock(return_value=_resp([]))
        result = await tool.handler("user1", {
            "title": "Bench 100 kg",
            "type": "STRENGTH",
            "config": {"exercise_name": "Unknown", "metric": "1RM", "target_value_kg": 100},
        })

    assert "error" in result.lower()
    assert "Unknown" in result


@pytest.mark.asyncio
async def test_create_goal_invalid_type():
    tool = _tool("create_goal")
    with patch("health_agent.tools.write_tools.http_client"):
        result = await tool.handler("user1", {
            "title": "Bad goal",
            "type": "INVALID",
            "config": {},
        })

    assert "error" in result.lower()


@pytest.mark.asyncio
async def test_create_goal_missing_title():
    tool = _tool("create_goal")
    with patch("health_agent.tools.write_tools.http_client"):
        result = await tool.handler("user1", {"type": "CONSISTENCY", "config": {"workouts_per_week": 3}})

    assert "error" in result.lower()


# ---------------------------------------------------------------------------
# log_body_metric
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_log_body_metric_happy_path():
    tool = _tool("log_body_metric")
    with patch("health_agent.tools.write_tools.http_client") as mock_client:
        mock_client.post = AsyncMock(return_value=_resp({"id": "m1"}, status=201))
        result = await tool.handler("user1", {
            "metric_type": "BODYWEIGHT",
            "value": 79.5,
            "date": "2026-06-23",
        })

    assert "BODYWEIGHT" in result
    assert "79.5" in result
    assert "2026-06-23" in result


@pytest.mark.asyncio
async def test_log_body_metric_defaults_to_today():
    from datetime import date as date_cls
    tool = _tool("log_body_metric")
    with patch("health_agent.tools.write_tools.http_client") as mock_client:
        mock_client.post = AsyncMock(return_value=_resp({"id": "m2"}, status=201))
        result = await tool.handler("user1", {"metric_type": "WAIST", "value": 85})

    today = date_cls.today().isoformat()
    assert today in result


@pytest.mark.asyncio
async def test_log_body_metric_missing_metric_type():
    tool = _tool("log_body_metric")
    with patch("health_agent.tools.write_tools.http_client"):
        result = await tool.handler("user1", {"value": 80})

    assert "error" in result.lower()


@pytest.mark.asyncio
async def test_log_body_metric_missing_value():
    tool = _tool("log_body_metric")
    with patch("health_agent.tools.write_tools.http_client"):
        result = await tool.handler("user1", {"metric_type": "BODYWEIGHT"})

    assert "error" in result.lower()


@pytest.mark.asyncio
async def test_log_body_metric_http_error():
    tool = _tool("log_body_metric")
    with patch("health_agent.tools.write_tools.http_client") as mock_client:
        mock_client.post = AsyncMock(return_value=_resp({"error": "Bad"}, status=400))
        result = await tool.handler("user1", {"metric_type": "BODYWEIGHT", "value": 80, "date": "2026-06-23"})

    assert "error" in result.lower()
    assert "400" in result


# ---------------------------------------------------------------------------
# update_goal
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_goal_status_only():
    tool = _tool("update_goal")
    with patch("health_agent.tools.write_tools.http_client") as mock_client:
        mock_client.patch = AsyncMock(return_value=_resp({"id": "g1"}, status=200))
        result = await tool.handler("user1", {"goal_id": "g1", "status": "ACHIEVED"})

    assert "g1" in result
    posted_body = mock_client.patch.call_args.kwargs.get("json", {})
    assert posted_body.get("status") == "ACHIEVED"
    assert "title" not in posted_body


@pytest.mark.asyncio
async def test_update_goal_config_patch():
    tool = _tool("update_goal")
    with patch("health_agent.tools.write_tools.http_client") as mock_client:
        mock_client.patch = AsyncMock(return_value=_resp({"id": "g2"}, status=200))
        result = await tool.handler("user1", {
            "goal_id": "g2",
            "config_patch": {"targetValueKg": 110},
        })

    assert "g2" in result
    posted_body = mock_client.patch.call_args.kwargs.get("json", {})
    assert posted_body.get("config") == {"targetValueKg": 110}


@pytest.mark.asyncio
async def test_update_goal_not_found():
    tool = _tool("update_goal")
    with patch("health_agent.tools.write_tools.http_client") as mock_client:
        mock_client.patch = AsyncMock(return_value=_resp({"error": "Not found"}, status=404))
        result = await tool.handler("user1", {"goal_id": "missing", "status": "ARCHIVED"})

    assert "error" in result.lower()
    assert "missing" in result
    assert "get_goals_with_progress" in result


@pytest.mark.asyncio
async def test_update_goal_http_error():
    tool = _tool("update_goal")
    with patch("health_agent.tools.write_tools.http_client") as mock_client:
        mock_client.patch = AsyncMock(return_value=_resp({"error": "Server error"}, status=500))
        result = await tool.handler("user1", {"goal_id": "g3", "title": "New title"})

    assert "error" in result.lower()
    assert "500" in result


@pytest.mark.asyncio
async def test_update_goal_no_fields():
    tool = _tool("update_goal")
    with patch("health_agent.tools.write_tools.http_client"):
        result = await tool.handler("user1", {"goal_id": "g1"})

    assert "error" in result.lower()


@pytest.mark.asyncio
async def test_update_goal_missing_goal_id():
    tool = _tool("update_goal")
    with patch("health_agent.tools.write_tools.http_client"):
        result = await tool.handler("user1", {"status": "ACHIEVED"})

    assert "error" in result.lower()
    assert "goal_id" in result.lower()


# ---------------------------------------------------------------------------
# create_exercise
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_exercise_happy_path():
    tool = _tool("create_exercise")
    created_resp = {"id": "ex99"}

    with patch("health_agent.tools.write_tools.http_client") as mock_client:
        mock_client.post = AsyncMock(return_value=_resp(created_resp, status=201))
        result = await tool.handler("user1", {
            "name": "Banded Pull-Apart",
            "equipment": "BAND",
            "primary_muscles": ["UPPER_BACK", "REAR_DELTS"],
            "secondary_muscles": ["TRAPS"],
            "description": "A shoulder health exercise",
            "instructions": "Hold band at shoulder width...",
            "common_pitfalls": "Don't shrug the shoulders.",
        })

    assert "Banded Pull-Apart" in result
    assert "ex99" in result


@pytest.mark.asyncio
async def test_create_exercise_required_only():
    tool = _tool("create_exercise")
    created_resp = {"id": "ex100"}

    with patch("health_agent.tools.write_tools.http_client") as mock_client:
        mock_client.post = AsyncMock(return_value=_resp(created_resp, status=201))
        result = await tool.handler("user1", {
            "name": "Floor Press",
            "equipment": "BARBELL",
            "primary_muscles": ["CHEST"],
        })

    assert "Floor Press" in result
    assert "ex100" in result


@pytest.mark.asyncio
async def test_create_exercise_missing_name():
    tool = _tool("create_exercise")
    with patch("health_agent.tools.write_tools.http_client"):
        result = await tool.handler("user1", {"equipment": "BAND", "primary_muscles": ["UPPER_BACK"]})

    assert "error" in result.lower()
    assert "name" in result.lower()


@pytest.mark.asyncio
async def test_create_exercise_missing_equipment():
    tool = _tool("create_exercise")
    with patch("health_agent.tools.write_tools.http_client"):
        result = await tool.handler("user1", {"name": "Something", "primary_muscles": ["UPPER_BACK"]})

    assert "error" in result.lower()
    assert "equipment" in result.lower()


@pytest.mark.asyncio
async def test_create_exercise_missing_primary_muscles():
    tool = _tool("create_exercise")
    with patch("health_agent.tools.write_tools.http_client"):
        result = await tool.handler("user1", {"name": "Something", "equipment": "BAND", "primary_muscles": []})

    assert "error" in result.lower()
    assert "primary_muscles" in result.lower()


@pytest.mark.asyncio
async def test_create_exercise_http_error():
    tool = _tool("create_exercise")
    with patch("health_agent.tools.write_tools.http_client") as mock_client:
        mock_client.post = AsyncMock(return_value=_resp({"error": "Server error"}, status=500))
        result = await tool.handler("user1", {
            "name": "Bad Exercise",
            "equipment": "BARBELL",
            "primary_muscles": ["CHEST"],
        })

    assert "error" in result.lower()
    assert "500" in result
