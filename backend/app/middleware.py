"""Two small ASGI middlewares: a request size limit and safe default response headers.

Written as plain ASGI (not Starlette's BaseHTTPMiddleware) so they cost almost nothing and leave
WebSockets alone.
"""

from starlette.exceptions import HTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

# The biggest legitimate request is a quiz of 100 questions: well under this.
MAX_BODY_BYTES = 256 * 1024
# Except an uploaded teaching material (10 MB, plus the form around it).
LARGE_BODY_PATHS = {"/ai/questions": 11 * 1024 * 1024}

# Responses under these paths hold private data: no browser or proxy cache may keep them.
PRIVATE_PREFIXES = (
    "/auth",
    "/admin",
    "/games",
    "/quizzes",
    "/contests",
    "/users",
    "/exams",
    "/exam-sessions",
    "/student",
    "/ai",
)


class BodyLimitMiddleware:
    def __init__(self, app: ASGIApp, max_bytes: int = MAX_BODY_BYTES) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def _reject(self, send: Send) -> None:
        body = b'{"code":"PAYLOAD_TOO_LARGE","field":null}'
        headers = [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]
        await send({"type": "http.response.start", "status": 413, "headers": headers})
        await send({"type": "http.response.body", "body": body})

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        max_bytes = LARGE_BODY_PATHS.get(scope["path"], self.max_bytes)
        declared = dict(scope["headers"]).get(b"content-length", b"")
        if declared.isdigit() and int(declared) > max_bytes:
            return await self._reject(send)  # refused before reading a byte

        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > max_bytes:  # no Content-Length, or it lied
                    # FastAPI passes an HTTPException through; any other error becomes a 400.
                    raise HTTPException(413)
            return message

        await self.app(scope, limited_receive, send)


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        private = scope["path"].startswith(PRIVATE_PREFIXES)

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                present = {name.lower() for name, _ in headers}
                headers.append((b"x-content-type-options", b"nosniff"))
                if private and b"cache-control" not in present:
                    headers.append((b"cache-control", b"no-store"))
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_with_headers)
