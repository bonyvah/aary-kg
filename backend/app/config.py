from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="AARY_", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/aary"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = Field(min_length=32)
    jwt_ttl_minutes: int = 720
    cookie_secure: bool = False
    # "production" makes the app refuse to start with unsafe settings (see check_production).
    env: Literal["dev", "production"] = "dev"
    # How many reverse proxies stand in front of the app. 0: nobody is trusted to say who the client
    # is, X-Forwarded-For is ignored. 1: one proxy, whose last X-Forwarded-For entry is the client.
    trusted_proxy_hops: int = Field(default=0, ge=0, le=5)
    # Extra browser origins allowed to open the game WebSockets, comma separated
    # (the site's own host is always allowed).
    allowed_origins: str = ""

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
        if problems:
            raise RuntimeError("Unsafe production settings:\n- " + "\n- ".join(problems))

    @property
    def allowed_origin_list(self) -> list[str]:
        return [o.strip().rstrip("/").lower() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
