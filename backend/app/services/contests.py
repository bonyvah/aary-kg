import math
import uuid
from collections import defaultdict
from collections.abc import Iterable, Mapping, Sequence
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ApiError
from app.models.contest import Contest, ContestJury, ContestScore
from app.models.user import User
from app.repositories import contests as repo
from app.repositories import users as users_repo
from app.schemas.contest import ContestIn, ContestOut, ResultsOut
from app.services import contest_scoring as scoring

# --- validation: the same rules as validateContest in frontend/src/lib/contestScoring.ts -------


def find_issues(
    title: str,
    criteria: Sequence[Mapping[str, Any]],
    entries: Sequence[Mapping[str, Any]],
    jury_count: int,
) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []
    if not title.strip():
        issues.append({"code": "FIELD_REQUIRED", "field": "title"})

    if not criteria:
        issues.append({"code": "CRITERIA_REQUIRED", "field": "criteria"})
    else:
        for c in criteria:
            if not str(c["name"]).strip():
                issues.append({"code": "FIELD_REQUIRED", "field": f"criterion:{c['id']}:name"})
        weights = [float(c["weight"]) for c in criteria]
        each_valid = all(math.isfinite(w) and w.is_integer() and 1 <= w <= 100 for w in weights)
        if sum(weights) != 100 or not each_valid:
            issues.append({"code": "WEIGHTS_NOT_100", "field": "criteria"})

    if not entries:
        issues.append({"code": "ENTRIES_REQUIRED", "field": "entries"})
    else:
        for e in entries:
            if not str(e["name"]).strip():
                issues.append({"code": "FIELD_REQUIRED", "field": f"entry:{e['id']}:name"})

    if jury_count == 0:
        issues.append({"code": "JURY_REQUIRED", "field": "jury"})
    return issues


def _raise_if(issues: list[dict[str, str]]) -> None:
    if issues:
        raise ApiError(400, "CONTEST_INVALID", issues=issues)


# --- permissions ---------------------------------------------------------------------------


def is_jury(contest: Contest, user: User) -> bool:
    return any(j.user_id == user.id for j in contest.jury)


def can_manage(contest: Contest, user: User) -> bool:
    return user.role == "admin" or contest.owner_id == user.id


def _visible(contest: Contest, user: User) -> bool:
    return can_manage(contest, user) or is_jury(contest, user)


async def get_visible(
    session: AsyncSession, user: User, contest_id: uuid.UUID, *, lock: bool = False
) -> Contest:
    """Owner, jury and admins. Anyone else gets the same answer as for a missing contest."""
    contest = await repo.get(session, contest_id, lock=lock)
    if not contest or not _visible(contest, user):
        raise ApiError(404, "CONTEST_NOT_FOUND")
    return contest


# --- output --------------------------------------------------------------------------------


def _sheet(scores: Iterable[ContestScore]) -> dict[str, dict[str, dict[str, int]]]:
    out: dict[str, dict[str, dict[str, int]]] = {}
    for s in scores:
        out.setdefault(str(s.user_id), {}).setdefault(s.entry_id, {})[s.criterion_id] = s.score
    return out


async def to_out(session: AsyncSession, contests: Sequence[Contest], viewer: User) -> list[ContestOut]:
    """Each contest carries the viewer's own scores only. Others' scores never leave the server."""
    mine = await repo.scores_of(session, [c.id for c in contests], viewer.id) if contests else []
    by_contest: dict[uuid.UUID, list[ContestScore]] = defaultdict(list)
    for s in mine:
        by_contest[s.contest_id].append(s)
    return [
        ContestOut.model_validate(
            {
                "id": c.id,
                "title": c.title,
                "description": c.description,
                "status": c.status,
                "ownerId": c.owner_id,
                "ownerName": c.owner.name,
                "criteria": c.criteria,
                "entries": c.entries,
                "jury": [{"userId": j.user_id, "name": j.user.name, "finished": j.finished} for j in c.jury],
                "scores": _sheet(by_contest[c.id]),
            }
        )
        for c in contests
    ]


# --- actions -------------------------------------------------------------------------------


