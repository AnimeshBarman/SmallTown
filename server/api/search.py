from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db
from models.db_models import Property, Landmark
from schemas.property_schema import PropertyResponse
from schemas.search_schema import SearchRequest
from services.ai_service import extract_search_intent 



router = APIRouter()

@router.post("/nlp", response_model=List[PropertyResponse])
def ai_powered_search(request: SearchRequest, db: Session = Depends(get_db)):
    try:
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

        return query.all()

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Search Endpoint Error: {str(e)}")