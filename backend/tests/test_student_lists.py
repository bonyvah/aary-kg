"""Adding students from a list. The model is never called here: `read` is replaced."""

import io

import pytest
from openpyxl import Workbook

from app.ai import students
from app.ai.questions import AiFailed
from app.config import get_settings
from app.repositories import users as users_repo
from tests.conftest import login_as, make_user

STUDENT = {"firstName": "Адилет", "lastName": "Бакыт уулу", "login": "adilet.bakyt"}


def _xlsx(rows: list[list[object]]) -> bytes:
    workbook = Workbook()
    for row in rows:
        workbook.active.append(row)
    out = io.BytesIO()
    workbook.save(out)
    return out.getvalue()


def _docx(text: str) -> bytes:
    from docx import Document

    out = io.BytesIO()
    document = Document()
    document.add_paragraph(text)
    document.save(out)
    return out.getvalue()


@pytest.fixture
def fake_ai(monkeypatch):
    sent: list[str] = []
    answer = [{"first_name": "Адилет", "last_name": "Бакыт уулу", "login": "adilet.bakyt"}]

    async def read(text):
        sent.append(text)
        return answer

    monkeypatch.setattr(students, "read", read)
    monkeypatch.setattr(get_settings(), "openai_api_key", "test-key")
    sent_answer = sent, answer
    return sent_answer


async def admin(client):
    await make_user("root", role="admin")
    await login_as(client, "root")


async def group(client, name="10-А") -> str:
    r = await client.post("/admin/groups", json={"name": name})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_a_short_list_is_enough():
    assert students.text_of_paste("  Асанов   Бек \n\n") == "Асанов Бек"


def test_excel_rows_become_lines():
    data = _xlsx([["№", "ФИО"], [1, "Асанов Бек"], [2, None]])
    assert students.text_of_file("xlsx", data) == "№ | ФИО\n1 | Асанов Бек\n2"


def test_word_lists_are_read():
    assert students.text_of_file("docx", _docx("Асанов Бек")) == "Асанов Бек"


@pytest.mark.parametrize("kind", ["xlsx", "docx"])
def test_a_broken_file_is_unreadable(kind):
    with pytest.raises(students.materials.UnreadableMaterial):
        students.text_of_file(kind, b"not a real file")


def test_an_excel_file_that_unpacks_too_far_is_unreadable(monkeypatch):
    monkeypatch.setattr(students, "MAX_UNPACKED_BYTES", 10)
    with pytest.raises(students.materials.UnreadableMaterial):
        students.text_of_file("xlsx", _xlsx([["Асанов Бек"]]))


def test_a_list_too_long_is_refused_not_cut():
    with pytest.raises(students.ListTooLong):
        students.text_of_paste("Асанов Бек\n" * students.MAX_CHARS)


def test_the_answer_is_cleaned():
    cleaned = students._clean(
        {
            "students": [
                {"firstName": " Бек ", "lastName": "Асанов", "login": "bek.asanov"},
                {"firstName": " ", "lastName": "", "login": "nobody"},
            ]
        }
    )
    assert cleaned == [{"first_name": "Бек", "last_name": "Асанов", "login": "bek.asanov"}]


async def test_only_admins_read_or_create(client):
    await make_user("ulan")
    await login_as(client, "ulan")
    r = await client.post("/admin/users/bulk/parse", data={"text": "Асанов Бек"})
    assert (r.status_code, r.json()["code"]) == (403, "FORBIDDEN")
    r = await client.post("/admin/users/bulk", json={"password": "x", "students": [STUDENT]})
    assert (r.status_code, r.json()["code"]) == (403, "FORBIDDEN")


async def test_pasted_text_gives_a_proposal(client, fake_ai):
    sent, _ = fake_ai
    await admin(client)
    r = await client.post("/admin/users/bulk/parse", data={"text": "Бакыт уулу Адилет"})
    assert r.status_code == 200, r.text
    assert r.json() == [STUDENT]
    assert sent == ["Бакыт уулу Адилет"]
    assert (await client.get("/admin/users")).json() == []  # nothing saved


async def test_a_file_gives_a_proposal(client, fake_ai):
    sent, _ = fake_ai
    await admin(client)
    files = {"file": ("list.xlsx", _xlsx([["Бакыт уулу Адилет"]]), "application/octet-stream")}
    r = await client.post("/admin/users/bulk/parse", files=files)
    assert r.status_code == 200, r.text
    assert sent == ["Бакыт уулу Адилет"]


async def test_taken_logins_get_a_number_and_invalid_ones_are_blank(client, fake_ai):
    _, answer = fake_ai
    await admin(client)
    await make_user("bek.asanov")
    answer[:] = [
        {"first_name": "Бек", "last_name": "Асанов", "login": "Bek.Asanov"},
        {"first_name": "Бек", "last_name": "Асанов", "login": "bek.asanov"},
        {"first_name": "Айжан", "last_name": "Бекова", "login": "айжан бекова"},
    ]
    r = await client.post("/admin/users/bulk/parse", data={"text": "x"})
    assert [s["login"] for s in r.json()] == ["bek.asanov2", "bek.asanov3", ""]


@pytest.mark.parametrize(
    ("data", "files", "status", "code"),
    [
        ({"text": "  "}, None, 400, "MATERIAL_REQUIRED"),
        (None, {"file": ("list.doc", b"x", "application/msword")}, 415, "UNSUPPORTED_FILE"),
        (None, {"file": ("list.xlsx", b"x", "application/octet-stream")}, 400, "MATERIAL_UNREADABLE"),
    ],
)
async def test_what_cannot_be_read_is_refused(client, fake_ai, data, files, status, code):
    await admin(client)
    r = await client.post("/admin/users/bulk/parse", data=data, files=files)
    assert (r.status_code, r.json()["code"]) == (status, code)


