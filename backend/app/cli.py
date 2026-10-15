"""Management commands. First admin: python -m app.cli create-admin --login aizhan --name "Name"."""

import argparse
import asyncio

from app.db import SessionLocal, engine
from app.errors import ApiError
from app.services import users as service


async def create_admin(login: str, name: str) -> int:
    async with SessionLocal() as session:
        try:
            _, password = await service.create_user(session, name, login, "admin")
        except ApiError as e:
            print(f"error: {e.code}" + (f" ({e.field})" if e.field else ""))
            return 1
    print(f"Admin created. Login: {login}\nPassword (shown once): {password}")
    await engine.dispose()
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(prog="app.cli")
    sub = parser.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("create-admin")
    p.add_argument("--login", required=True)
    p.add_argument("--name", required=True)
    args = parser.parse_args()
    raise SystemExit(asyncio.run(create_admin(args.login, args.name)))


if __name__ == "__main__":
    main()
