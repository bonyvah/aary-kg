import asyncio

from app.game.runtime import get_engine
from app.models.quiz import Quiz  # noqa: F401  (quizzes are made through the API below)


def quiz_body(n=2, seconds=20):
    return {
        "title": "Geography",
        "questions": [
            {
                "id": f"q{i + 1}",
                "text": f"Question {i + 1}?",
                "answers": ["a", "b", "c", "d"],
                "correct": (i % 4) + 1,
                "seconds": seconds,
            }
            for i in range(n)
        ],
    }


async def make_game(as_user, shuffle=False, n=2):
    host, user = await as_user("host1")
    quiz = (await host.post("/quizzes", json=quiz_body(n))).json()
    r = await host.post("/games", json={"quizId": quiz["id"], "shuffleQuestions": shuffle})
    assert r.status_code == 201, r.text
    return host, user, quiz, r.json()


async def join(client, pin, nickname):
    return await client.post("/games/join", json={"pin": pin, "nickname": nickname})


# --- creating a game ---------------------------------------------------------------------------


async def test_creating_a_game_needs_login_and_your_own_quiz(client, as_user):
    r = await client.post("/games", json={"quizId": "00000000-0000-0000-0000-000000000000"})
    assert r.status_code == 401
    host, _, quiz, game = await make_game(as_user)
    assert len(game["pin"]) == 6 and len(game["gameId"]) == 32
    other, _ = await as_user("other")
    r = await other.post("/games", json={"quizId": quiz["id"]})
    assert (r.status_code, r.json()["code"]) == (404, "QUIZ_NOT_FOUND")
    admin, _ = await as_user("root", role="admin")  # admins don't host games, not even for their own users
    r = await admin.post("/games", json={"quizId": quiz["id"]})
    assert (r.status_code, r.json()["code"]) == (403, "FORBIDDEN")


async def test_the_game_keeps_its_own_copy_of_the_quiz(as_user):
    host, _, quiz, game = await make_game(as_user)
    edited = {**quiz_body(1), "title": "Changed"}
    await host.put(f"/quizzes/{quiz['id']}", json=edited)
    snapshot = await get_engine().repo.get_quiz(game["gameId"])
    assert snapshot["title"] == "Geography" and len(snapshot["questions"]) == 2


# --- the PIN and joining -----------------------------------------------------------------------


async def test_pin_check(client, as_user):
    _, _, _, game = await make_game(as_user)
    assert (await client.get(f"/games/pin/{game['pin']}")).status_code == 204
    r = await client.get("/games/pin/12345")
    assert (r.status_code, r.json()["code"]) == (400, "PIN_INVALID")
    r = await client.get("/games/pin/999999")
    assert (r.status_code, r.json()["code"]) == (404, "GAME_NOT_FOUND")


async def test_join_returns_a_token_and_a_character(client, as_user):
    _, _, _, game = await make_game(as_user)
    r = await join(client, game["pin"], "  Aida ")
    assert r.status_code == 200
    body = r.json()
    assert body["player"]["nickname"] == "Aida" and set(body["player"]["character"]) == {
        "shape",
        "color",
        "face",
    }
    assert body["token"].count(".") == 2


async def test_join_errors_are_stable_codes(client, as_user):
    _, _, _, game = await make_game(as_user)
    pin = game["pin"]
    await join(client, pin, "Aida")
    cases = [
        (join(client, "12", "Bek"), 400, "PIN_INVALID"),
        (join(client, "999999", "Bek"), 404, "GAME_NOT_FOUND"),
        (join(client, pin, ""), 400, "NICKNAME_INVALID"),
        (join(client, pin, "Admin"), 400, "NICKNAME_INVALID"),
        (join(client, pin, "aida"), 409, "NICKNAME_TAKEN"),
    ]
    for call, status, code in cases:
        r = await call
        assert (r.status_code, r.json()["code"]) == (status, code), code
    r = await client.post("/games/join", json={"pin": pin})  # nickname missing
    assert r.json()["code"] == "NICKNAME_INVALID"


