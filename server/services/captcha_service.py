import logging

import httpx
from fastapi import HTTPException, Request, status

from config import settings


logger = logging.getLogger(__name__)
TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


async def verify_listing_captcha(request: Request, token: str) -> None:
    secret_key = settings.TURNSTILE_SECRET_KEY
    if not secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Listing verification is not configured. Please contact the site administrator.",
        )

    client_ip = request.client.host if request.client else None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                TURNSTILE_VERIFY_URL,
                data={
                    "secret": secret_key,
                    "response": token,
                    **({"remoteip": client_ip} if client_ip else {}),
                },
            )
            response.raise_for_status()
            verification = response.json()
    except (httpx.HTTPError, ValueError):
        logger.exception("Cloudflare Turnstile verification service failed.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Listing verification is temporarily unavailable. Please try again.",
        ) from None

    if (
        not isinstance(verification, dict)
        or verification.get("success") is not True
        or verification.get("action") != "listing"
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please complete the security check and try again.",
        )
