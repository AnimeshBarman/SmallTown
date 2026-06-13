import os
import json
import google.generativeai as genai
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db
from models.db_models import Property, Landmark
from schemas.property_schema import PropertyResponse
from schemas.search_schema import SearchRequest

router = APIRouter()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY environment variable is not set. Please set it in your .env..!")



genai.configure(api_key=GEMINI_API_KEY) # type: ignore
model = genai.GenerativeModel('gemini-1.5-flash') # type: ignore

@router.post("/nlp", response_model=List[PropertyResponse])
def ai_powered_search(request: SearchRequest, db: Session = Depends(get_db)):
    try:
        prompt = f"""
        You are an AI for a room rental app. Extract search parameters from the query.
        Query: "{request.query}"
        
        Return ONLY a valid, raw JSON object (no markdown, no quotes) with these exact keys. Use null if not mentioned:
        - "property_type" (must be "room", "pg", or "flat")
        - "max_price" (integer representing maximum rent)
        - "landmark" (string representing a specific place name)
        """
        
        ai_response = model.generate_content(prompt)
        
        raw_text = ai_response.text.strip().removeprefix('```json').removesuffix('```').strip()
        search_params = json.loads(raw_text)

        # --- 2. POSTGIS SPATIAL SEARCH (Database) ---
        query = db.query(Property).filter(Property.status == 'active')

        if search_params.get('property_type'):
            query = query.filter(Property.type == search_params['property_type'].lower())

        if search_params.get('max_price'):
            query = query.filter(Property.price <= search_params['max_price'])

        if search_params.get('landmark'):
            landmark = db.query(Landmark).filter(func.lower(Landmark.name).contains(search_params['landmark'].lower())).first()
            
            if landmark:
                query = query.filter(func.ST_DWithin(Property.coordinates, landmark.coordinates, 2000))

        results = query.all()
        return results

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Engine Error: {str(e)}")