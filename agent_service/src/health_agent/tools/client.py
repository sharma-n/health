"""Shared httpx client for internal Next.js API calls. Populated in M11."""
import os
import httpx

INTERNAL_API_SECRET = os.environ.get("INTERNAL_API_SECRET", "")
NEXTJS_BASE_URL = os.environ.get("NEXTJS_BASE_URL", "http://localhost:3000")

# Shared async client reused across tool handlers.
http_client = httpx.AsyncClient(
    base_url=NEXTJS_BASE_URL,
    headers={"X-Internal-Secret": INTERNAL_API_SECRET},
    timeout=30.0,
)
