"""M10 smoke tests — no tools yet, just verifies the service builds."""
from health_agent.service import build_service


def test_service_builds() -> None:
    """AgentService.from_yaml should return a service object without raising."""
    service = build_service()
    assert service is not None
