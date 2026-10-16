import secrets
from datetime import UTC, datetime, timedelta
from typing import NamedTuple

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
    while True:
        groups = ("".join(secrets.choice(PASSWORD_ALPHABET) for _ in range(4)) for _ in range(3))
        password = "-".join(groups)
        # It has to pass the same rule as a chosen password: a digit, and (always) letters.
        if any(ch.isdigit() for ch in password):
            return password


class TokenClaims(NamedTuple):
    sub: str
    ver: int


def create_token(user_id: str, version: int = 0) -> str:
    s = get_settings()
    exp = datetime.now(UTC) + timedelta(minutes=s.jwt_ttl_minutes)
    return jwt.encode({"sub": user_id, "ver": version, "exp": exp}, s.jwt_secret, algorithm="HS256")


PLAYER_TTL = timedelta(hours=12)
# A host ticket opens one host socket. Short: the page asks for a fresh one before every connect.
HOST_TICKET_TTL = timedelta(seconds=60)


class HostTicket(NamedTuple):
    sub: str
    ver: int
    gid: str


def create_host_ticket(user_id: str, version: int, game_id: str) -> str:
    """Proves the host on the host socket. The socket can't rely on the session cookie: when the web
    app and the backend live on different sites, the browser does not send it there."""
    exp = datetime.now(UTC) + HOST_TICKET_TTL
    claims = {"k": "host", "sub": user_id, "ver": version, "gid": game_id, "exp": exp}
    return jwt.encode(claims, get_settings().jwt_secret, algorithm="HS256")


def decode_host_ticket(ticket: str) -> HostTicket | None:
    try:
        data = jwt.decode(ticket, get_settings().jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    sub, ver, gid = data.get("sub"), data.get("ver"), data.get("gid")
    if data.get("k") != "host" or not isinstance(sub, str) or not isinstance(gid, str):
        return None
    if not isinstance(ver, int) or isinstance(ver, bool):
        return None
    return HostTicket(sub, ver, gid)


def create_player_token(game_id: str, player_id: str) -> str:
    """Good for one player in one game, and nothing else: it has no `sub`, so staff routes refuse it."""
    exp = datetime.now(UTC) + PLAYER_TTL
    claims = {"k": "player", "gid": game_id, "pid": player_id, "exp": exp}
    return jwt.encode(claims, get_settings().jwt_secret, algorithm="HS256")


def decode_player_token(token: str) -> tuple[str, str] | None:
    try:
        data = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    gid, pid = data.get("gid"), data.get("pid")
    if data.get("k") != "player" or not isinstance(gid, str) or not isinstance(pid, str):
        return None
    return gid, pid


def decode_token(token: str) -> TokenClaims | None:
    try:
        data = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    sub, ver = data.get("sub"), data.get("ver", 0)
    if "k" in data:  # a player token or a host ticket, not a staff session
        return None
    if not isinstance(sub, str) or not isinstance(ver, int) or isinstance(ver, bool):
        return None
    return TokenClaims(sub, ver)
