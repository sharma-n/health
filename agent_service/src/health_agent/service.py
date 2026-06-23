"""Builds the AgentService singleton from config.yaml."""
from pathlib import Path
from agent_kit.service import AgentService

_CONFIG_PATH = Path(__file__).parent.parent.parent / "config.yaml"


def build_service() -> AgentService:
    return AgentService.from_yaml(str(_CONFIG_PATH))
