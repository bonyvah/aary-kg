import re

from app.security import PASSWORD_ALPHABET, generate_password, hash_password, verify_password


def test_generated_password_shape():
    for _ in range(50):
        pw = generate_password()
        assert re.fullmatch(r"[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){2}", pw)
        assert all(c in PASSWORD_ALPHABET + "-" for c in pw)


def test_alphabet_has_no_lookalikes():
    assert len(PASSWORD_ALPHABET) == 55
    assert not set("01OlI") & set(PASSWORD_ALPHABET)


def test_hash_roundtrip():
    h = hash_password("secret")
    assert verify_password(h, "secret")
    assert not verify_password(h, "other")
    assert not verify_password("garbage", "secret")