async def test_a_list_with_nobody_in_it(client, fake_ai):
    _, answer = fake_ai
    answer.clear()
    await admin(client)
    r = await client.post("/admin/users/bulk/parse", data={"text": "Сабак"})
    assert (r.status_code, r.json()["code"]) == (400, "NO_STUDENTS_FOUND")


async def test_a_model_failure_has_its_code(client, monkeypatch):
    async def read(_):
        raise AiFailed

    monkeypatch.setattr(students, "read", read)
    monkeypatch.setattr(get_settings(), "openai_api_key", "test-key")
    await admin(client)
    r = await client.post("/admin/users/bulk/parse", data={"text": "Асанов Бек"})
    assert (r.status_code, r.json()["code"]) == (502, "AI_FAILED")


async def test_without_a_key_it_is_not_configured(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "openai_api_key", "")
    await admin(client)
    r = await client.post("/admin/users/bulk/parse", data={"text": "Асанов Бек"})
    assert (r.status_code, r.json()["code"]) == (503, "AI_NOT_CONFIGURED")


async def test_all_get_the_same_password_and_the_group(client):
    await admin(client)
    group_id = await group(client)
    other = {"firstName": "Айжан", "lastName": "Бекова", "login": "aizhan.bekova"}
    r = await client.post(
        "/admin/users/bulk",
        json={"groupId": group_id, "password": "tulpar-9421", "students": [STUDENT, other]},
    )
    assert r.status_code == 201, r.text
    assert [(u["login"], u["role"], u["groupId"]) for u in r.json()] == [
        ("adilet.bakyt", "student", group_id),
        ("aizhan.bekova", "student", group_id),
    ]
    assert "password" not in r.json()[0]
    for login in ("adilet.bakyt", "aizhan.bekova"):
        fresh = type(client)(transport=client._transport, base_url="http://test")
        await login_as(fresh, login, "tulpar-9421")
        await fresh.aclose()


async def test_the_password_is_required_and_follows_the_rules(client):
    await admin(client)
    group_id = await group(client)
    cases = [
        ("", "FIELD_REQUIRED"),
        ("short1", "PASSWORD_TOO_SHORT"),
        ("adilet-2026-x", "PASSWORD_CONTAINS_NAME"),
    ]
    for password, code in cases:
        r = await client.post(
            "/admin/users/bulk", json={"groupId": group_id, "password": password, "students": [STUDENT]}
        )
        assert (r.status_code, r.json()) == (400, {"code": code, "field": "password"}), password


async def test_a_group_is_required(client):
    await admin(client)
    r = await client.post("/admin/users/bulk", json={"password": "tulpar-9421", "students": [STUDENT]})
    assert (r.status_code, r.json()["code"]) == (400, "GROUP_REQUIRED")


async def test_every_bad_row_is_listed_and_nobody_is_added(client):
    await admin(client)
    group_id = await group(client)
    await make_user("taken.login")
    rows = [
        STUDENT,
        {"firstName": "", "lastName": "Асанов", "login": "бек"},
        {"firstName": "Бек", "lastName": "Асанов", "login": "taken.login"},
        {"firstName": "Бек", "lastName": "Асанов", "login": "ADILET.bakyt"},
    ]
    r = await client.post(
        "/admin/users/bulk", json={"groupId": group_id, "password": "tulpar-9421", "students": rows}
    )
    assert r.status_code == 400
    assert r.json()["code"] == "STUDENTS_INVALID"
    assert r.json()["issues"] == [
        {"code": "FIELD_REQUIRED", "field": "students.1.firstName"},
        {"code": "LOGIN_INVALID", "field": "students.1.login"},
        {"code": "LOGIN_TAKEN", "field": "students.2.login"},
        {"code": "LOGIN_TAKEN", "field": "students.3.login"},
    ]
    assert [u["login"] for u in (await client.get("/admin/users")).json()] == ["taken.login"]


async def test_a_login_taken_in_a_race_is_marked_on_its_row(client, monkeypatch):
    await admin(client)
    group_id = await group(client)
    await make_user("adilet.bakyt")
    real = users_repo.all_logins
    answers = [set()]

    # The first look misses the login, as if the other create had not finished yet.
    async def all_logins(session):
        return answers.pop() if answers else await real(session)

    monkeypatch.setattr(users_repo, "all_logins", all_logins)
    other = {"firstName": "Бек", "lastName": "Асанов", "login": "bek.asanov"}
    body = {"groupId": group_id, "password": "tulpar-9421", "students": [other, STUDENT]}
    r = await client.post("/admin/users/bulk", json=body)
    assert r.status_code == 400
    assert r.json()["code"] == "STUDENTS_INVALID"
    assert r.json()["issues"] == [{"code": "LOGIN_TAKEN", "field": "students.1.login"}]
    assert [u["login"] for u in (await client.get("/admin/users")).json()] == ["adilet.bakyt"]


async def test_the_list_has_a_limit(client):
    await admin(client)
    group_id = await group(client)
    rows = [STUDENT] * (students.MAX_STUDENTS + 1)
    r = await client.post(
        "/admin/users/bulk", json={"groupId": group_id, "password": "tulpar-9421", "students": rows}
    )
    assert (r.status_code, r.json()["code"]) == (422, "VALIDATION_ERROR")
