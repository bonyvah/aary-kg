"""Management commands.

Superadmin: python -m app.cli create-superadmin --login aizhan --first-name Aizhan --last-name Bekova
Admin:      python -m app.cli create-admin --login aizhan --first-name Aizhan --last-name Bekova
"""

import argparse
import asyncio

from app.db import SessionLocal, engine
from app.errors import ApiError
from app.services import users as service

LABELS = {"admin": "Admin", "superadmin": "Superadmin"}


async def _create(role: str, login: str, first_name: str, last_name: str) -> int:
    async with SessionLocal() as session:
        try:
            _, password = await service.create_user(session, first_name, last_name, login, role)
        except ApiError as e:
            print(f"error: {e.code}" + (f" ({e.field})" if e.field else ""))
            return 1
    print(f"{LABELS[role]} created. Login: {login}\nPassword (shown once): {password}")
    await engine.dispose()
    return 0


async def create_admin(login: str, first_name: str, last_name: str) -> int:
    return await _create("admin", login, first_name, last_name)


async def create_superadmin(login: str, first_name: str, last_name: str) -> int:
    return await _create("superadmin", login, first_name, last_name)


COMMANDS = {"create-admin": create_admin, "create-superadmin": create_superadmin}


def main() -> None:
    parser = argparse.ArgumentParser(prog="app.cli")
    sub = parser.add_subparsers(dest="cmd", required=True)
    for name in COMMANDS:
        p = sub.add_parser(name)
        p.add_argument("--login", required=True)
        p.add_argument("--first-name", required=True)
        p.add_argument("--last-name", required=True)
    args = parser.parse_args()
    command = COMMANDS[args.cmd]
    raise SystemExit(asyncio.run(command(args.login, args.first_name, args.last_name)))


if __name__ == "__main__":
    main()
