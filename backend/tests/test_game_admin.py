"""An admin corrects the data of a FINISHED game; the host who ran it can read it and change nothing."""

import asyncio
import uuid

import pytest

from app.game.runtime import get_engine
from tests.test_games_api import join, make_game, play_to_the_end


@pytest.fixture
async def finished(client, as_user):
    """A finished game: q1 -> 1 and q2 -> 2 are right. Aida got both, Bek only q1, Cholpon neither."""
    host, _, _, game = await make_game(as_user, n=2)
    ids = {}
    for name in ("Aida", "Bek", "Cholpon"):
        ids[name] = (await join(client, game["pin"], name)).json()["player"]["id"]
    await get_engine().start(game["gameId"])
    await get_engine().signal(game["gameId"], ids["Aida"], "FULLSCREEN_EXIT")
    await play_to_the_end(
        game, [(ids["Aida"], [1, 2]), (ids["Bek"], [1, 4]), (ids["Cholpon"], [3])], started=True
    )
    await asyncio.sleep(0.15)
    admin, _ = await as_user("root", role="admin")
    gid = game["gameId"]

    async def fetch():
        return (await admin.get(f"/admin/games/{gid}")).json()

    def player(detail, name):
        return next(p for p in detail["players"] if p["nickname"] == name)

    return type(
        "F",
        (),
        {
            "host": host,
            "admin": admin,
            "gid": gid,
            "ids": ids,
            "fetch": staticmethod(fetch),
            "player": staticmethod(player),
            "url": f"/admin/games/{gid}",
        },
    )


def at(f, name, *parts):
    return f"{f.url}/players/{f.ids[name]}" + "".join(f"/{p}" for p in parts)


# --- who may --------------------------------------------------------------------------------


async def test_only_admins_edit_and_the_host_may_only_read(finished, client):
    f = finished
    calls = [
        ("get", f.url, None),
        ("post", at(f, "Aida", "adjust"), {"delta": 5}),
        ("put", at(f, "Aida", "score"), {"score": 5}),
        ("patch", at(f, "Aida", "answers", "q1"), {"correct": False}),
        ("patch", at(f, "Aida"), {"nickname": "Aidana"}),
        ("delete", at(f, "Aida"), None),
        ("delete", at(f, "Aida", "flags", "FULLSCREEN_EXIT"), None),
        ("delete", f.url, None),
    ]
    for method, url, body in calls:
        r = (
            await getattr(f.host, method)(url)
            if body is None
            else await getattr(f.host, method)(url, json=body)
        )
        assert (r.status_code, r.json()["code"]) == (403, "FORBIDDEN"), (method, url)
        r = (
            await getattr(client, method)(url)
            if body is None
            else await getattr(client, method)(url, json=body)
        )
        assert r.status_code == 401, (method, url)
    report = (await f.host.get(f"/games/{f.gid}/report")).json()  # the host still reads it
    assert [p["nickname"] for p in report["players"]] == ["Aida", "Bek", "Cholpon"] and report[
        "editCount"
    ] == 0
    assert (await f.fetch())["players"][0]["score"] == report["players"][0]["score"]  # nothing changed


async def test_the_detail_shows_every_answer_and_the_questions(finished):
    d = await finished.fetch()
    assert [q["id"] for q in d["questions"]] == ["q1", "q2"] and d["questions"][0]["correct"] == 1
    assert d["ownerName"] == "Host1" and d["edits"] == []
    aida, bek, chol = (finished.player(d, n) for n in ("Aida", "Bek", "Cholpon"))
    assert [a["question"] for a in aida["answers"]] == ["q1", "q2"] and all(
        a["correct"] for a in aida["answers"]
    )
    assert [a["correct"] for a in bek["answers"]] == [True, False] and bek["answers"][1]["points"] == 0
    assert [a["question"] for a in chol["answers"]] == ["q1"] and chol["adjustment"] == 0
    assert aida["score"] == sum(a["points"] for a in aida["answers"])


# --- points -----------------------------------------------------------------------------------


