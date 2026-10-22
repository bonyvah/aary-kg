"""Who reaches the staff endpoints: teachers own quizzes, games and contests, admins only manage, and any
other role (students, later) is refused everywhere a teacher or an admin works."""

import uuid

from httpx import ASGITransport, AsyncClient

from app.deps import COOKIE_NAME
from app.main import app
from app.security import create_token
from tests.conftest import make_user

STAFF_GETS = ["/quizzes", "/contests", "/games", "/users/directory"]


async def test_another_role_is_refused_on_every_staff_endpoint():
    other = await make_user("aizada", role="student")
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies={COOKIE_NAME: create_token(str(other.id))},
    ) as c:
        for path in STAFF_GETS:
            r = await c.get(path)
            assert (r.status_code, r.json()["code"]) == (403, "FORBIDDEN"), path
        r = await c.post("/games", json={"quizId": str(uuid.uuid4())})
        assert r.status_code == 403
        r = await c.get(f"/contests/{uuid.uuid4()}")
        assert r.status_code == 403


async def test_a_teacher_reaches_them(as_user):
    c, _ = await as_user("ulan")
    for path in STAFF_GETS:
        assert (await c.get(path)).status_code == 200, path


async def test_only_a_teacher_creates_quizzes_games_and_contests(as_user):
    admin, _ = await as_user("root", role="admin")
    for path in STAFF_GETS:
        assert (await admin.get(path)).status_code == 200, path
    for path, body in (("/quizzes", {}), ("/games", {"quizId": str(uuid.uuid4())}), ("/contests", {})):
        r = await admin.post(path, json=body)
        assert (r.status_code, r.json()["code"]) == (403, "FORBIDDEN"), path
