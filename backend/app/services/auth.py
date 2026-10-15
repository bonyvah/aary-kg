import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ApiError
from app.game import ratelimit
from app.models.user import User
from app.redis import get_redis
from app.repositories import users as repo
from app.security import DUMMY_HASH, decode_token, verify_password

# Per address: every attempt counts, so one machine can't try many logins quickly.
IP_LIMIT, IP_WINDOW_S = 20, 10 * 60
# Per login: only failed attempts count. Eight wrong passwords lock that login for 15 minutes,
# even for the right password. (The price: someone can lock another person's login out for a
# while. For a handful of staff accounts that beats unlimited guessing.)
FAIL_LIMIT, FAIL_WINDOW_S = 8, 15 * 60


async def authenticate(session: AsyncSession, login: str, password: str, ip: str) -> User:
    login = login.strip().lower()
    if not login or not password:
        raise ApiError(400, "CREDENTIALS_REQUIRED")
    redis = get_redis()
    if not await ratelimit.allow(redis, f"rl:login-ip:{ip}", IP_LIMIT, IP_WINDOW_S):
        raise ApiError(429, "RATE_LIMITED")
    fail_key = f"rl:login-fail:{login}"
    if int(await redis.get(fail_key) or 0) >= FAIL_LIMIT:
        raise ApiError(429, "RATE_LIMITED")

    user = await repo.get_by_login(session, login)
    ok = verify_password(user.password_hash if user else DUMMY_HASH, password)
    if not user or not ok or not user.active:
        await ratelimit.allow(redis, fail_key, FAIL_LIMIT, FAIL_WINDOW_S)  # counts this failure
        raise ApiError(401, "INVALID_CREDENTIALS")
    await redis.delete(fail_key)
    return user


async def user_from_token(session: AsyncSession, token: str | None) -> User | None:
    """The signed-in user a session token stands for, or None.

    Checked against the database on every request, so disabling a user, or resetting their password
    (which bumps `token_version`), ends their sessions at once instead of when the token expires.
    """
    claims = decode_token(token) if token else None
    if claims is None:
        return None
    try:
        user = await repo.get(session, uuid.UUID(claims.sub))
    except ValueError:
        return None
    if user is None or not user.active or user.token_version != claims.ver:
        return None
    return user
