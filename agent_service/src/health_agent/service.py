"""Builds the AgentService singleton from config.yaml."""
from pathlib import Path
from agent_kit.config import AgentKitConfig
from agent_kit.service import AgentService
from health_agent.tools.read_tools import get_read_tools

_CONFIG_PATH = Path(__file__).parent.parent.parent / "config.yaml"


def build_service() -> AgentService:
    cfg = AgentKitConfig.from_yaml(str(_CONFIG_PATH))
    return AgentService.build(cfg, extra_tools=get_read_tools())
