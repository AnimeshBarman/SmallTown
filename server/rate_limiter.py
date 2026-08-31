from fastapi import Request, HTTPException, status
from redis_client import redis_client

async def rate_limit_by_ip(request: Request):
    """
    Limits requests to 5 per minute per IP address using Redis.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    rate_limit_key = f"rate_limit:{client_ip}"

    # Get current request count for this IP
    current_requests = await redis_client.get(rate_limit_key)

    if current_requests and int(current_requests) >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. You can only make 5 searches per minute..!"
        )

    async with redis_client.pipeline(transaction=True) as pipe:
        await pipe.incr(rate_limit_key)
        if not current_requests:
            await pipe.expire(rate_limit_key, 60) # Expire key after 1 minute
        await pipe.execute()