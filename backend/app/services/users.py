import itertools
import re
import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import password_policy
from app.errors import ApiError
from app.models.group import Group
from app.models.user import User
from app.repositories import groups as groups_repo
from app.repositories import users as repo
from app.schemas.user import ProposedStudent
from app.security import generate_password, hash_password

# Same rule as frontend/src/lib/adminUsers.ts
LOGIN_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{2,31}$")


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
) -> tuple[User, str]:
    """A teacher has no group; a student is in exactly one. A blank password is generated."""
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


def _free_login(login: str, taken: set[str]) -> str:
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
    """What the model read, with logins that are valid and free. An invalid one is left blank."""
    taken = await repo.all_logins(session)
    proposed: list[ProposedStudent] = []
    for student in read:
        login = student["login"].strip().lower()
        login = _free_login(login, taken) if LOGIN_RE.match(login) else ""
        if login:
            taken.add(login)
        proposed.append(
            ProposedStudent(first_name=student["first_name"], last_name=student["last_name"], login=login)
        )
    return proposed


async def create_students(
    session: AsyncSession, group_id: uuid.UUID | None, password: str, students: list[ProposedStudent]
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
        raise ApiError(409, "LOGIN_TAKEN") from None
    return users


async def _get(session: AsyncSession, user_id: uuid.UUID) -> User:
    user = await repo.get(session, user_id)
    if not user:
        raise ApiError(404, "USER_NOT_FOUND")
    return user


async def set_active(session: AsyncSession, actor: User, user_id: uuid.UUID, active: bool) -> User:
    user = await _get(session, user_id)
    if user.id == actor.id and not active:
        raise ApiError(400, "CANNOT_DISABLE_SELF")
    _not_an_admin(user)
    user.active = active
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


def _not_an_admin(user: User) -> None:
    """Admins manage teachers and students. Another admin can't be disabled or reset from here."""
    if user.role == "admin":
        raise ApiError(403, "CANNOT_MANAGE_ADMIN")


async def reset_password(session: AsyncSession, user_id: uuid.UUID, password: str = "") -> str:
    """A blank password is generated."""
    user = await _get(session, user_id)
    _not_an_admin(user)
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
