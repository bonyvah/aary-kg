import asyncio

from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context
from app import models  # noqa: F401  (registers tables on Base.metadata)
from app.config import get_settings
from app.db import Base

target_metadata = Base.metadata


def _run(connection) -> None:  # type: ignore[no-untyped-def]
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def _main() -> None:
    engine = create_async_engine(get_settings().database_url)
    async with engine.connect() as conn:
        await conn.run_sync(_run)
    await engine.dispose()


asyncio.run(_main())
