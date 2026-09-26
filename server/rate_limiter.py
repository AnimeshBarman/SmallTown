from fastapi import Request, HTTPException, status
from redis_client import redis_client

async def rate_limit_by_ip(request: Request):
    ## Limits 5 requests per IP address.

    client_ip = request.client.host if request.client else "127.0.0.1"
    rate_limit_key = f"rate_limit:{client_ip}"

    script = """
    local key = KEYS[1]
    local limit = tonumber(ARGV[1])
    local window = tonumber(ARGV[2])

    local current = redis.call("INCR", key)
    if current == 1 then
        redis.call("EXPIRE", key, window)
    end

    if current > limit then
        return 0
    end

    return current
    """

    result = await redis_client.eval(script, 1, rate_limit_key, 5, 60)

    if result == 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. You can only make 5 searches per minute."
        )