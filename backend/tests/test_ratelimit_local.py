from app.game import ratelimit


def test_local_window_allows_the_limit_then_refuses_until_the_window_passes(monkeypatch):
    now = [100.0]
    monkeypatch.setattr(ratelimit.time, "monotonic", lambda: now[0])
    w = ratelimit.LocalWindow(limit=3, window_s=10)
    assert [w.allow() for _ in range(5)] == [True, True, True, False, False]
    now[0] += 9.9
    assert w.allow() is False
    now[0] += 0.1
    assert [w.allow() for _ in range(4)] == [True, True, True, False]
