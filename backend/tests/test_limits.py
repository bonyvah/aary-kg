"""Request size limit, response headers and framework errors as codes."""


# --- request size ---------------------------------------------------------------------------


async def test_a_huge_request_is_refused_before_it_is_read(client):
    r = await client.post("/auth/login", json={"login": "a", "password": "x" * 300_000})
    assert (r.status_code, r.json()) == (413, {"code": "PAYLOAD_TOO_LARGE", "field": None})


async def test_a_streamed_body_without_a_length_is_cut_off_too(client):
    async def chunks():
        for _ in range(40):
            yield b'{"login": "a", "password": "' + b"x" * 10_000 + b'"}'

    r = await client.post("/auth/login", content=chunks(), headers={"Content-Type": "application/json"})
    assert r.status_code == 413


async def test_a_normal_big_request_still_goes_through(client):
    # about 100 KB: a large quiz is far below this
    r = await client.post("/auth/login", json={"login": "a", "password": "x" * 100_000})
    assert r.status_code == 401  # reached the login check: wrong credentials, not too large


# --- headers --------------------------------------------------------------------------------


async def test_every_response_says_nosniff_and_private_ones_are_not_cached(client):
    health = await client.get("/health")
    assert health.headers["x-content-type-options"] == "nosniff"
    assert "cache-control" not in health.headers
    for path in ("/auth/me", "/quizzes", "/contests", "/games", "/admin/users", "/users/directory"):
        r = await client.get(path)
        assert r.headers["cache-control"] == "no-store", path
        assert r.headers["x-content-type-options"] == "nosniff", path


async def test_framework_errors_are_codes_too_not_english_text(client):
    r = await client.get("/no/such/route")
    assert (r.status_code, r.json()) == (404, {"code": "NOT_FOUND", "field": None})
    r = await client.delete("/health")
    assert (r.status_code, r.json()["code"]) == (405, "METHOD_NOT_ALLOWED")
