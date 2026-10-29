from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, cast, func, or_
from typing import List
from geoalchemy2 import Geography

import sys
import os
import json
import hashlib
import logging
from starlette.concurrency import run_in_threadpool
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db
from models.db_models import City, Property, Landmark
from schemas.property_schema import PropertyResponse
from schemas.search_schema import SearchRequest
from services.ai_service import extract_search_intent 
from redis_client import redis_client
from rate_limiter import rate_limit_by_ip
from api.properties import _property_rows


router = APIRouter()
logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 600

@router.post("/nlp", response_model=List[PropertyResponse], dependencies=[Depends(rate_limit_by_ip)])
async def ai_powered_search(
    request: SearchRequest,
    city: str = Query("Cooch Behar", min_length=2, max_length=100),
    limit: int = Query(24, ge=1, le=24),
    db: Session = Depends(get_db),
):
    try:
        normalized_query = " ".join(request.query.strip().lower().split())
        normalized_city = " ".join(city.strip().lower().split())
        query_digest = hashlib.sha256(normalized_query.encode("utf-8")).hexdigest()
        cache_key = f"search_cache:v2:{normalized_city}:{limit}:{query_digest}"

        cached_result = await redis_client.get(cache_key)
        if cached_result:
            return json.loads(cached_result)

        search_params = await run_in_threadpool(extract_search_intent, request.query)

        active_city = db.query(City.id).filter(
            func.lower(City.name) == normalized_city,
            City.is_active.is_(True),
        ).first()
        if active_city is None:
            raise HTTPException(status_code=404, detail="City is not currently available.")

        city_filter = func.lower(Property.city) == normalized_city
        if normalized_city == "cooch behar":
            district_bounds = cast(
                func.ST_SetSRID(func.ST_MakeEnvelope(88.7, 25.9, 89.85, 26.75), 4326),
                Geography,
            )
            city_filter = or_(
                city_filter,
                and_(
                    Property.city.is_(None),
                    func.ST_Intersects(Property.coordinates, district_bounds),
                ),
            )

        query = db.query(Property).filter(
            Property.status == "active",
            city_filter,
        )

        if search_params.get('property_type'):
            query = query.filter(Property.type == search_params['property_type'].lower())

        if search_params.get('max_price'):
            query = query.filter(Property.price <= search_params['max_price'])

        if search_params.get('landmark'):
            landmark_name = search_params['landmark'].strip().lower()
            landmark = (
                db.query(Landmark)
                .filter(
                    Landmark.city_id == active_city.id,
                    func.lower(Landmark.name).contains(
                        landmark_name,
                        autoescape=True,
                    )
                ).first()
            )
            if landmark:
                query = query.filter(func.ST_DWithin(Property.coordinates, landmark.coordinates, 3000))
            else:
                escaped_landmark = landmark_name.replace("%", "\\%").replace("_", "\\_")
                landmark_pattern = f"%{escaped_landmark}%"
                query = query.filter(or_(
                    func.lower(func.coalesce(Property.area, "")).like(landmark_pattern, escape="\\"),
                    func.lower(func.coalesce(Property.address, "")).like(landmark_pattern, escape="\\"),
                    func.lower(func.coalesce(Property.title, "")).like(landmark_pattern, escape="\\"),
                    func.lower(func.coalesce(Property.description, "")).like(landmark_pattern, escape="\\"),
                ))

        results = _property_rows(
            db,
            query.order_by(Property.created_at.desc()),
            limit=limit,
        )

        serialized_data = [
            PropertyResponse.model_validate(property_data).model_dump(mode="json")
            for property_data in results
        ]
        await redis_client.setex(cache_key, CACHE_TTL_SECONDS, json.dumps(serialized_data))

        return results

    except HTTPException:
        raise

    except Exception:
        logger.exception("Natural-language property search failed.")
        raise HTTPException(
            status_code=503,
            detail="Natural-language search is temporarily unavailable. Please try again.",
        ) from None