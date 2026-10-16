CRITERIA = [
    {"id": "c1", "name": "Voice", "coefficient": 6},
    {"id": "c2", "name": "Stage", "coefficient": 4},
]
ENTRIES = [
    {"id": "e1", "name": "Aidana", "description": "Song"},
    {"id": "e2", "name": "Bek", "description": ""},
]


def payload(jury, **over):
    base = {
        "title": "Singers",
        "description": "District contest",
        "criteria": CRITERIA,
        "entries": ENTRIES,
        "juryIds": [str(u.id) for u in jury],
    }
    return {**base, **over}


async def make_contest(owner_client, jury, **over):
    r = await owner_client.post("/contests", json=payload(jury, **over))
    assert r.status_code == 201, r.text
    return r.json()


async def score_all(c, contest, values):
    """values[entry index] = (score for c1, score for c2)."""
    for entry, (s1, s2) in zip(contest["entries"], values, strict=False):
        for crit, s in zip(contest["criteria"], (s1, s2), strict=True):
            r = await c.put(
                f"/contests/{contest['id']}/scores",
                json={"entryId": entry["id"], "criterionId": crit["id"], "score": s},
            )
            assert r.status_code == 204, r.text


# --- create & validation -----------------------------------------------------------------------


async def test_create_returns_draft_with_server_ids_and_jury(as_user):
    owner, o = await as_user("ulan")
    _, j1 = await as_user("omur")
    _, j2 = await as_user("gulzat")
    c = await make_contest(owner, [j2, j1])
    assert c["status"] == "draft" and c["ownerId"] == str(o.id) and c["ownerName"] == "Ulan"
    assert [m["name"] for m in c["jury"]] == ["Gulzat", "Omur"]  # the picked order
    assert all(m["finished"] is False for m in c["jury"])
    assert [x["name"] for x in c["criteria"]] == ["Voice", "Stage"] and c["criteria"][0]["coefficient"] == 6
    assert c["criteria"][0]["id"] != "c1" and c["entries"][0]["id"] != "e1"
    assert c["scores"] == {}


async def test_invalid_contest_lists_every_issue_with_client_ids(as_user):
    owner, _ = await as_user("ulan")
    bad = {
        "title": " ",
        "description": "",
        "criteria": [
            {"id": "k1", "name": "", "coefficient": 0},
            {"id": "k2", "name": "B", "coefficient": 4},
        ],
        "entries": [{"id": "n1", "name": " ", "description": ""}],
        "juryIds": [],
    }
    r = await owner.post("/contests", json=bad)
    assert (r.status_code, r.json()["code"]) == (400, "CONTEST_INVALID")
    got = [(i["code"], i["field"]) for i in r.json()["issues"]]
    assert got == [
        ("FIELD_REQUIRED", "title"),
        ("FIELD_REQUIRED", "criterion:k1:name"),
        ("COEFFICIENT_INVALID", "criterion:k1:coefficient"),
        ("FIELD_REQUIRED", "entry:n1:name"),
        ("JURY_REQUIRED", "jury"),
    ]


async def test_empty_lists_and_bad_coefficients(as_user):
    owner, _ = await as_user("ulan")
    _, j = await as_user("omur")
    r = await owner.post("/contests", json=payload([j], criteria=[], entries=[]))
    assert [i["code"] for i in r.json()["issues"]] == ["CRITERIA_REQUIRED", "ENTRIES_REQUIRED"]
    for bad in (0, -1, 0.001, 1.005, 10.01, 11):
        crit = [{"id": "k0", "name": "X", "coefficient": 1}, {"id": "k1", "name": "X", "coefficient": bad}]
        r = await owner.post("/contests", json=payload([j], criteria=crit))
        assert [(i["code"], i["field"]) for i in r.json()["issues"]] == [
            ("COEFFICIENT_INVALID", "criterion:k1:coefficient")
        ], bad
    for good in (0.01, 0.5, 1.25, 2, 10):
        crit = [{"id": "k0", "name": "X", "coefficient": 1}, {"id": "k1", "name": "X", "coefficient": good}]
        assert (await owner.post("/contests", json=payload([j], criteria=crit))).status_code == 201, good


