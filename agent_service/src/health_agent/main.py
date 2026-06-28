"""FastAPI entry point for the health agent sidecar."""
import json
import logging
import os
import traceback
from contextlib import asynccontextmanager
from typing import AsyncIterator, Any

from dotenv import find_dotenv, load_dotenv
load_dotenv(find_dotenv(usecwd=True))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agent_kit.service import AgentService
from agent_kit.agent.events import TextDelta, ToolCallStarted, ToolResult, TurnComplete

from health_agent.service import build_service
from health_agent.context import user_timezone

_service: AgentService | None = None
_INTERNAL_SECRET = os.environ.get("INTERNAL_API_SECRET", "")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    global _service
    logger.info("INTERNAL_API_SECRET configured: %s", bool(_INTERNAL_SECRET))
    _service = build_service()
    await _service.astart()
    yield
    await _service.aclose()


app = FastAPI(title="Health Agent", lifespan=lifespan)


class TurnRequest(BaseModel):
    message: str
    conversation_id: str


def _check_secret(secret: str | None) -> None:
    if not _INTERNAL_SECRET:
        raise HTTPException(status_code=500, detail="INTERNAL_API_SECRET not configured")
    if secret != _INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")


def _encode_event(event: Any) -> dict:
    if isinstance(event, TextDelta):
        return {"type": "text", "text": event.text}
    if isinstance(event, ToolCallStarted):
        return {
            "type": "tool_call",
            "call_id": event.call_id,
            "name": event.name,
            "arguments": json.dumps(event.arguments),
        }
    if isinstance(event, ToolResult):
        return {
            "type": "tool_result",
            "call_id": event.call_id,
            "name": event.name,
            "ok": event.ok,
            "content": event.content,
        }
    if isinstance(event, TurnComplete):
        return {
            "type": "turn_complete",
            "iterations": event.iterations,
            "stop_reason": event.stop_reason,
        }
    return {"type": "unknown", "data": str(event)}


async def _event_stream(user_id: str, request: TurnRequest) -> AsyncIterator[str]:
    assert _service is not None
    try:
        async for event in _service.agent.run_turn(
            user_id, request.conversation_id, request.message
        ):
            yield f"data: {json.dumps(_encode_event(event))}\n\n"
    except Exception:
        logger.error("Error in event stream:\n%s", traceback.format_exc())
        raise


@app.post("/v1/turn")
async def turn(
    request: TurnRequest,
    x_internal_secret: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None),
    x_user_timezone: str | None = Header(default=None),
) -> StreamingResponse:
    _check_secret(x_internal_secret)
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header required")

    # Store timezone in context variable so service.py and tools can read it
    # without needing it threaded through every function signature.
    user_timezone.set(x_user_timezone or "UTC")

    return StreamingResponse(
        _event_stream(x_user_id, request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/v1/user-facts")
async def get_user_facts(
    x_internal_secret: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None),
) -> dict:
    _check_secret(x_internal_secret)
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header required")
    assert _service is not None
    profile = await _service.stores.profile.get(x_user_id)
    return {"facts": profile.facts, "updated_at": profile.updated_at}


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
