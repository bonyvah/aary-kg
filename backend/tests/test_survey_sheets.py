def single(qid="q1", **over):
    return {**{"id": qid, "kind": "single", "text": "Lessons?", "choices": ["Good", "Bad"]}, **over}


def multi(qid="q2", **over):
    base = {"id": qid, "kind": "multi", "text": "Subjects?", "choices": ["Math", "Art", "Music"]}
    return {**base, **over}


def open_(qid="q3", **over):
    return {**{"id": qid, "kind": "open", "text": "Anything else?"}, **over}


def sheet(**over):
    return {**{"title": "Term", "questions": [single(), multi(), open_()]}, **over}


async def test_admins_write_and_share_sheets(as_user):
    admin, _ = await as_user("root", role="admin")
    other, _ = await as_user("root2", role="admin")
    r = await admin.post("/admin/survey-sheets", json=sheet(title="  Term  "))
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["title"] == "Term"
    assert body["questions"] == [
        {**single(), "required": True},
        {**multi(), "required": True, "limit": {"min": 1, "max": None}},
        {**open_(), "required": True, "maxWords": 100},
    ]
    sid = body["id"]
    assert (await other.get("/admin/survey-sheets")).json() == [
        {"id": sid, "title": "Term", "questionCount": 3}
    ]

    changed = sheet(questions=[multi(limit={"min": 2, "max": 2}, required=False)])
    r = await other.put(f"/admin/survey-sheets/{sid}", json=changed)
    assert r.status_code == 200
    assert r.json()["questions"][0]["limit"] == {"min": 2, "max": 2}
    assert r.json()["questions"][0]["required"] is False

    assert (await admin.delete(f"/admin/survey-sheets/{sid}")).status_code == 204
    assert (await admin.get(f"/admin/survey-sheets/{sid}")).json()["code"] == "SURVEY_NOT_FOUND"


async def test_only_admins(as_user):
    for role in ("teacher", "student", "superadmin"):
        c, _ = await as_user(f"u-{role}", role=role)
        assert (await c.get("/admin/survey-sheets")).status_code == 403
        assert (await c.post("/admin/survey-sheets", json=sheet())).status_code == 403


async def test_blank_fields_and_a_limit_above_the_choices(as_user):
    admin, _ = await as_user("root", role="admin")
    bad = sheet(
        title=" ",
        questions=[
            single("a", text=""),
            multi("b", choices=["x", " ", "z"], limit={"min": 4}),
            open_("c", text=" "),
        ],
    )
    r = await admin.post("/admin/survey-sheets", json=bad)
    assert r.status_code == 400 and r.json()["code"] == "SURVEY_INVALID"
    assert [(i["code"], i["field"]) for i in r.json()["issues"]] == [
        ("FIELD_REQUIRED", "title"),
        ("FIELD_REQUIRED", "a:text"),
        ("FIELD_REQUIRED", "b:choice:2"),
        ("LIMIT_TOO_HIGH", "b:limit"),
        ("FIELD_REQUIRED", "c:text"),
    ]


async def test_shape_errors_are_validation_errors(as_user):
    admin, _ = await as_user("root", role="admin")
    cases = [
        sheet(questions=[]),
        sheet(questions=[single(choices=["only"])]),
        sheet(questions=[single(choices=[str(n) for n in range(31)])]),
        sheet(questions=[multi(limit={"min": 0})]),
        sheet(questions=[multi(limit={"max": 0})]),
        sheet(questions=[open_(maxWords=101)]),
        sheet(questions=[open_(maxWords=0)]),
        sheet(questions=[single("x"), open_("x")]),
        sheet(questions=[{"id": "q", "kind": "rating", "text": "?"}]),
    ]
    for body in cases:
        r = await admin.post("/admin/survey-sheets", json=body)
        assert (r.status_code, r.json()["code"]) == (422, "VALIDATION_ERROR"), body


async def test_thirty_choices_are_allowed(as_user):
    admin, _ = await as_user("root", role="admin")
    r = await admin.post(
        "/admin/survey-sheets", json=sheet(questions=[multi(choices=[str(n) for n in range(30)])])
    )
    assert r.status_code == 201


async def test_a_min_above_the_max_is_a_range_error(as_user):
    admin, _ = await as_user("root", role="admin")
    bad = sheet(
        questions=[
            multi("a", choices=["x", "y", "z"], limit={"min": 3, "max": 2}),
            multi("b", choices=["x", "y", "z"], limit={"min": 1, "max": 4}),
            multi("c", choices=["x", "y", "z"], limit={"min": 2, "max": 3}),
        ]
    )
    r = await admin.post("/admin/survey-sheets", json=bad)
    assert [(i["code"], i["field"]) for i in r.json()["issues"]] == [
        ("LIMIT_RANGE", "a:limit"),
        ("LIMIT_TOO_HIGH", "b:limit"),
    ]
