"""Builds the AgentService singleton from config.yaml."""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from pathlib import Path
from agent_kit.config import AgentKitConfig
from agent_kit.service import AgentService
from health_agent.tools.read_tools import get_read_tools
from health_agent.tools.coaching_tools import get_coaching_tools
from health_agent.tools.write_tools import get_write_tools
from health_agent.context import user_timezone

_CONFIG_PATH = Path(__file__).parent.parent.parent / "config.yaml"


async def _system_prompt_fn(user_id: str, conversation_id: str) -> str:
    tz_name = user_timezone.get()
    try:
        tz = ZoneInfo(tz_name)
    except (ZoneInfoNotFoundError, Exception):
        from datetime import timezone as _tz
        tz = _tz.utc
        tz_name = "UTC"
    local_now = datetime.now(tz)
    today = local_now.date()
    weekday = local_now.strftime("%A")
    week_monday = today - timedelta(days=today.weekday())  # Monday=0
    day_names_short = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    week_map = ", ".join(
        f"{day_names_short[i]}={(week_monday + timedelta(days=i)).isoformat()}"
        for i in range(7)
    )
    return (
        f"Today's date is {weekday}, {today.isoformat()}. User's timezone: {tz_name}.\n"
        f"This week: {week_map}."
    )


def build_service() -> AgentService:
    cfg = AgentKitConfig.from_yaml(str(_CONFIG_PATH))
    return AgentService.build(
        cfg,
        extra_tools=get_read_tools() + get_coaching_tools() + get_write_tools(),
        system_prompt_fn=_system_prompt_fn,
    )
