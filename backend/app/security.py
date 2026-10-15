import secrets
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.config import get_settings

_hasher = PasswordHasher()
# Used to keep login timing the same when the login does not exist.
DUMMY_HASH = _hasher.hash("not-a-real-password")

# Same unambiguous alphabet as the frontend (no 0/O, 1/l/I).
PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(hashed: str, password: str) -> bool:
    try:
        return _hasher.verify(hashed, password)
    except (VerificationError, InvalidHashError):
        return False


def generate_password() -> str:
    """Three groups of 4, like k7Tm-Qp3x-Zs9w. secrets.choice is unbiased."""
    groups = ("".join(secrets.choice(PASSWORD_ALPHABET) for _ in range(4)) for _ in range(3))
    return "-".join(groups)


def create_token(user_id: str) -> str:
    s = get_settings()
    exp = datetime.now(UTC) + timedelta(minutes=s.jwt_ttl_minutes)
    return jwt.encode({"sub": user_id, "exp": exp}, s.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> str | None:
    try:
        data = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    sub = data.get("sub")
    return sub if isinstance(sub, str) else None
