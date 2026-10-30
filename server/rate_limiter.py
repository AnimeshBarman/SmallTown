import hashlib
import logging

from fastapi import HTTPException, Request, status
from redis.exceptions import RedisError

from redis_client import redis_client


logger = logging.getLogger(__name__)

SEARCH_REQUEST_LIMIT = 30
SEARCH_REQUEST_WINDOW_SECONDS = 60
AI_SEARCH_IP_LIMIT = 5
AI_SEARCH_GLOBAL_LIMIT = 60
AI_SEARCH_WINDOW_SECONDS = 60

UPLOAD_BATCH_LIMIT_PER_OWNER = 10
UPLOAD_BATCH_LIMIT_PER_IP = 30
UPLOAD_BATCH_WINDOW_SECONDS = 60 * 60

LOGIN_FAILURE_WINDOW_SECONDS = 15 * 60
LOGIN_FAILURES_PER_IP = 30
LOGIN_FAILURES_PER_IDENTITY_IP = 5

_FIXED_WINDOW_SCRIPT = """
local count = redis.call("INCR", KEYS[1])
if count == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return count
"""

_LOGIN_CHECK_SCRIPT = """
local identity_count = tonumber(redis.call("GET", KEYS[1]) or "0")
local ip_count = tonumber(redis.call("GET", KEYS[2]) or "0")
local identity_ttl = redis.call("TTL", KEYS[1])
local ip_ttl = redis.call("TTL", KEYS[2])

if identity_count >= tonumber(ARGV[1]) or ip_count >= tonumber(ARGV[2]) then
    return {0, math.max(identity_ttl, ip_ttl, 1)}
end
return {1, 0}
"""

_AI_SEARCH_LIMIT_SCRIPT = """
local ip_count = tonumber(redis.call("GET", KEYS[1]) or "0")
local global_count = tonumber(redis.call("GET", KEYS[2]) or "0")
local ip_ttl = redis.call("TTL", KEYS[1])
local global_ttl = redis.call("TTL", KEYS[2])

if ip_count >= tonumber(ARGV[1]) or global_count >= tonumber(ARGV[2]) then
    return {0, math.max(ip_ttl, global_ttl, 1)}
end

ip_count = redis.call("INCR", KEYS[1])
if ip_count == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[3])
end
global_count = redis.call("INCR", KEYS[2])
if global_count == 1 then
    redis.call("EXPIRE", KEYS[2], ARGV[3])
end
return {ip_count, global_count, 0}
"""

_UPLOAD_BATCH_LIMIT_SCRIPT = """
local owner_count = tonumber(redis.call("GET", KEYS[1]) or "0")
local ip_count = tonumber(redis.call("GET", KEYS[2]) or "0")
local owner_ttl = redis.call("TTL", KEYS[1])
local ip_ttl = redis.call("TTL", KEYS[2])

if owner_count >= tonumber(ARGV[1]) or ip_count >= tonumber(ARGV[2]) then
    return {0, math.max(owner_ttl, ip_ttl, 1)}
end

owner_count = redis.call("INCR", KEYS[1])
if owner_count == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[3])
end
ip_count = redis.call("INCR", KEYS[2])
if ip_count == 1 then
    redis.call("EXPIRE", KEYS[2], ARGV[3])
end
return {owner_count, ip_count, 0}
"""

_RECORD_LOGIN_FAILURE_SCRIPT = """
for _, key in ipairs(KEYS) do
    local count = redis.call("INCR", key)
    if count == 1 then
        redis.call("EXPIRE", key, ARGV[1])
    end
end
return 1
"""


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


async def _increment_fixed_window(key: str, window_seconds: int) -> int:
    try:
        return int(await redis_client.eval(_FIXED_WINDOW_SCRIPT, 1, key, window_seconds))
    except RedisError:
        logger.exception("Redis rate limiting is unavailable.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Request protection is temporarily unavailable. Please try again.",
        ) from None


