"""Bound incoming bodies including streamed multipart requests, before parsing."""

from starlette.datastructures import Headers
from starlette.responses import JSONResponse


class InputBoundary:
    def __init__(self, app, limit=3_000_000):
        self.app, self.limit = app, limit

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] not in ("POST", "PUT", "PATCH", "DELETE"):
            return await self.app(scope, receive, send)
        headers = Headers(scope=scope)

        async def fail(code, msg):
            return await JSONResponse({"detail": msg}, code)(scope, receive, send)

        if headers.get("x-causalytix-client") != "workspace":
            return await fail(403, "Use the workspace client.")
        size = headers.get("content-length")
        if size and (not size.isdecimal() or len(size) > 10 or int(size) > self.limit):
            return await fail(413, "Request exceeds 3 MB.")
        body = bytearray()
        while True:
            event = await receive()
            if event["type"] == "http.disconnect":
                return
            part = event.get("body", b"")
            if len(body) + len(part) > self.limit:
                return await fail(413, "Request exceeds 3 MB.")
            body.extend(part)
            if not event.get("more_body"):
                break
        sent = False

        async def replay():
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await self.app(scope, replay, send)
