from app.services import auth as auth_service
from tests.conftest import make_user


async def attempt(client, login, password):
    return await client.post("/auth/login", json={"login": login, "password": password})


async def test_eight_wrong_passwords_lock_that_login_even_for_the_right_one(client):
    await make_user("aizhan")
    for _ in range(auth_service.FAIL_LIMIT):
        assert (await attempt(client, "aizhan", "wrong")).status_code == 401
    locked = await attempt(client, "aizhan", "pw-12345")  # the right password, too late
    assert (locked.status_code, locked.json()["code"]) == (429, "RATE_LIMITED")


async def test_other_logins_are_not_affected_by_a_lock(client):
    await make_user("aizhan")
    await make_user("ulan")
    for _ in range(auth_service.FAIL_LIMIT):
        await attempt(client, "aizhan", "wrong")
    assert (await attempt(client, "ulan", "pw-12345")).status_code == 200


async def test_a_successful_login_clears_the_failures(client):
    await make_user("aizhan")
    for _ in range(auth_service.FAIL_LIMIT - 1):
        await attempt(client, "aizhan", "wrong")
    assert (await attempt(client, "aizhan", "pw-12345")).status_code == 200
    for _ in range(auth_service.FAIL_LIMIT - 1):  # the count started again from zero
        assert (await attempt(client, "aizhan", "wrong")).status_code == 401
    assert (await attempt(client, "aizhan", "pw-12345")).status_code == 200


async def test_unknown_logins_are_throttled_too_and_look_the_same(client):
    for _ in range(auth_service.FAIL_LIMIT):
        assert (await attempt(client, "ghost", "x")).json()["code"] == "INVALID_CREDENTIALS"
    assert (await attempt(client, "ghost", "x")).json()["code"] == "RATE_LIMITED"


async def test_login_is_case_and_space_insensitive_for_the_lock(client):
    await make_user("aizhan")
    for variant in ["aizhan", "AIZHAN", " Aizhan ", "aizhan", "AiZhAn", "aizhan", "aizhan ", " aizhan"]:
        await attempt(client, variant, "wrong")
    assert (await attempt(client, "aizhan", "pw-12345")).json()["code"] == "RATE_LIMITED"


async def test_one_address_cannot_try_many_logins(client):
    for i in range(auth_service.IP_LIMIT):
        await attempt(client, f"nobody{i}", "x")
    r = await attempt(client, "someone-else", "x")
    assert (r.status_code, r.json()["code"]) == (429, "RATE_LIMITED")


async def test_blank_credentials_are_a_plain_error_and_do_not_count(client):
    await make_user("aizhan")
    for _ in range(auth_service.IP_LIMIT + 5):
        assert (await attempt(client, "aizhan", "")).json()["code"] == "CREDENTIALS_REQUIRED"
    assert (await attempt(client, "aizhan", "pw-12345")).status_code == 200
