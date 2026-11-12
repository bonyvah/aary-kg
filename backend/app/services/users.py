import itertools
import re
import uuid
from collections.abc import Container

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import password_policy
from app.errors import ApiError
from app.models.group import Group
from app.models.user import User
from app.repositories import groups as groups_repo
from app.repositories import users as repo
from app.schemas.user import NewStudent, ProposedStudent
from app.security import generate_password, hash_password

# Same rule as frontend/src/lib/adminUsers.ts
LOGIN_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{2,31}$")


# Who manages whom on the admin screen: create, disable, reset the password.
MANAGES: dict[str, tuple[str, ...]] = {"admin": ("teacher", "student"), "superadmin": ("admin",)}


async def list_managed(session: AsyncSession, viewer: User) -> list[User]:
    """Teachers and students; for the superadmin the admins too (the rest read-only). No superadmin."""
    roles = ("teacher", "student", "admin") if viewer.role == "superadmin" else ("teacher", "student")
    return await repo.list_managed(session, roles)


async def _student_group(session: AsyncSession, group_id: uuid.UUID | None) -> Group:
    if group_id is None:
        raise ApiError(400, "GROUP_REQUIRED", "groupId")
    group = await groups_repo.get(session, group_id)
    if not group:
        raise ApiError(404, "GROUP_NOT_FOUND", "groupId")
    return group


def _problems(first_name: str, last_name: str, login: str) -> list[tuple[str, str]]:
    """Everything wrong with cleaned names and a login, as (code, field), without asking the database."""
    problems: list[tuple[str, str]] = []
    if not first_name:
        problems.append(("FIELD_REQUIRED", "firstName"))
    elif len(first_name) > 60:
        problems.append(("VALIDATION_ERROR", "firstName"))
    if not last_name:
        problems.append(("FIELD_REQUIRED", "lastName"))
    elif len(last_name) > 60:
        problems.append(("VALIDATION_ERROR", "lastName"))
    if not login:
        problems.append(("FIELD_REQUIRED", "login"))
    elif not LOGIN_RE.match(login):
        problems.append(("LOGIN_INVALID", "login"))
    return problems


async def create_user(
    session: AsyncSession,
    first_name: str,
    last_name: str,
    login: str,
    role: str,
    group_id: uuid.UUID | None = None,
    password: str = "",
    actor: User | None = None,
) -> tuple[User, str]:
    """A teacher has no group; a student is in exactly one. A blank password is generated.
    From the admin screen (an actor): an admin makes teachers and students, the superadmin makes admins.
    The command line (no actor) makes any role."""
    if actor is not None and role not in MANAGES.get(actor.role, ()):
        raise ApiError(403, "FORBIDDEN")
    first_name, last_name = first_name.strip(), last_name.strip()
    login = login.strip().lower()
    for code, field in _problems(first_name, last_name, login):
        raise ApiError(400, code, field)
    if await repo.get_by_login(session, login):
        raise ApiError(409, "LOGIN_TAKEN", "login")
    if role == "student":
        group: Group | None = await _student_group(session, group_id)
    elif group_id is not None:
        raise ApiError(400, "VALIDATION_ERROR", "groupId")
    else:
        group = None
    if password:
        password_policy.check(
            password, first_name=first_name, last_name=last_name, login=login, field="password"
        )
    else:
        password = generate_password()
    user = User(
        first_name=first_name,
        last_name=last_name,
        login=login,
        role=role,
        group=group,
        password_hash=hash_password(password),
    )
    repo.add(session, user)
    try:
        await session.commit()
    except IntegrityError:  # two creates raced past the check above
        await session.rollback()
        raise ApiError(409, "LOGIN_TAKEN", "login") from None
    return user, password


def _free_login(login: str, taken: Container[str]) -> str:
    """The login, or with the first number that makes it free. Stays within the 32 characters."""
    if login not in taken:
        return login
    for number in itertools.count(2):
        suffix = str(number)
        candidate = login[: 32 - len(suffix)] + suffix
        if candidate not in taken:
            return candidate
    raise AssertionError


