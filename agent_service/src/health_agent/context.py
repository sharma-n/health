"""Per-request context variables for the health agent sidecar."""
from contextvars import ContextVar

# IANA timezone for the current user's request (e.g. "America/New_York").
# Set in main.py from X-User-Timezone header before each turn; read in
# service.py (system prompt) and tools that need correct date/day-of-week.
user_timezone: ContextVar[str] = ContextVar("user_timezone", default="UTC")
