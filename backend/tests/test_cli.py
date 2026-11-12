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


async def test_create_superadmin_cli(capsys):
    from app.cli import create_superadmin

    assert await create_superadmin("boss", "Boss", "Super") == 0
    assert "Superadmin created" in capsys.readouterr().out
    async with SessionLocal() as s:
        u = await repo.get_by_login(s, "boss")
        assert u and u.role == "superadmin"
