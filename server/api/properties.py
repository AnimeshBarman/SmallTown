from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from geoalchemy2.elements import WKTElement
import uuid

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db
from models.db_models import Property
from schemas.property_schema import PropertyCreate, PropertyResponse

from dependencies import get_current_user
from models.db_models import Profile

router = APIRouter()

@router.get("/", response_model=List[PropertyResponse])
def get_all_properties(db: Session = Depends(get_db)):
    properties = db.query(Property).filter(Property.status == "active").all()
    return properties


@router.post("/", response_model=PropertyResponse)
def create_property(
    property_data: PropertyCreate, 
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user)
    ):
    try:
        point_str = f"POINT({property_data.longitude} {property_data.latitude})"
        new_property = Property(
            title=property_data.title,
            description=property_data.description,
            type=property_data.type,
            price=property_data.price,
            coordinates=WKTElement(point_str, srid=4326),
            owner_id=current_user.id
        )

        db.add(new_property)
        db.commit()
        db.refresh(new_property)
        
        return new_property

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error creating property: {str(e)}")
    

