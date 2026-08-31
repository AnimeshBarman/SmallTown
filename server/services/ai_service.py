import os
import json
from groq import Groq

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY is missing in your .env file!")

client = Groq(api_key=GROQ_API_KEY)

def extract_search_intent(user_query: str) -> dict:
    """
    Utilizes Groq's Llama-3.1 model with native JSON mode 
    to extract real estate search parameters deterministically.
    """
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
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_query}
            ],
            model="llama-3.1-8b-instant", 
            response_format={"type": "json_object"}, 
            temperature=0.1
        )

        response_text = chat_completion.choices[0].message.content
        if not response_text:
            return {}

        return json.loads(response_text)

    except Exception as e:
        raise RuntimeError(f"Groq Service Execution Failed: {str(e)}")