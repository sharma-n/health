"""Builds the AgentService singleton from config.yaml."""
import os
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from pathlib import Path

import yaml

from agent_kit.config import AgentKitConfig
from agent_kit.service import AgentService
from health_agent.tools.read_tools import get_read_tools
from health_agent.tools.coaching_tools import get_coaching_tools
from health_agent.tools.write_tools import get_write_tools
from health_agent.context import user_timezone

_CONFIG_PATH = Path(__file__).parent.parent.parent / "config.yaml"
_ENV_VAR_PATTERN = re.compile(r"\$\{([A-Z0-9_]+)(?::-(.*?))?\}")


def _interpolate_env(value: object) -> object:
    if isinstance(value, str):
        def _replace(m: re.Match) -> str:
            var, default = m.group(1), m.group(2)
            resolved = os.environ.get(var)
            if resolved is not None:
                return resolved
            if default is not None:
                return default
            raise KeyError(f"Environment variable {var!r} referenced in config but not set")
        return _ENV_VAR_PATTERN.sub(_replace, value)
    if isinstance(value, dict):
        return {k: _interpolate_env(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_interpolate_env(v) for v in value]
    return value


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


def build_service() -> tuple[AgentService, list[str]]:
    raw = _CONFIG_PATH.read_text(encoding="utf-8")
    data: dict = yaml.safe_load(raw) or {}

    # Extract the health_agent section before agent_kit validates the dict —
    # AgentKitConfig rejects unknown top-level keys.
    health_agent_raw = data.pop("health_agent", {})
    health_agent_cfg = _interpolate_env(health_agent_raw)
    models: list[str] = health_agent_cfg.get("models", [])  # type: ignore[assignment]

    cfg = AgentKitConfig.from_dict(data)
    service = AgentService.build(
        cfg,
        extra_tools=get_read_tools() + get_coaching_tools() + get_write_tools(),
        system_prompt_fn=_system_prompt_fn,
    )
    return service, models