async def test_jury_must_be_real_active_users(as_user):
    owner, _ = await as_user("ulan")
    admin, _ = await as_user("root", role="admin")
    _, j = await as_user("omur")
    disabled_id = (
        await admin.post("/admin/users", json={"firstName": "D", "lastName": "X", "login": "dis"})
    ).json()["user"]["id"]
    await admin.post(f"/admin/users/{disabled_id}/disable")
    for ids in (["00000000-0000-0000-0000-000000000000"], [disabled_id], [str(j.id), disabled_id]):
        r = await owner.post("/contests", json={**payload([j]), "juryIds": ids})
        assert (r.status_code, r.json()["code"], r.json()["field"]) == (400, "USER_NOT_FOUND", "jury"), ids


async def test_duplicate_jury_ids_are_collapsed(as_user):
    owner, _ = await as_user("ulan")
    _, j = await as_user("omur")
    r = await owner.post("/contests", json={**payload([j]), "juryIds": [str(j.id), str(j.id)]})
    assert len(r.json()["jury"]) == 1


# --- visibility -------------------------------------------------------------------------------


async def test_visibility_owner_jury_admin_only(as_user):
    owner, _ = await as_user("ulan")
    jury_c, j = await as_user("omur")
    stranger, _ = await as_user("bakyt")
    admin, _ = await as_user("root", role="admin")
    c = await make_contest(owner, [j])
    cid = c["id"]

    assert (await owner.get(f"/contests/{cid}")).status_code == 200
    assert (await jury_c.get(f"/contests/{cid}")).status_code == 200
    assert (await admin.get(f"/contests/{cid}")).status_code == 200
    r = await stranger.get(f"/contests/{cid}")
    assert (r.status_code, r.json()["code"]) == (404, "CONTEST_NOT_FOUND")

    assert [x["id"] for x in (await owner.get("/contests")).json()] == [cid]
    assert [x["id"] for x in (await jury_c.get("/contests")).json()] == [cid]
    assert (await stranger.get("/contests")).json() == []
    assert (await admin.get("/contests")).json() == []  # "mine": admin neither owns nor judges it
    assert [x["id"] for x in (await admin.get("/admin/contests")).json()] == [cid]
    assert (await owner.get("/admin/contests")).status_code == 403


async def test_directory_lists_active_users_without_roles_or_secrets(as_user):
    c, _ = await as_user("ulan")
    admin, _ = await as_user("root", role="admin")
    dis = (
        await admin.post("/admin/users", json={"firstName": "Gone", "lastName": "X", "login": "gone"})
    ).json()["user"]["id"]
    await admin.post(f"/admin/users/{dis}/disable")
    rows = (await c.get("/users/directory")).json()
    assert sorted(r["name"] for r in rows) == ["Root", "Ulan"]
    assert all(set(r) == {"id", "name", "login"} for r in rows)


# --- lifecycle --------------------------------------------------------------------------------


async def test_open_and_close_permissions_and_states(as_user):
    owner, _ = await as_user("ulan")
    jury_c, j = await as_user("omur")
    admin, _ = await as_user("root", role="admin")
    cid = (await make_contest(owner, [j]))["id"]

    assert (await jury_c.post(f"/contests/{cid}/open")).status_code == 403
    assert (await owner.post(f"/contests/{cid}/close")).json()["code"] == "CONTEST_NOT_OPEN"
    assert (await owner.post(f"/contests/{cid}/open")).json()["status"] == "open"
    assert (await admin.post(f"/contests/{cid}/open")).json()["code"] == "CONTEST_NOT_DRAFT"
    assert (await jury_c.post(f"/contests/{cid}/close")).status_code == 403
    assert (await admin.post(f"/contests/{cid}/close")).json()["status"] == "closed"  # admin manages
    r = await owner.post(f"/contests/{cid}/open")
    assert (r.status_code, r.json()["code"]) == (409, "CONTEST_NOT_DRAFT")  # never reopened


# --- scoring ----------------------------------------------------------------------------------


async def open_contest(owner, jury):
    c = await make_contest(owner, jury)
    return (await owner.post(f"/contests/{c['id']}/open")).json()


