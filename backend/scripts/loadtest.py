"""Plays a whole game with many players against a running server and reports how it held up.

    uv run python scripts/loadtest.py --login aizhan --password '...' [--players 60] [--questions 5]

Needs a running stack (backend, Postgres, Redis) and the login of a regular
user (an admin cannot host games). Point --base at the backend
(http://localhost:8000) or at the web app (http://localhost:3000 with
--prefix /api).

Rate limits would stop one machine pretending to be 60 phones (30 joins a minute per address), so
start the server under test with AARY_TRUSTED_PROXY_HOPS=1: this script then sends a different
X-Forwarded-For for every player, like 60 phones behind a proxy would.

It checks: everyone gets in, every question reaches every player, every answer is acknowledged,
the question closes once everybody has answered, every player's final score is possible for what
they answered, ranks are strictly ordered, and the saved report has everybody.
"""

import argparse
import asyncio
import json
import random
import sys
import time
from dataclasses import dataclass, field
from urllib.parse import urlparse

import httpx
from websockets.asyncio.client import connect


def pct(values: list[float], p: float) -> float:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(len(ordered) * p))] if ordered else float("nan")


def summary(name: str, values_s: list[float]) -> str:
    ms = [v * 1000 for v in values_s]
    return (
        f"{name:<34} n={len(ms):<5} p50={pct(ms, 0.5):7.1f} ms  p95={pct(ms, 0.95):7.1f} ms  "
        f"max={max(ms, default=float('nan')):7.1f} ms"
    )


