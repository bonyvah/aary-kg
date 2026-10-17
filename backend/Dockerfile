# The backend: FastAPI + uvicorn. Build context is ./backend.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PROJECT_ENVIRONMENT=/opt/venv

RUN pip install --no-cache-dir uv

WORKDIR /app

# Dependencies first, from the lockfile, without the test tools: this layer is cached until the
# dependencies change.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

RUN useradd --system --no-create-home --uid 10001 aary
USER aary
ENV PATH="/opt/venv/bin:$PATH"

EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD python -c "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3).status == 200 else 1)"

# Migrations run on start (one backend container: with several, start one first). Always
# --no-proxy-headers: uvicorn's own X-Forwarded-For handling would let clients invent their address
# (see backend/app/netutil.py). The app reads the header itself, as AARY_TRUSTED_PROXY_HOPS says.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --no-proxy-headers"]
