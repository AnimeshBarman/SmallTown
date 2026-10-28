import json
import logging
import re
from groq import Groq
from config import settings


logger = logging.getLogger(__name__)
GROQ_API_KEY = settings.GROQ_API_KEY
if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY is missing in your .env file!")

client = Groq(api_key=GROQ_API_KEY, timeout=12.0, max_retries=1)


def _fallback_search_intent(user_query: str) -> dict:
    query = " ".join(user_query.lower().split())
    intent: dict[str, str | int | None] = {
        "property_type": None,
        "max_price": None,
        "landmark": None,
    }

    if re.search(r"\b(pg|paying guest|hostel)\b", query):
        intent["property_type"] = "pg"
    elif re.search(r"\b(flat|apartment|1\s*bhk|2\s*bhk|3\s*bhk)\b", query):
        intent["property_type"] = "flat"
    elif re.search(r"\b(room|single room|private room)\b", query):
        intent["property_type"] = "room"

    price_match = re.search(
        r"\b(?:under|below|less than|up to|upto|max(?:imum)?|budget(?: of)?)\s*"
        r"(?:₹|rs\.?\s*)?([\d,]+(?:\.\d+)?)\s*(k|thousand|lakh)?\b",
        query,
    )
    if price_match:
        amount = float(price_match.group(1).replace(",", ""))
        unit = price_match.group(2)
        if unit == "k" or unit == "thousand":
            amount *= 1000
        elif unit == "lakh":
            amount *= 100000
        intent["max_price"] = int(amount)

    landmark_match = re.search(
        r"\b(?:near|around|close to|by)\s+(.+?)(?:\s+(?:under|below|less than|up to|upto|max|budget)\b|$)",
        query,
    )
    if landmark_match:
        landmark = landmark_match.group(1).strip(" ,.")
        if landmark:
            intent["landmark"] = landmark[:100]

    return intent


def _normalize_search_intent(parsed: object, user_query: str) -> dict:
    if not isinstance(parsed, dict):
        raise ValueError("Search intent must be a JSON object.")

    fallback = _fallback_search_intent(user_query)
    extracted_type = parsed.get("property_type")
    valid_types = {"pg", "room", "flat"}
    property_type = fallback["property_type"]
    if property_type is None and isinstance(extracted_type, str) and extracted_type.strip().lower() in valid_types:
        property_type = extracted_type.strip().lower()

    raw_price = parsed.get("max_price")
    try:
        extracted_price = int(float(str(raw_price).replace(",", ""))) if raw_price is not None else None
    except (TypeError, ValueError):
        extracted_price = None
    max_price = fallback["max_price"] if fallback["max_price"] is not None else extracted_price
    if max_price is not None and max_price <= 0:
        max_price = fallback["max_price"]

    raw_landmark = parsed.get("landmark")
    landmark = fallback["landmark"]
    if landmark is None and isinstance(raw_landmark, str) and raw_landmark.strip():
        landmark = raw_landmark.strip()[:100]

    return {
        "property_type": property_type,
        "max_price": max_price,
        "landmark": landmark,
    }


def extract_search_intent(user_query: str) -> dict:
    # Use deterministic extraction for explicit constraints and Groq for flexible phrasing.
    try:
        system_prompt = (
            "You are a real estate assistant. Extract search parameters from the user query. "
            "You MUST return ONLY a valid JSON object matching this schema exactly:\n"
            "{\n"
            "  \"property_type\": \"pg\" or \"room\" or \"flat\" or null,\n"
            "  \"max_price\": integer or null,\n"
            "  \"landmark\": string or null\n"
            "}\n"
            "Rules:\n"
            "1. property_type must be strictly lowercase 'pg', 'room', 'flat', or null.\n"
            "2. Do not add any markdown blocks like ```json, return just the raw string."
        )

        chat_completion = client.chat.completions.create(
            model="qwen/qwen3.8-27b", 
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_query}
            ],
            response_format={"type": "json_object"},
            temperature=0.1
        )

        raw_content = chat_completion.choices[0].message.content
        if not raw_content:
            raise ValueError("Empty search intent response.")

        json_match = re.search(r'\{.*\}', raw_content, re.DOTALL)
        if not json_match:
            raise ValueError("No JSON object found in search intent response.")
        return _normalize_search_intent(json.loads(json_match.group(0)), user_query)
    except Exception:
        fallback = _fallback_search_intent(user_query)
        if any(fallback.values()):
            logger.warning("Using rule-based search intent after Groq extraction failed.", exc_info=True)
            return fallback
        logger.exception("Groq search intent extraction failed without usable fallback intent.")
        raise RuntimeError("Natural-language search is temporarily unavailable.")