async def test_join_after_start_is_refused(client, as_user):
    _, _, _, game = await make_game(as_user)
    await join(client, game["pin"], "Aida")
    await get_engine().start(game["gameId"])
    r = await join(client, game["pin"], "Late")
    assert (r.status_code, r.json()["code"]) == (409, "GAME_STARTED")
    assert (await client.get(f"/games/pin/{game['pin']}")).json()["code"] == "GAME_STARTED"


async def test_a_player_token_is_no_staff_credential(client, as_user):
    _, _, _, game = await make_game(as_user)
    token = (await join(client, game["pin"], "Aida")).json()["token"]
    client.cookies.set("aary_token", token)
    assert (await client.get("/auth/me")).status_code == 401
    assert (await client.get("/quizzes")).status_code == 401


# --- the finished game: history and report -------------------------------------------------------


async def play_to_the_end(game, players, started=False):
    """players: [(player id, [position per question])]. Returns when the game is saved."""
    engine = get_engine()
    gid = game["gameId"]
    if not started:
        await engine.start(gid)
    rounds = max(len(answers) for _, answers in players)
    for r in range(rounds):
        for pid, answers in players:
            if r < len(answers) and answers[r]:
                await engine.answer(gid, pid, answers[r])
        state = await engine.repo.get_game(gid)
        if state.phase == "question":
            await engine.next(gid)
        await engine.next(gid)  # leaderboard
        await engine.next(gid)  # next question, or the end


async def test_finished_game_is_saved_and_reported(client, as_user):
    host, user, quiz, game2 = await make_game(as_user, n=2)
    # q1 -> 1 is right, q2 -> 2 is right
    pids = {}
    for name in ("Aida", "Bek", "Cholpon"):
        pids[name] = (await join(client, game2["pin"], name)).json()["player"]["id"]
    await get_engine().start(game2["gameId"])
    await get_engine().signal(game2["gameId"], pids["Bek"], "TAB_BLUR")
    await get_engine().signal(game2["gameId"], pids["Bek"], "PASTE")
    await play_to_the_end(
        game2, [(pids["Aida"], [1, 2]), (pids["Bek"], [1, 4]), (pids["Cholpon"], [3])], started=True
    )
    await asyncio.sleep(0.1)

    listing = (await host.get("/games")).json()
    assert [(g["quizTitle"], g["playerCount"], g["questionCount"]) for g in listing][0] == ("Geography", 3, 2)

    report = (await host.get(f"/games/{game2['gameId']}/report")).json()
    assert report["quizTitle"] == "Geography" and report["questionCount"] == 2
    assert [p["nickname"] for p in report["players"]] == ["Aida", "Bek", "Cholpon"]
    assert [p["rank"] for p in report["players"]] == [1, 2, 3]
    aida, bek, chol = report["players"]
    assert (aida["correct"], bek["correct"], chol["correct"]) == (2, 1, 0)
    assert aida["score"] > bek["score"] > chol["score"] == 0
    assert bek["flags"] == [{"kind": "TAB_BLUR", "count": 1}, {"kind": "PASTE", "count": 1}]
    # the test answers within milliseconds: two correct instant answers is what FAST_ANSWERS is for
    assert aida["flags"] == [{"kind": "FAST_ANSWERS", "count": 2}]
    shares = {q["id"]: q["correctShare"] for q in report["questions"]}
    assert shares == {"q1": 2 / 3, "q2": 1 / 3}


async def test_report_is_for_the_owner_and_admins_only(client, as_user):
    host, _, quiz, game = await make_game(as_user)
    pid = (await join(client, game["pin"], "Aida")).json()["player"]["id"]
    await play_to_the_end(game, [(pid, [1, 2])])
    await asyncio.sleep(0.1)
    url = f"/games/{game['gameId']}/report"
    assert (await host.get(url)).status_code == 200
    other, _ = await as_user("other")
    r = await other.get(url)
    assert (r.status_code, r.json()["code"]) == (404, "GAME_NOT_FOUND")
    assert (await other.get("/games")).json() == []
    admin, _ = await as_user("root", role="admin")
    assert (await admin.get(url)).status_code == 200
    assert (await client.get(url)).status_code == 401
    assert (await host.get("/games/00000000-0000-0000-0000-000000000000/report")).status_code == 404


