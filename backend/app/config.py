from functools import lru_cache
from typing import Literal
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="AARY_", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/aary"
    redis_url: str = "redis://localhost:6379/0"
    # Connections this process may hold open to Redis. Requests wait for a free one.
    redis_max_connections: int = Field(default=100, ge=2, le=2000)
    jwt_secret: str = Field(min_length=32)
    jwt_ttl_minutes: int = 720
    cookie_secure: bool = False
    # "production" makes the app refuse to start with unsafe settings (see check_production).
    env: Literal["dev", "production"] = "dev"
    # How many reverse proxies stand in front of the app. 0: nobody is trusted to say who the client
    # is, X-Forwarded-For is ignored. 1: one proxy, whose last X-Forwarded-For entry is the client.
    trusted_proxy_hops: int = Field(default=0, ge=0, le=5)
    # Shared with the web app when it runs on another host than the backend (Vercel): the web app's
    # /api proxy sends it with the visitor's address (X-Aary-Proxy, X-Aary-Client-Ip), and requests
    # that carry it are counted by that address. Empty: those headers are ignored.
    proxy_secret: str = ""
    # Extra browser origins allowed to open the game WebSockets, comma separated
    # (the site's own host is always allowed).
    allowed_origins: str = ""
    # Questions from teaching material. The key is read as OPENAI_API_KEY too, its usual name.
    # Empty: the feature answers AI_NOT_CONFIGURED.
    openai_api_key: str = Field(
        default="", validation_alias=AliasChoices("AARY_OPENAI_API_KEY", "OPENAI_API_KEY")
    )
    openai_model: str = "gpt-5.4-mini"
    # Generations per teacher per day.
    ai_daily_limit: int = Field(default=20, ge=0, le=1000)
    # Quiz and question images, in a Cloudflare R2 bucket (any S3-compatible store: MinIO in dev).
    # The bucket is read publicly by the browsers; only the backend writes. Empty endpoint: uploads
    # answer IMAGES_NOT_CONFIGURED.
    r2_endpoint: str = ""  # https://<account id>.r2.cloudflarestorage.com
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = "aary-images"
    # Uploads per teacher per day.
    image_daily_limit: int = Field(default=300, ge=0, le=10000)

    @field_validator("database_url")
    @classmethod
    def _asyncpg_url(cls, url: str) -> str:
        """Accept the URL as a host hands it out (Neon: `postgresql://...?sslmode=require&channel_binding=require`).
        asyncpg wants its own driver name, `ssl=` instead of `sslmode=`, and has no channel_binding."""
        parts = urlsplit(url)
        scheme = parts.scheme
        if scheme in ("postgres", "postgresql"):
            scheme = "postgresql+asyncpg"
        query = [
            ("ssl" if key == "sslmode" else key, value)
            for key, value in parse_qsl(parts.query)
            if key != "channel_binding"
        ]
        return urlunsplit((scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))

    def check_production(self) -> None:
        """Refuse to start in production with settings that would quietly weaken security."""
        if self.env != "production":
            return
        problems = []
        if not self.cookie_secure:
            problems.append(
                "AARY_COOKIE_SECURE must be true (the session cookie must only travel over https)"
            )
        secret = self.jwt_secret.lower()
        if any(word in secret for word in ("change-me", "changeme", "dev-secret", "test-secret", "example")):
            problems.append("AARY_JWT_SECRET is a placeholder: generate a real one")
        if len(set(self.jwt_secret)) < 12:
            problems.append("AARY_JWT_SECRET has too little variety: generate a random one")
        if not self.allowed_origin_list:
            problems.append(
                "AARY_ALLOWED_ORIGINS must list the public site origin, e.g. https://quiz.example"
            )
        if self.proxy_secret and len(self.proxy_secret) < 32:
            problems.append("AARY_PROXY_SECRET is too short: generate a random one of 32+ characters")
        if problems:
            raise RuntimeError("Unsafe production settings:\n- " + "\n- ".join(problems))

    @property
    def allowed_origin_list(self) -> list[str]:
        return [o.strip().rstrip("/").lower() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
