from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

import sys
import os
import json
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db
from models.db_models import Property, Landmark
from schemas.property_schema import PropertyResponse
from schemas.search_schema import SearchRequest
from services.ai_service import extract_search_intent 
from redis_client import redis_client
from rate_limiter import rate_limit_by_ip


router = APIRouter()

CACHE_TTL_SECONDS = 86400 #1day TTL

@router.post("/nlp", response_model=List[PropertyResponse], dependencies=[Depends(rate_limit_by_ip)])
async def ai_powered_search(request: SearchRequest, db: Session = Depends(get_db)):
    try:

        normalized_query = " ".join(request.query.strip().lower().split())
        cache_key = f"search_cache:{normalized_query}"

        cached_result = await redis_client.get(cache_key)
        if cached_result:
            # CACHE HIT: Return directly from Redis in milliseconds
            return json.loads(cached_result)

        search_params = extract_search_intent(request.query)

        query = db.query(Property).filter(Property.status == 'active')

        if search_params.get('property_type'):
            query = query.filter(Property.type == search_params['property_type'].lower())

        if search_params.get('max_price'):
            query = query.filter(Property.price <= search_params['max_price'])

        if search_params.get('landmark'):
            landmark = db.query(Landmark).filter(
                func.lower(Landmark.name).contains(search_params['landmark'].lower())
            ).first()
            
            if landmark:
                query = query.filter(func.ST_DWithin(Property.coordinates, landmark.coordinates, 3000))

            results = query.all()

            # Serialize Pydantic/ORM results to JSON and store in Redis for 24 hours
            serialized_data = [PropertyResponse.model_validate(p).model_dump(mode="json") for p in results]
            await redis_client.setex(cache_key, CACHE_TTL_SECONDS, json.dumps(serialized_data))

        return results

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Search Endpoint Error: {str(e)}")