async def test_history_keeps_the_audit_trail_and_a_copy_of_the_questions(client, as_user):
    from sqlalchemy import select

    from app.db import SessionLocal
    from app.models.game import Game, GamePlayer

    host, _, quiz, game = await make_game(as_user)
    pid = (await join(client, game["pin"], "Aida")).json()["player"]["id"]
    await play_to_the_end(game, [(pid, [1, 2])])
    await asyncio.sleep(0.1)
    await host.put(f"/quizzes/{quiz['id']}", json={**quiz_body(1), "title": "Edited later"})
    async with SessionLocal() as s:
        saved = (await s.execute(select(Game))).scalar_one()
        player = (await s.execute(select(GamePlayer))).scalar_one()
    assert saved.quiz_title == "Geography" and [q["id"] for q in saved.questions] == ["q1", "q2"]
    assert saved.questions[0]["correct"] == 1
    kinds = [e["type"] for e in saved.audit]
    assert kinds[0] == "game.created" and "player.joined" in kinds and kinds.count("answer") == 2
    assert kinds[-1] == "game.ended" and all("at" in e for e in saved.audit)
    assert [a["question"] for a in player.answers] == ["q1", "q2"]
    assert all({"position", "ms", "points", "correct"} <= set(a) for a in player.answers)


# --- a whole classroom behind one address -------------------------------------------------------


async def test_a_class_of_100_behind_one_address_can_all_join(client, as_user):
    """School Wi-Fi: every phone has the same public address. Joining must not be rate limited."""
    _, _, _, game = await make_game(as_user)
    # first check the PIN, as the real join screen does, then join
    results = []
    for i in range(100):
        assert (await client.get(f"/games/pin/{game['pin']}")).status_code == 204
        results.append((await join(client, game["pin"], f"Kid{i:03d}")).status_code)
    assert results == [200] * 100


async def test_guessing_pins_is_limited_by_failures(client, as_user):
    from app.routers.games import FAILED_PIN_LIMIT

    _, _, _, game = await make_game(as_user)
    for i in range(FAILED_PIN_LIMIT):
        assert (await client.get(f"/games/pin/{900000 + i}")).status_code == 404
    blocked = await client.get(f"/games/pin/{game['pin']}")  # even the right PIN: this address is guessing
    assert (blocked.status_code, blocked.json()["code"]) == (429, "RATE_LIMITED")
    assert (await join(client, game["pin"], "Aida")).status_code == 429


async def test_wrong_pins_and_malformed_pins_both_count_but_nicknames_do_not(client, as_user):
    from app.routers.games import FAILED_PIN_LIMIT

    _, _, _, game = await make_game(as_user)
    await join(client, game["pin"], "Aida")
    for _ in range(FAILED_PIN_LIMIT + 5):  # the right PIN with a taken or refused name: not a guess
        assert (await join(client, game["pin"], "Aida")).status_code == 409
        assert (await join(client, game["pin"], "Admin")).status_code == 400
    assert (await client.get(f"/games/pin/{game['pin']}")).status_code == 204
    for _ in range(FAILED_PIN_LIMIT // 2):
        await client.get("/games/pin/12")  # malformed
    for i in range(FAILED_PIN_LIMIT // 2):
        await client.get(f"/games/pin/{800000 + i}")  # unknown
    assert (await client.get(f"/games/pin/{game['pin']}")).status_code == 429


async def test_a_game_that_started_is_not_a_guess(client, as_user):
    from app.routers.games import FAILED_PIN_LIMIT

    _, _, _, game = await make_game(as_user)
    await join(client, game["pin"], "Aida")
    await get_engine().start(game["gameId"])
    for _ in range(FAILED_PIN_LIMIT + 5):
        assert (await join(client, game["pin"], "Late")).json()["code"] == "GAME_STARTED"
    assert (await client.get(f"/games/pin/{game['pin']}")).json()["code"] == "GAME_STARTED"
