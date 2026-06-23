"""Shared httpx client for internal Next.js API calls. Populated in M11."""
import os
import httpx

INTERNAL_API_SECRET = os.environ.get("INTERNAL_API_SECRET", "")
NEXTJS_BASE_URL = os.environ.get("NEXTJS_BASE_URL", "http://localhost:3000")


class _LazyAsyncClient:
    """Wraps httpx.AsyncClient with lazy initialisation.

    Deferring construction until the first call avoids creating an SSL context
    at import time, which crashes on some Windows environments (OPENSSL_Uplink).
    """

    _client: httpx.AsyncClient | None = None

    def _get(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=NEXTJS_BASE_URL,
                headers={"X-Internal-Secret": INTERNAL_API_SECRET},
                timeout=30.0,
            )
        return self._client

    async def get(self, *args, **kwargs):
        return await self._get().get(*args, **kwargs)

    async def post(self, *args, **kwargs):
        return await self._get().post(*args, **kwargs)

    async def aclose(self):
        if self._client is not None:
            await self._client.aclose()


# Shared async client reused across tool handlers.
http_client = _LazyAsyncClient()
