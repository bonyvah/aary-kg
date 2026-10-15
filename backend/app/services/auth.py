import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import password_policy
from app.errors import ApiError
from app.game import ratelimit
from app.models.user import User
from app.redis import get_redis
from app.repositories import users as repo
from app.security import DUMMY_HASH, decode_token, hash_password, verify_password
from app.services import users as users_service

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


async def _confirm_password(user: User, password: str) -> None:
    """Changing the login or password needs the current password again, and guessing it is limited."""
    redis = get_redis()
    key = f"rl:account-fail:{user.id}"
    if int(await redis.get(key) or 0) >= FAIL_LIMIT:
        raise ApiError(429, "RATE_LIMITED")
    if not verify_password(user.password_hash, password):
        await ratelimit.allow(redis, key, FAIL_LIMIT, FAIL_WINDOW_S)
        raise ApiError(400, "CURRENT_PASSWORD_WRONG", "currentPassword")
    await redis.delete(key)


async def change_login(session: AsyncSession, user: User, current_password: str, login: str) -> User:
    await _confirm_password(user, current_password)
    login = login.strip().lower()
    if not login:
        raise ApiError(400, "FIELD_REQUIRED", "login")
    if not users_service.LOGIN_RE.match(login):
        raise ApiError(400, "LOGIN_INVALID", "login")
    if login == user.login:
        raise ApiError(400, "NOTHING_TO_CHANGE", "login")
    if await repo.get_by_login(session, login):
        raise ApiError(409, "LOGIN_TAKEN", "login")
    user.login = login
    try:
        await session.commit()
    except IntegrityError:  # two changes raced past the check above
        await session.rollback()
        raise ApiError(409, "LOGIN_TAKEN", "login") from None
    return user


async def change_password(
    session: AsyncSession, user: User, current_password: str, new_password: str
) -> User:
    """Sets a new password and ends every other session of this user (the caller gets a fresh cookie)."""
    await _confirm_password(user, current_password)
    password_policy.check(
        new_password, first_name=user.first_name, last_name=user.last_name, login=user.login
    )
    if new_password == current_password:
        raise ApiError(400, "PASSWORD_SAME", "newPassword")
    user.password_hash = hash_password(new_password)
    user.token_version += 1
    await session.commit()
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
