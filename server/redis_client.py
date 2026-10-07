import redis.asyncio as redis
from config import settings


redis_client = redis.from_url(
    settings.REDIS_URL,
    encoding="utf-8",
    decode_responses=True
)

async def check_redis_connection() -> None:
        await redis_client.ping()