async def test_adding_and_taking_away_points_reranks(finished):
    f = finished
    before = f.player(await f.fetch(), "Cholpon")
    assert before["rank"] == 3 and before["score"] == 0
    d = (await f.admin.post(at(f, "Cholpon", "adjust"), json={"delta": 5000})).json()
    chol = f.player(d, "Cholpon")
    assert (chol["score"], chol["adjustment"], chol["rank"]) == (5000, 5000, 1)  # now the winner
    assert [p["rank"] for p in d["players"]] == [1, 2, 3] and d["players"][0]["nickname"] == "Cholpon"
    d = (await f.admin.post(at(f, "Cholpon", "adjust"), json={"delta": -4990})).json()
    assert f.player(d, "Cholpon")["score"] == 10 and f.player(d, "Cholpon")["rank"] == 3


async def test_a_score_cannot_go_below_zero_and_a_refused_change_changes_nothing(finished):
    f = finished
    r = await f.admin.post(at(f, "Cholpon", "adjust"), json={"delta": -1})  # she has 0
    assert (r.status_code, r.json()["code"]) == (400, "SCORE_NEGATIVE")
    assert f.player(await f.fetch(), "Cholpon")["adjustment"] == 0
    for delta in (100_001, -100_001, "x", 1.5):
        r = await f.admin.post(at(f, "Cholpon", "adjust"), json={"delta": delta})
        assert (r.status_code, r.json()["code"]) == (422, "VALIDATION_ERROR"), delta


async def test_setting_a_total_keeps_the_answers_and_stores_the_gap(finished):
    f = finished
    aida = f.player(await f.fetch(), "Aida")
    from_answers = sum(a["points"] for a in aida["answers"])
    d = (await f.admin.put(at(f, "Aida", "score"), json={"score": 100})).json()
    aida = f.player(d, "Aida")
    assert aida["score"] == 100 and aida["adjustment"] == 100 - from_answers
    assert [a["points"] for a in aida["answers"]] and sum(
        a["points"] for a in aida["answers"]
    ) == from_answers
    assert aida["rank"] == 2  # Bek (one right answer) is now ahead of 100 points
    assert (await f.admin.put(at(f, "Aida", "score"), json={"score": -1})).status_code == 422
    # setting it back to what the answers give removes the adjustment
    d = (await f.admin.put(at(f, "Aida", "score"), json={"score": from_answers})).json()
    assert f.player(d, "Aida")["adjustment"] == 0 and f.player(d, "Aida")["rank"] == 1


async def test_two_admins_editing_at_the_same_moment_both_count(finished):
    f = finished
    base = f.player(await f.fetch(), "Bek")["score"]
    results = await asyncio.gather(
        *(f.admin.post(at(f, "Bek", "adjust"), json={"delta": 10}) for _ in range(10))
    )
    assert all(r.status_code == 200 for r in results)
    bek = f.player(await f.fetch(), "Bek")
    assert bek["score"] == base + 100 and bek["adjustment"] == 100
    assert len((await f.fetch())["edits"]) == 10


# --- answers ----------------------------------------------------------------------------------


async def test_marking_an_answer_wrong_and_right_again(finished):
    f = finished
    aida = f.player(await f.fetch(), "Aida")
    q1_points = aida["answers"][0]["points"]
    d = (await f.admin.patch(at(f, "Aida", "answers", "q1"), json={"correct": False})).json()
    aida = f.player(d, "Aida")
    assert aida["answers"][0] == {**aida["answers"][0], "correct": False, "points": 0}
    assert aida["correct"] == 1 and aida["score"] == aida["answers"][1]["points"]
    # right again, without saying how many points: the base 500
    d = (await f.admin.patch(at(f, "Aida", "answers", "q1"), json={"correct": True})).json()
    assert f.player(d, "Aida")["answers"][0]["points"] == 500 and f.player(d, "Aida")["correct"] == 2
    # an explicit value
    d = (await f.admin.patch(at(f, "Aida", "answers", "q1"), json={"points": q1_points})).json()
    assert (
        f.player(d, "Aida")["answers"][0]["points"] == q1_points
        and f.player(d, "Aida")["answers"][0]["correct"] is True
    )
    d = (await f.admin.patch(at(f, "Aida", "answers", "q1"), json={"correct": True, "points": 777})).json()
    assert f.player(d, "Aida")["answers"][0]["points"] == 777


