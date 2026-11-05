import logging
import re
from urllib.parse import unquote, urlsplit

from config import settings

logger = logging.getLogger(__name__)


def is_trusted_property_image_url(value: str) -> bool:
    try:
        image_url = urlsplit(value)
        storage_url = urlsplit(settings.SUPABASE_URL)
    except ValueError:
        return False
    storage_path = storage_url.path.rstrip("/")
    expected_prefix = f"{storage_path}/storage/v1/object/public/property-images/"

    filename = unquote(image_url.path[len(expected_prefix):])
    return (
        image_url.scheme == "https"
        and image_url.netloc.lower() == storage_url.netloc.lower()
        and not image_url.username
        and not image_url.password
        and not image_url.query
        and not image_url.fragment
        and image_url.path.startswith(expected_prefix)
        and re.fullmatch(
            r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp",
            filename,
        ) is not None
    )


def filter_trusted_property_image_urls(values: object) -> list[str]:
    if not isinstance(values, list):
        return []

    trusted_urls = [
        value
        for value in values
        if isinstance(value, str) and is_trusted_property_image_url(value)
    ]
    rejected_count = len(values) - len(trusted_urls)
    if rejected_count:
        logger.warning(
            "Filtered %d untrusted image URL(s) from a property response.",
            rejected_count,
        )
    return trusted_urls