async def test_only_jury_score_and_only_while_open(as_user):
    owner, _ = await as_user("ulan")
    jury_c, j = await as_user("omur")
    c = await make_contest(owner, [j])
    body = {"entryId": c["entries"][0]["id"], "criterionId": c["criteria"][0]["id"], "score": 4}
    url = f"/contests/{c['id']}/scores"

    r = await jury_c.put(url, json=body)  # still draft
    assert (r.status_code, r.json()["code"]) == (409, "CONTEST_NOT_OPEN")
    await owner.post(f"/contests/{c['id']}/open")
    assert (await jury_c.put(url, json=body)).status_code == 204
    assert (await owner.put(url, json=body)).status_code == 403  # owner who isn't jury
    await owner.post(f"/contests/{c['id']}/close")
    assert (await jury_c.put(url, json=body)).json()["code"] == "CONTEST_NOT_OPEN"


async def test_score_validation(as_user):
    owner, _ = await as_user("ulan")
    jury_c, j = await as_user("omur")
    c = await open_contest(owner, [j])
    url = f"/contests/{c['id']}/scores"
    e, k = c["entries"][0]["id"], c["criteria"][0]["id"]
    for score in (0, 6, 2.5, "3"):
        r = await jury_c.put(url, json={"entryId": e, "criterionId": k, "score": score})
        assert (r.status_code, r.json()["code"]) == (422, "VALIDATION_ERROR"), score
    r = await jury_c.put(url, json={"entryId": "nope", "criterionId": k, "score": 3})
    assert (r.status_code, r.json()["code"]) == (404, "ENTRY_NOT_FOUND")
    r = await jury_c.put(url, json={"entryId": e, "criterionId": "nope", "score": 3})
    assert (r.status_code, r.json()["code"]) == (404, "CRITERION_NOT_FOUND")


async def test_viewer_only_gets_their_own_scores_and_changes_replace(as_user):
    owner, _ = await as_user("ulan")
    c1, j1 = await as_user("omur")
    c2, j2 = await as_user("gulzat")
    c = await open_contest(owner, [j1, j2])
    e, k = c["entries"][0]["id"], c["criteria"][0]["id"]
    url = f"/contests/{c['id']}/scores"
    await c1.put(url, json={"entryId": e, "criterionId": k, "score": 2})
    await c1.put(url, json={"entryId": e, "criterionId": k, "score": 5})  # change of mind
    await c2.put(url, json={"entryId": e, "criterionId": k, "score": 1})

    mine = (await c1.get(f"/contests/{c['id']}")).json()["scores"]
    assert mine == {str(j1.id): {e: {k: 5}}}
    assert (await c2.get(f"/contests/{c['id']}")).json()["scores"] == {str(j2.id): {e: {k: 1}}}
    assert (await owner.get(f"/contests/{c['id']}")).json()["scores"] == {}  # not jury: nothing
    listed = (await c1.get("/contests")).json()[0]["scores"]
    assert listed == mine


async def test_finish_needs_every_entry_fully_scored(as_user):
    owner, _ = await as_user("ulan")
    jury_c, j = await as_user("omur")
    c = await open_contest(owner, [j])
    url = f"/contests/{c['id']}/scores"
    finish = f"/contests/{c['id']}/finish"
    r = await jury_c.post(finish)
    assert (r.status_code, r.json()["code"]) == (409, "SCORING_INCOMPLETE")

    await score_all(jury_c, c, [(5, 4)])  # the first entry only
    assert (await jury_c.post(finish)).json()["code"] == "SCORING_INCOMPLETE"
    e2, (k1, k2) = c["entries"][1]["id"], (c["criteria"][0]["id"], c["criteria"][1]["id"])
    await jury_c.put(url, json={"entryId": e2, "criterionId": k1, "score": 3})
    assert (await jury_c.post(finish)).json()["code"] == "SCORING_INCOMPLETE"  # one criterion missing
    await jury_c.put(url, json={"entryId": e2, "criterionId": k2, "score": 3})
    r = await jury_c.post(finish)
    assert r.status_code == 200 and r.json()["jury"][0]["finished"] is True

    # a finished jury member can still change a score until the contest closes
    again = await jury_c.put(url, json={"entryId": e2, "criterionId": k2, "score": 5})
    assert again.status_code == 204