async def propose_students(session: AsyncSession, read: list[dict[str, str]]) -> list[ProposedStudent]:
    """What the model read, with logins that are valid and free. An invalid one is left blank.

    A login that got a number says whose it was: it may be the same person, already here.
    """
    holders = await repo.login_holders(session)
    proposed: list[ProposedStudent] = []
    for student in read:
        first_name, last_name = student["first_name"], student["last_name"]
        chosen = student["login"].strip().lower()
        login = _free_login(chosen, holders) if LOGIN_RE.match(chosen) else ""
        numbered = bool(login) and login != chosen
        proposed.append(
            ProposedStudent(
                first_name=first_name,
                last_name=last_name,
                login=login,
                taken_login=chosen if numbered else None,
                taken_by=holders[chosen] if numbered else None,
            )
        )
        if login:
            holders[login] = f"{first_name} {last_name}"
    return proposed


async def create_students(
    session: AsyncSession, group_id: uuid.UUID | None, password: str, students: list[NewStudent]
) -> list[User]:
    """All of them or none, in one group, with the one password the admin chose."""
    group = await _student_group(session, group_id)
    if not password:
        raise ApiError(400, "FIELD_REQUIRED", "password")
    taken = await repo.all_logins(session)
    issues: list[dict[str, str]] = []
    cleaned: list[tuple[str, str, str]] = []
    for index, student in enumerate(students):
        first_name, last_name = student.first_name.strip(), student.last_name.strip()
        login = student.login.strip().lower()
        problems = _problems(first_name, last_name, login)
        if login in taken:
            problems.append(("LOGIN_TAKEN", "login"))
        taken.add(login)
        issues.extend({"code": code, "field": f"students.{index}.{field}"} for code, field in problems)
        cleaned.append((first_name, last_name, login))
    if issues:
        raise ApiError(400, "STUDENTS_INVALID", issues=issues)
    for first_name, last_name, login in cleaned:
        password_policy.check(
            password, first_name=first_name, last_name=last_name, login=login, field="password"
        )
    # One hash for one password: hashing it again per student would hold the request for minutes.
    password_hash = hash_password(password)
    users = [
        User(
            first_name=first_name,
            last_name=last_name,
            login=login,
            role="student",
            group=group,
            password_hash=password_hash,
        )
        for first_name, last_name, login in cleaned
    ]
    for user in users:
        repo.add(session, user)
    try:
        await session.commit()
    except IntegrityError:  # a create raced past the check above
        await session.rollback()
        taken = await repo.all_logins(session)
        issues = [
            {"code": "LOGIN_TAKEN", "field": f"students.{index}.login"}
            for index, (_, _, login) in enumerate(cleaned)
            if login in taken
        ]
        if issues:
            raise ApiError(400, "STUDENTS_INVALID", issues=issues) from None
        raise ApiError(409, "LOGIN_TAKEN") from None
    return users


async def _get(session: AsyncSession, user_id: uuid.UUID) -> User:
    user = await repo.get(session, user_id)
    if not user:
        raise ApiError(404, "USER_NOT_FOUND")
    return user


async def disable(session: AsyncSession, actor: User, user_id: uuid.UUID) -> User:
    """For good: there is no way back, and a disabled account is not listed to the admin."""
    user = await _get(session, user_id)
    if user.id == actor.id:
        raise ApiError(400, "CANNOT_DISABLE_SELF")
    _check_target(actor, user)
    user.active = False
    await session.commit()
    return user


async def move_to_group(session: AsyncSession, user_id: uuid.UUID, group_id: uuid.UUID | None) -> User:
    """Students only: from one group to another. They are never left without one."""
    user = await _get(session, user_id)
    if user.role != "student":
        raise ApiError(400, "NOT_A_STUDENT")
    user.group = await _student_group(session, group_id)
    try:
        await session.commit()
    except IntegrityError:  # the group was deleted meanwhile
        await session.rollback()
        raise ApiError(404, "GROUP_NOT_FOUND", "groupId") from None
    return user


def _check_target(actor: User, user: User) -> None:
    """Admins manage teachers and students, the superadmin manages admins. Nobody manages a superadmin."""
    if user.role not in MANAGES.get(actor.role, ()):
        raise ApiError(403, "CANNOT_MANAGE_ADMIN")


async def reset_password(session: AsyncSession, actor: User, user_id: uuid.UUID, password: str = "") -> str:
    """A blank password is generated."""
    user = await _get(session, user_id)
    _check_target(actor, user)
    if password:
        password_policy.check(
            password, first_name=user.first_name, last_name=user.last_name, login=user.login, field="password"
        )
    else:
        password = generate_password()
    user.password_hash = hash_password(password)
    user.token_version += 1  # every open session of this user ends
    await session.commit()
    return password
