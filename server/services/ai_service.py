import os
import json
import re
from groq import Groq
from dotenv import load_dotenv


load_dotenv()

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
            model="qwen/qwen3.8-27b", 
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_query}
            ],
            temperature=0.1
        )

        raw_content = chat_completion.choices[0].message.content
        if not raw_content:
            return {}

        # Use regex to extract JSON object more robustly
        json_match = re.search(r'\{.*\}', raw_content, re.DOTALL)
        if json_match:
            cleaned_json = json_match.group(0)
        else:
            # Fallback to manual extraction
            start_idx = raw_content.find("{")
            end_idx = raw_content.rfind("}")
            if start_idx != -1 and end_idx != -1:
                cleaned_json = raw_content[start_idx : end_idx + 1]
            else:
                raise ValueError("No JSON object found in response")

        return json.loads(cleaned_json)

    except json.JSONDecodeError as e:
        raise RuntimeError(f"Failed to parse JSON from LLM response: {str(e)}")

    except Exception as e:
        raise RuntimeError(f"Groq Service Execution Failed: {str(e)}")