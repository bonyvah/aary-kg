"""The one engine of this process, wired to Redis (live state) and Postgres (history)."""

from app.game.engine import GameEngine
from app.game.hub import Hub
from app.game.state_repo import RedisGameStateRepo
from app.redis import get_redis
from app.services.games import persist_finished

_engine: GameEngine | None = None
_hub: Hub | None = None


def get_hub() -> Hub:
    global _hub
    if _hub is None:
        _hub = Hub(get_redis())
    return _hub


def get_engine() -> GameEngine:
    global _engine
    if _engine is None:
        _engine = GameEngine(RedisGameStateRepo(get_redis()), get_hub(), on_finished=persist_finished)
    return _engine