async def rate_limit_search_requests(request: Request) -> None:
    ip_hash = _digest(_client_ip(request))
    count = await _increment_fixed_window(
        f"rate_limit:search:request:{ip_hash}",
        SEARCH_REQUEST_WINDOW_SECONDS,
    )
    if count > SEARCH_REQUEST_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many search requests. Please wait a minute and try again.",
            headers={"Retry-After": str(SEARCH_REQUEST_WINDOW_SECONDS)},
        )


async def rate_limit_ai_search_miss(request: Request) -> None:
    ip_hash = _digest(_client_ip(request))
    try:
        result = await redis_client.eval(
            _AI_SEARCH_LIMIT_SCRIPT,
            2,
            f"rate_limit:search:ai:ip:{ip_hash}",
            "rate_limit:search:ai:global",
            AI_SEARCH_IP_LIMIT,
            AI_SEARCH_GLOBAL_LIMIT,
            AI_SEARCH_WINDOW_SECONDS,
        )
    except RedisError:
        logger.exception("Redis AI search rate limiting is unavailable.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Search protection is temporarily unavailable. Please try again.",
        ) from None

    if int(result[0]) == 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="AI search is temporarily busy. Please try again in a minute.",
            headers={"Retry-After": str(AI_SEARCH_WINDOW_SECONDS)},
        )


async def rate_limit_image_upload(request: Request, owner_id: str) -> None:
    ip_hash = _digest(_client_ip(request))
    owner_hash = _digest(str(owner_id))
    try:
        result = await redis_client.eval(
            _UPLOAD_BATCH_LIMIT_SCRIPT,
            2,
            f"rate_limit:upload:owner:{owner_hash}",
            f"rate_limit:upload:ip:{ip_hash}",
            UPLOAD_BATCH_LIMIT_PER_OWNER,
            UPLOAD_BATCH_LIMIT_PER_IP,
            UPLOAD_BATCH_WINDOW_SECONDS,
        )
    except RedisError:
        logger.exception("Redis image upload rate limiting is unavailable.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image upload protection is temporarily unavailable. Please try again.",
        ) from None

    if int(result[0]) == 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many photo upload attempts. Please try again in an hour.",
            headers={"Retry-After": str(max(1, int(result[1])))},
        )


def _login_failure_keys(request: Request, username: str) -> tuple[str, str]:
    ip_hash = _digest(_client_ip(request))
    identity_hash = _digest(f"{username.strip().lower()}\0{ip_hash}")
    return (
        f"rate_limit:login:identity_ip:{identity_hash}",
        f"rate_limit:login:ip:{ip_hash}",
    )


async def check_login_rate_limit(request: Request, username: str) -> None:
    identity_key, ip_key = _login_failure_keys(request, username)
    try:
        allowed, retry_after = await redis_client.eval(
            _LOGIN_CHECK_SCRIPT,
            2,
            identity_key,
            ip_key,
            LOGIN_FAILURES_PER_IDENTITY_IP,
            LOGIN_FAILURES_PER_IP,
        )
    except RedisError:
        logger.exception("Redis login rate limiting is unavailable.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Sign-in protection is temporarily unavailable. Please try again.",
        ) from None

    if int(allowed) != 1:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed sign-in attempts. Please try again later.",
            headers={"Retry-After": str(max(1, int(retry_after)))},
        )


async def record_login_failure(request: Request, username: str) -> None:
    identity_key, ip_key = _login_failure_keys(request, username)
    try:
        await redis_client.eval(
            _RECORD_LOGIN_FAILURE_SCRIPT,
            2,
            identity_key,
            ip_key,
            LOGIN_FAILURE_WINDOW_SECONDS,
        )
    except RedisError:
        logger.exception("Redis login failure tracking is unavailable.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Sign-in protection is temporarily unavailable. Please try again.",
        ) from None


async def clear_login_identity_failures(request: Request, username: str) -> None:
    identity_key, _ = _login_failure_keys(request, username)
    try:
        await redis_client.delete(identity_key)
    except RedisError:
        logger.exception("Redis login failure state could not be cleared.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Sign-in protection is temporarily unavailable. Please try again.",
        ) from None
