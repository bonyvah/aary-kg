from app.cli import create_admin
from app.db import SessionLocal
from app.repositories import users as repo


async def test_create_admin_cli(capsys):
    assert await create_admin("first", "First", "Admin") == 0
    assert "Password (shown once)" in capsys.readouterr().out
    async with SessionLocal() as s:
        u = await repo.get_by_login(s, "first")
        assert u and u.role == "admin"
    assert await create_admin("first", "Again", "Admin") == 1