async def test_a_wrong_answer_scores_nothing_and_a_right_one_something(finished):
    f = finished
    url = at(f, "Aida", "answers", "q1")
    for body in ({"correct": False, "points": 10}, {"correct": True, "points": 0}):
        r = await f.admin.patch(url, json=body)
        assert (r.status_code, r.json()["code"]) == (400, "ANSWER_INCONSISTENT"), body
    assert (await f.admin.patch(url, json={})).json()["code"] == "NOTHING_TO_CHANGE"
    for body in ({"points": 1001}, {"points": -1}, {"correct": "yes"}):
        assert (await f.admin.patch(url, json=body)).status_code == 422, body
    r = await f.admin.patch(
        at(f, "Cholpon", "answers", "q2"), json={"correct": True}
    )  # she never answered q2
    assert (r.status_code, r.json()["code"]) == (404, "ANSWER_NOT_FOUND")
    assert (await f.admin.patch(at(f, "Aida", "answers", "nope"), json={"correct": True})).status_code == 404


async def test_question_results_follow_the_edited_answers(finished):
    f = finished
    await f.admin.patch(at(f, "Aida", "answers", "q1"), json={"correct": False})
    report = (await f.host.get(f"/games/{f.gid}/report")).json()
    shares = {q["id"]: q["correctShare"] for q in report["questions"]}
    assert shares["q1"] == pytest.approx(1 / 3)  # was 2/3: only Bek has it right now
    assert [p["correct"] for p in report["players"] if p["nickname"] == "Aida"] == [1]


# --- people -----------------------------------------------------------------------------------


async def test_renaming_a_player(finished):
    f = finished
    d = (await f.admin.patch(at(f, "Aida"), json={"nickname": "  Aidana  "})).json()
    assert f.player(d, "Aidana")["id"] == str(uuid.UUID(f.ids["Aida"]))  # the same player
    for name, code, status in (
        ("", "NICKNAME_INVALID", 400),
        ("Admin", "NICKNAME_INVALID", 400),
        ("x" * 21, "NICKNAME_INVALID", 400),
    ):
        r = await f.admin.patch(at(f, "Bek"), json={"nickname": name})
        assert (r.status_code, r.json()["code"]) == (status, code), name
    r = await f.admin.patch(at(f, "Bek"), json={"nickname": "аidana"})  # Cyrillic а: the same name as Aidana
    assert (r.status_code, r.json()["code"]) == (409, "NICKNAME_TAKEN")
    assert (
        await f.admin.patch(at(f, "Bek"), json={"nickname": "Bek"})
    ).status_code == 200  # its own name is fine


async def test_removing_a_player_closes_the_ranks_up(finished):
    f = finished
    d = (await f.admin.delete(at(f, "Aida"))).json()
    assert [p["nickname"] for p in d["players"]] == ["Bek", "Cholpon"] and [
        p["rank"] for p in d["players"]
    ] == [1, 2]
    report = (await f.host.get(f"/games/{f.gid}/report")).json()
    assert len(report["players"]) == 2
    assert (await f.admin.delete(at(f, "Aida"))).json()["code"] == "PLAYER_NOT_FOUND"
    games = (await f.host.get("/games")).json()
    assert games[0]["playerCount"] == 2


async def test_a_game_that_is_still_being_played_cannot_be_edited(finished):
    f = finished
    live = await get_engine().repo.get_game(f.gid)
    live.phase = "leaderboard"
    await get_engine().repo.save_game(live)
    for call in (
        f.admin.put(at(f, "Aida", "score"), json={"score": 5}),
        f.admin.delete(at(f, "Aida")),
        f.admin.delete(f.url),
    ):
        r = await call
        assert (r.status_code, r.json()["code"]) == (409, "GAME_NOT_FINISHED")
    live.phase = "ended"
    await get_engine().repo.save_game(live)
    assert (await f.admin.put(at(f, "Aida", "score"), json={"score": 5})).status_code == 200


