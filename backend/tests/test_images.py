import io

import pytest
from PIL import Image

from app import images
from app.config import get_settings


def picture(size=(40, 30), fmt="PNG", mode="RGB", color="red", **save) -> bytes:
    out = io.BytesIO()
    Image.new(mode, size, color).save(out, fmt, **save)
    return out.getvalue()


def decoded(data: bytes) -> Image.Image:
    image = Image.open(io.BytesIO(data))
    image.load()
    return image


def test_any_accepted_format_becomes_webp():
    for fmt in ("PNG", "JPEG", "WEBP", "GIF"):
        out = decoded(images.encode(picture(fmt=fmt)))
        assert out.format == "WEBP"
        assert out.size == (40, 30)


def test_big_pictures_are_shrunk_to_the_longest_side():
    out = decoded(images.encode(picture(size=(4000, 1000), fmt="JPEG")))
    assert out.size == (images.MAX_SIDE, 400)


def test_a_phone_photo_is_turned_upright_and_loses_its_metadata():
    exif = Image.Exif()
    exif[0x0112] = 6  # orientation: rotated 90 degrees
    exif[0x010F] = "PhoneMaker"
    out = decoded(images.encode(picture(size=(40, 30), fmt="JPEG", exif=exif.tobytes())))
    assert out.size == (30, 40)
    assert not out.getexif()


def test_transparency_is_kept():
    out = decoded(images.encode(picture(mode="RGBA", color=(255, 0, 0, 128))))
    assert out.mode == "RGBA"


@pytest.mark.parametrize("data", [b"not an image", b"", b"%PDF-1.7\n", picture(fmt="BMP")])
def test_anything_else_is_refused(data):
    with pytest.raises(images.NotAnImage):
        images.encode(data)


def test_the_same_picture_gets_the_same_id():
    a, b = images.encode(picture()), images.encode(picture())
    assert images.image_id(a) == images.image_id(b)
    assert images.is_id(images.image_id(a))


@pytest.fixture
def bucket(monkeypatch):
    """The R2 bucket, as a dict."""
    stored: dict[str, bytes] = {}

    async def store(webp: bytes) -> str:
        image = images.image_id(webp)
        stored[image] = webp
        return image

    monkeypatch.setattr(get_settings(), "r2_endpoint", "http://bucket.test")
    monkeypatch.setattr(images, "store", store)
    return stored


async def test_a_teacher_uploads_an_image(as_user, bucket):
    c, _ = await as_user("ulan")
    r = await c.post("/images", files={"file": ("cat.jpg", picture(fmt="JPEG"), "image/jpeg")})
    assert r.status_code == 201, r.text
    assert list(bucket) == [r.json()["id"]]


async def test_only_teachers_upload(as_user, bucket):
    c, _ = await as_user("aizhan", role="admin")
    r = await c.post("/images", files={"file": ("cat.png", picture(), "image/png")})
    assert r.status_code == 403
    assert bucket == {}


async def test_a_file_that_is_not_an_image_is_refused(as_user, bucket):
    c, _ = await as_user("ulan")
    r = await c.post("/images", files={"file": ("cat.png", b"<svg onload=alert(1)>", "image/png")})
    assert r.status_code == 415
    assert r.json()["code"] == "UNSUPPORTED_FILE"


async def test_too_big_a_file_is_refused(as_user, bucket):
    c, _ = await as_user("ulan")
    big = b"\0" * (images.MAX_UPLOAD_BYTES + 1)
    r = await c.post("/images", files={"file": ("big.png", big, "image/png")})
    assert r.status_code == 413
    assert bucket == {}


async def test_without_a_bucket_uploads_are_off(as_user, monkeypatch):
    monkeypatch.setattr(get_settings(), "r2_endpoint", "")
    c, _ = await as_user("ulan")
    r = await c.post("/images", files={"file": ("cat.png", picture(), "image/png")})
    assert r.status_code == 503
    assert r.json()["code"] == "IMAGES_NOT_CONFIGURED"
