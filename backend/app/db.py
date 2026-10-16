from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

# A serverless Postgres (Neon) suspends when idle and closes its connections: test a pooled connection
# before using it (this also wakes the database), and give a waking database time to answer.
engine = create_async_engine(
    get_settings().database_url,
    pool_pre_ping=True,
    pool_recycle=240,
    connect_args={"timeout": 30},
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