async def test_clearing_a_flag(finished):
    f = finished
    aida = f.player(await f.fetch(), "Aida")
    assert [x["kind"] for x in aida["flags"]] == ["FULLSCREEN_EXIT"]
    d = (await f.admin.delete(at(f, "Aida", "flags", "FULLSCREEN_EXIT"))).json()
    assert f.player(d, "Aida")["flags"] == []
    assert (await f.admin.delete(at(f, "Aida", "flags", "FULLSCREEN_EXIT"))).json()[
        "code"
    ] == "FLAG_NOT_FOUND"
    assert (await f.admin.delete(at(f, "Aida", "flags", "BOGUS"))).status_code == 400
    report = (await f.host.get(f"/games/{f.gid}/report")).json()
    assert next(p for p in report["players"] if p["nickname"] == "Aida")["flags"] == []


# --- the trail --------------------------------------------------------------------------------


async def test_every_change_is_logged_with_who_and_what(finished):
    f = finished
    await f.admin.post(at(f, "Bek", "adjust"), json={"delta": 25})
    await f.admin.patch(at(f, "Aida", "answers", "q2"), json={"correct": False})
    await f.admin.patch(at(f, "Cholpon"), json={"nickname": "Cholpon K"})
    await f.admin.delete(at(f, "Aida", "flags", "FULLSCREEN_EXIT"))
    await f.admin.put(at(f, "Bek", "score"), json={"score": 1234})
    await f.admin.delete(at(f, "Cholpon"))
    d = await f.fetch()
    assert [e["action"] for e in d["edits"]] == [
        "adjust_score",
        "edit_answer",
        "rename_player",
        "clear_flag",
        "set_score",
        "remove_player",
    ]
    assert all(e["adminName"] == "Root" for e in d["edits"])
    first = d["edits"][0]
    assert (
        first["nickname"] == "Bek"
        and first["detail"]["delta"] == 25
        and first["detail"]["after"] == first["detail"]["before"] + 25
    )
    assert d["edits"][1]["detail"]["before"]["correct"] is True and d["edits"][1]["detail"]["after"] == {
        "correct": False,
        "points": 0,
    }
    assert d["edits"][2]["detail"] == {"before": "Cholpon", "after": "Cholpon K"}
    assert (await f.host.get(f"/games/{f.gid}/report")).json()[
        "editCount"
    ] == 6  # the host can see it was corrected
    assert all(e["at"] for e in d["edits"])
    # a refused change leaves no trace
    await f.admin.post(at(f, "Bek", "adjust"), json={"delta": -999999})
    assert len((await f.fetch())["edits"]) == 6


async def test_the_original_audit_of_the_game_is_kept(finished):
    from sqlalchemy import select

    from app.db import SessionLocal
    from app.models.game import Game

    await finished.admin.post(at(finished, "Bek", "adjust"), json={"delta": 1})
    async with SessionLocal() as s:
        audit = (await s.execute(select(Game))).scalar_one().audit
    kinds = [e["type"] for e in audit]
    assert kinds[0] == "game.created" and "answer" in kinds and kinds[-1] == "admin.edit"


# --- deleting ---------------------------------------------------------------------------------


async def test_deleting_a_game(finished):
    f = finished
    assert (await f.admin.delete(f.url)).status_code == 204
    assert (await f.admin.get(f.url)).json()["code"] == "GAME_NOT_FOUND"
    assert (await f.host.get(f"/games/{f.gid}/report")).status_code == 404
    assert (await f.host.get("/games")).json() == [] and (await f.admin.get("/admin/games")).json() == []
    assert (await f.admin.delete(f.url)).status_code == 404
    from sqlalchemy import func, select

    from app.db import SessionLocal
    from app.models.game import GamePlayer

    async with SessionLocal() as s:
        assert (await s.execute(select(func.count()).select_from(GamePlayer))).scalar_one() == 0  # cascaded


async def test_unknown_game_and_player(finished):
    f = finished
    ghost = "00000000-0000-0000-0000-000000000000"
    assert (await f.admin.get(f"/admin/games/{ghost}")).json()["code"] == "GAME_NOT_FOUND"
    r = await f.admin.post(f"{f.url}/players/{ghost}/adjust", json={"delta": 1})
    assert (r.status_code, r.json()["code"]) == (404, "PLAYER_NOT_FOUND")
    assert (
        await f.admin.post(f"/admin/games/{ghost}/players/{ghost}/adjust", json={"delta": 1})
    ).status_code == 404