async def create(session: AsyncSession, owner: User, payload: ContestIn) -> Contest:
    if owner.role == "admin":
        raise ApiError(403, "FORBIDDEN")  # admins manage contests, they don't run their own
    jury_ids = list(dict.fromkeys(payload.jury_ids))  # no duplicates, keeps the picked order
    _raise_if(
        find_issues(
            payload.title,
            [c.model_dump() for c in payload.criteria],
            [e.model_dump() for e in payload.entries],
            len(jury_ids),
        )
    )
    users = {u.id: u for u in await users_repo.get_many_active(session, jury_ids)}
    if len(users) != len(jury_ids):
        raise ApiError(400, "USER_NOT_FOUND", "jury")

    contest = Contest(
        owner_id=owner.id,
        title=payload.title.strip(),
        description=payload.description.strip(),
        status="draft",
        # The form's ids were only for reporting issues. Stored ids are the server's.
        criteria=[
            {"id": uuid.uuid4().hex, "name": c.name.strip(), "weight": int(c.weight)}
            for c in payload.criteria
        ],
        entries=[
            {"id": uuid.uuid4().hex, "name": e.name.strip(), "description": e.description.strip()}
            for e in payload.entries
        ],
        jury=[ContestJury(user_id=uid, position=i, finished=False) for i, uid in enumerate(jury_ids)],
    )
    session.add(contest)
    await session.commit()
    return await _reload(session, contest.id)


async def _reload(session: AsyncSession, contest_id: uuid.UUID) -> Contest:
    contest = await repo.get(session, contest_id, fresh=True)
    assert contest is not None
    return contest


async def open_contest(session: AsyncSession, user: User, contest_id: uuid.UUID) -> Contest:
    contest = await get_visible(session, user, contest_id, lock=True)
    if not can_manage(contest, user):
        raise ApiError(403, "FORBIDDEN")
    if contest.status != "draft":
        raise ApiError(409, "CONTEST_NOT_DRAFT")
    _raise_if(find_issues(contest.title, contest.criteria, contest.entries, len(contest.jury)))
    contest.status = "open"
    await session.commit()
    return await _reload(session, contest_id)


async def close_contest(session: AsyncSession, user: User, contest_id: uuid.UUID) -> Contest:
    contest = await get_visible(session, user, contest_id, lock=True)
    if not can_manage(contest, user):
        raise ApiError(403, "FORBIDDEN")
    if contest.status != "open":
        raise ApiError(409, "CONTEST_NOT_OPEN")
    contest.status = "closed"
    await session.commit()
    return await _reload(session, contest_id)


def _require_scoring(contest: Contest, user: User) -> None:
    if not is_jury(contest, user):
        raise ApiError(403, "FORBIDDEN")
    if contest.status != "open":
        raise ApiError(409, "CONTEST_NOT_OPEN")


async def set_score(
    session: AsyncSession,
    user: User,
    contest_id: uuid.UUID,
    entry_id: str,
    criterion_id: str,
    score: int,
) -> None:
    contest = await get_visible(session, user, contest_id, lock=True)
    _require_scoring(contest, user)
    if entry_id not in {e["id"] for e in contest.entries}:
        raise ApiError(404, "ENTRY_NOT_FOUND")
    if criterion_id not in {c["id"] for c in contest.criteria}:
        raise ApiError(404, "CRITERION_NOT_FOUND")
    await repo.upsert_score(session, contest.id, user.id, entry_id, criterion_id, score)
    await session.commit()


async def finish(session: AsyncSession, user: User, contest_id: uuid.UUID) -> Contest:
    """Marks the jury member done. Their scores stay editable until the contest closes."""
    contest = await get_visible(session, user, contest_id, lock=True)
    _require_scoring(contest, user)
    sheets = _sheets(await repo.scores_of(session, [contest.id], user.id))
    for entry in contest.entries:
        if scoring.juror_entry_score(contest.criteria, sheets.get((str(user.id), entry["id"]))) is None:
            raise ApiError(409, "SCORING_INCOMPLETE")
    for member in contest.jury:
        if member.user_id == user.id:
            member.finished = True
    await session.commit()
    return await _reload(session, contest_id)


def _sheets(scores: Iterable[ContestScore]) -> dict[tuple[str, str], dict[str, int]]:
    out: dict[tuple[str, str], dict[str, int]] = {}
    for s in scores:
        out.setdefault((str(s.user_id), s.entry_id), {})[s.criterion_id] = s.score
    return out


async def results(session: AsyncSession, user: User, contest_id: uuid.UUID) -> ResultsOut:
    contest = await get_visible(session, user, contest_id)
    if contest.status != "closed":
        raise ApiError(409, "CONTEST_NOT_CLOSED")
    sheets = _sheets(await repo.scores_of(session, [contest.id]))
    finished = [(str(j.user_id), j.user.name) for j in contest.jury if j.finished]
    ranking = scoring.rank_entries(contest.criteria, contest.entries, [u for u, _ in finished], sheets)
    breakdown = None
    if can_manage(contest, user):
        breakdown = {
            e["id"]: scoring.entry_breakdown(contest.criteria, e["id"], finished, sheets)
            for e in contest.entries
        }
    return ResultsOut.model_validate({"ranking": ranking, "breakdown": breakdown})