@dataclass
class Player:
    index: int
    nickname: str
    token: str = ""
    ws: object = None
    # what the server sent
    questions_seen: int = 0
    ack_latencies: list[float] = field(default_factory=list)
    taps: list[int] = field(default_factory=list)
    points: list[int] = field(default_factory=list)
    final_score: int | None = None
    final_rank: int | None = None
    started_at: dict[int, float] = field(default_factory=dict)  # question number -> when it arrived
    answered_at: dict[int, float] = field(default_factory=dict)  # question number -> when we sent the tap
    errors: list[str] = field(default_factory=list)
    ready: asyncio.Event = field(default_factory=asyncio.Event)  # the server has said hello back
    _answer_sent_at: float = 0.0

    async def run(
        self, wsurl: str, headers: dict[str, str], correct_share: float, answer_after: tuple[float, float]
    ):
        self.ws = await connect(wsurl, additional_headers=headers)
        await self.ws.send(json.dumps({"v": 1, "type": "hello", "token": self.token}))
        async for raw in self.ws:
            event = json.loads(raw)
            kind = event["type"]
            if kind == "state":
                self.ready.set()
            elif kind == "ping":
                await self.ws.send(json.dumps({"v": 1, "type": "pong", "n": event["n"]}))
            elif kind == "question.started":
                number = event["question"]["index"]
                self.questions_seen += 1
                self.started_at[number] = time.monotonic()
                asyncio.create_task(self._answer(number, correct_share, answer_after))
            elif kind == "answer.accepted":
                self.ack_latencies.append(time.monotonic() - self._answer_sent_at)
            elif kind == "question.closed":
                self.points.append(event["reveal"]["points"])
            elif kind == "game.ended":
                self.final_score, self.final_rank = event["you"]["score"], event["you"]["rank"]
                return
            elif kind == "error":
                self.errors.append(event["code"])

    async def _answer(self, number: int, correct_share: float, answer_after: tuple[float, float]):
        await asyncio.sleep(random.uniform(*answer_after))
        # question n: the right shape is ((n - 1) % 4) + 1, as the quiz below is built
        right = ((number - 1) % 4) + 1
        tap = right if random.random() < correct_share else (right % 4) + 1
        self.taps.append(tap)
        self._answer_sent_at = self.answered_at[number] = time.monotonic()
        await self.ws.send(json.dumps({"v": 1, "type": "answer", "position": tap}))


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", default="http://localhost:8000")
    ap.add_argument("--prefix", default="", help="/api when --base is the web app")
    ap.add_argument("--login", required=True)
    ap.add_argument("--password", required=True)
    ap.add_argument("--players", type=int, default=60)
    ap.add_argument("--questions", type=int, default=5)
    ap.add_argument("--correct-share", type=float, default=0.6)
    ap.add_argument("--no-spoof", action="store_true", help="do not send X-Forwarded-For")
    args = ap.parse_args()

    http_base = args.base.rstrip("/") + args.prefix
    ws_base = (
        ("wss" if args.base.startswith("https") else "ws") + "://" + urlparse(args.base).netloc + args.prefix
    )
    problems: list[str] = []

    def check(ok: bool, what: str) -> None:
        print(("ok   " if ok else "FAIL ") + what)
        if not ok:
            problems.append(what)

    async with httpx.AsyncClient(base_url=http_base, timeout=20) as host:
        r = await host.post("/auth/login", json={"login": args.login, "password": args.password})
        if r.status_code != 200:
            print(f"login failed: {r.status_code} {r.text}")
            return 2
        questions = [
            {
                "id": f"q{n}",
                "text": f"Question {n}?",
                "answers": ["one", "two", "three", "four"],
                "correct": ((n - 1) % 4) + 1,
                "seconds": 20,
            }
            for n in range(1, args.questions + 1)
        ]
        quiz = (
            await host.post("/quizzes", json={"title": f"Load test {args.players}", "questions": questions})
        ).json()
        game = (await host.post("/games", json={"quizId": quiz["id"]})).json()
        print(f"game {game['pin']} with {args.players} players, {args.questions} questions\n")

        # --- everybody joins at once ---
        players = [Player(i, f"Load{i:03d}") for i in range(args.players)]
        join_times: list[float] = []

        async def join(p: Player) -> None:
            # one shared client: building a client per player would time the script, not the server
            headers = (
                {} if args.no_spoof else {"X-Forwarded-For": f"10.1.{p.index // 250}.{p.index % 250 + 1}"}
            )
            t0 = time.monotonic()
            r = await joiner.post(
                "/games/join", json={"pin": game["pin"], "nickname": p.nickname}, headers=headers
            )
            join_times.append(time.monotonic() - t0)
            if r.status_code != 200:
                p.errors.append(f"join {r.status_code} {r.text}")
                return
            p.token = r.json()["token"]

        async with httpx.AsyncClient(
            base_url=http_base, timeout=30, limits=httpx.Limits(max_connections=args.players + 10)
        ) as joiner:
            await asyncio.gather(*(join(p) for p in players))
        check(all(p.token for p in players), f"all {args.players} players joined")
        if problems:
            print("\n".join(e for p in players for e in p.errors[:1]))
            return 1

        # --- everybody connects, then the host starts ---
        def hdr(p: Player) -> dict[str, str]:
            return {} if args.no_spoof else {"X-Forwarded-For": f"10.1.{p.index // 250}.{p.index % 250 + 1}"}

        tasks = [
            asyncio.create_task(p.run(f"{ws_base}/ws/play", hdr(p), args.correct_share, (0.2, 3.0)))
            for p in players
        ]
        cookie = host.cookies["aary_token"]
        hostws = await connect(
            f"{ws_base}/ws/host/{game['gameId']}", additional_headers={"Cookie": f"aary_token={cookie}"}
        )
        host_events: list[tuple[float, dict]] = []

        async def host_reader() -> None:
            async for raw in hostws:
                host_events.append((time.monotonic(), json.loads(raw)))

        reader = asyncio.create_task(host_reader())

        async def host_wait(kind: str, count: int, timeout: float = 30) -> float:
            end = time.monotonic() + timeout
            while time.monotonic() < end:
                found = [t for t, e in host_events if e["type"] == kind]
                if len(found) >= count:
                    return found[count - 1]
                await asyncio.sleep(0.01)
            raise TimeoutError(f"host never saw {kind} #{count}")

        async def send(**message) -> float:
            await hostws.send(json.dumps({"v": 1, **message}))
            return time.monotonic()

        # Start only when every phone is attached, like a real room where everybody has joined.
        try:
            await asyncio.wait_for(asyncio.gather(*(p.ready.wait() for p in players)), timeout=30)
        except TimeoutError:
            print(f"only {sum(p.ready.is_set() for p in players)} of {args.players} sockets attached in 30 s")
        await asyncio.sleep(0.3)
        # the host connected after the joins, so its snapshot carries the whole lobby
        snapshots = [e for _, e in host_events if e["type"] in ("host.state", "lobby.updated")]
        lobby_ok = bool(snapshots) and len(snapshots[-1]["players"]) == args.players
        check(lobby_ok, "the host's lobby lists every player")

        start_times: dict[int, float] = {}
        try:
            start_times[1] = await send(type="start")
            for n in range(1, args.questions + 1):
                await host_wait("question.started", n)
                await host_wait("question.closed", n, timeout=25)
                await send(type="next", fromPhase="counts")
                await host_wait("leaderboard", n)
                start_times[n + 1] = await send(type="next", fromPhase="leaderboard")
            await asyncio.wait_for(asyncio.gather(*tasks), timeout=20)
        except TimeoutError as e:
            problems.append(f"timed out: {e}")
            print(f"FAIL timed out: {e}")
        if not problems:
            await host_wait("game.ended", 1, timeout=10)
        reader.cancel()
        await hostws.close()

        # --- what happened ---
        check(all(p.questions_seen == args.questions for p in players), "every player got every question")
        check(all(len(p.ack_latencies) == args.questions for p in players), "every answer was acknowledged")
        check(
            not [e for p in players for e in p.errors],
            f"no errors sent to any player {[e for p in players for e in p.errors][:3]}",
        )
        scored = [p for p in players if p.final_score is not None]
        check(len(scored) == args.players, "every player saw the final result")
        for p in scored:
            wrong = sum(1 for n, tap in enumerate(p.taps, start=1) if tap != ((n - 1) % 4) + 1)
            right = args.questions - wrong
            low, high = 500 * right, 1000 * right
            if not low <= (p.final_score or 0) <= high or sum(p.points) != p.final_score:
                problems.append(f"{p.nickname}: score {p.final_score}, {right} right, points {p.points}")
        check(
            not [x for x in problems if "score" in x], "every score is possible for what that player answered"
        )
        ranks = sorted((p.final_rank or 0) for p in scored)
        check(ranks == list(range(1, args.players + 1)), "ranks are 1..N with no ties or gaps")
        ordered = sorted(scored, key=lambda p: p.final_rank or 0)
        check(
            all(a.final_score >= b.final_score for a, b in zip(ordered, ordered[1:], strict=False)),
            "ranks follow the scores",
        )
        await asyncio.sleep(0.5)
        report = await host.get(f"/games/{game['gameId']}/report")
        check(
            report.status_code == 200 and len(report.json()["players"]) == args.players,
            "the saved report has every player",
        )

    # --- numbers ---
    print()
    print(summary("join (REST, all at once)", join_times))
    print(summary("answer -> acknowledged", [x for p in players for x in p.ack_latencies]))
    arrival = [p.started_at[n] - start_times[n] for p in players for n in p.started_at if n in start_times]
    print(summary("host command -> question on phone", arrival))
    closed_at = [t for t, e in host_events if e["type"] == "question.closed"]
    close_lag = [
        closed_at[n - 1] - max(p.answered_at[n] for p in players if n in p.answered_at)
        for n in range(1, min(len(closed_at), args.questions) + 1)
    ]
    print(summary("last answer sent -> question closed", close_lag))
    print("\n" + ("ALL OK" if not problems else f"{len(problems)} PROBLEM(S): {problems[:5]}"))
    return 0 if not problems else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