async def test_finish_rejects_non_jury_and_wrong_state(as_user):
    owner, _ = await as_user("ulan")
    jury_c, j = await as_user("omur")
    c = await make_contest(owner, [j])
    assert (await jury_c.post(f"/contests/{c['id']}/finish")).json()["code"] == "CONTEST_NOT_OPEN"
    await owner.post(f"/contests/{c['id']}/open")
    assert (await owner.post(f"/contests/{c['id']}/finish")).status_code == 403


# --- results ----------------------------------------------------------------------------------


async def finished_contest(as_user, tie=True):
    owner, _ = await as_user("ulan")
    a, ja = await as_user("aizhan")
    b, jb = await as_user("omur")
    lazy, jc = await as_user("lazy")  # never finishes: must not count
    c = await open_contest(owner, [ja, jb, jc])
    # coefficients 6/4. Entries 1 and 2: aizhan 5,4 / 4,5 and omur 4,5 / 5,4 -> both 4.5 and 4.5
    await score_all(a, c, [(5, 4), (4, 5)] if tie else [(5, 5), (4, 4)])
    await score_all(b, c, [(4, 5), (5, 4)] if tie else [(5, 5), (4, 4)])
    await score_all(lazy, c, [(1, 1), (1, 1)])
    for client in (a, b):
        assert (await client.post(f"/contests/{c['id']}/finish")).status_code == 200
    await owner.post(f"/contests/{c['id']}/close")
    return owner, a, c


async def test_results_only_when_closed(as_user):
    owner, _ = await as_user("ulan")
    _, j = await as_user("omur")
    c = await open_contest(owner, [j])
    r = await owner.get(f"/contests/{c['id']}/results")
    assert (r.status_code, r.json()["code"]) == (409, "CONTEST_NOT_CLOSED")


async def test_results_rank_and_skip_unfinished_jury(as_user):
    owner, _, c = await finished_contest(as_user, tie=False)
    r = (await owner.get(f"/contests/{c['id']}/results")).json()
    ranking = r["ranking"]
    assert [x["finalScore"] for x in ranking] == [5.0, 4.0]  # the unfinished juror's 1s don't count
    assert [x["rank"] for x in ranking] == [1, 2] and all(x["juryCount"] == 2 for x in ranking)
    assert ranking[0]["entry"]["name"] == "Aidana" and ranking[0]["shared"] is False


async def test_results_ties_share_the_place(as_user):
    owner, _, c = await finished_contest(as_user, tie=True)
    ranking = (await owner.get(f"/contests/{c['id']}/results")).json()["ranking"]
    assert [x["finalScore"] for x in ranking] == [4.5, 4.5]
    assert [x["rank"] for x in ranking] == [1, 1] and all(x["shared"] for x in ranking)
    assert [x["perCriterion"][c["criteria"][0]["id"]] for x in ranking] == [4.5, 4.5]


async def test_breakdown_for_owner_and_admin_only(as_user):
    owner, jury_c, c = await finished_contest(as_user, tie=True)
    admin, _ = await as_user("root", role="admin")
    e1 = c["entries"][0]["id"]

    rows = (await owner.get(f"/contests/{c['id']}/results")).json()["breakdown"][e1]
    assert [r["name"] for r in rows] == ["Aizhan", "Omur"]  # finished jury only, in jury order
    assert rows[0]["total"] == 4.6 and rows[1]["total"] == 4.4
    assert rows[0]["scores"] == {c["criteria"][0]["id"]: 5, c["criteria"][1]["id"]: 4}
    assert (await admin.get(f"/contests/{c['id']}/results")).json()["breakdown"] is not None

    as_jury = (await jury_c.get(f"/contests/{c['id']}/results")).json()
    assert as_jury["breakdown"] is None and len(as_jury["ranking"]) == 2  # sees ranking, not who scored what


async def test_stranger_cannot_read_results(as_user):
    owner, _, c = await finished_contest(as_user)
    stranger, _ = await as_user("bakyt")
    r = await stranger.get(f"/contests/{c['id']}/results")
    assert (r.status_code, r.json()["code"]) == (404, "CONTEST_NOT_FOUND")
