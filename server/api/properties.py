from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, status
from sqlalchemy.orm import Session
from sqlalchemy import cast, func
from typing import List
from geoalchemy2 import Geometry
from geoalchemy2.elements import WKTElement

import sys
import os
from uuid import UUID
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db
from models.db_models import Property
from schemas.property_schema import PropertyCreate, PropertyResponse
from services.storage_service import (process_and_upload_image, delete_images_from_storage)

from dependencies import get_current_user
from models.db_models import Profile



router = APIRouter()

@router.get("/", response_model=List[PropertyResponse])
def get_all_properties(db: Session = Depends(get_db)):
    property_rows = (
        db.query(
            Property,
            func.ST_Y(cast(Property.coordinates, Geometry)).label("latitude"),
            func.ST_X(cast(Property.coordinates, Geometry)).label("longitude"),
        )
        .filter(Property.status == "active")
        .all()
    )
    return [
        {
            **PropertyResponse.model_validate(property_record).model_dump(),
            "latitude": latitude,
            "longitude": longitude,
        }
        for property_record, latitude, longitude in property_rows
    ]



@router.post("/upload-images")
async def upload_property_images(
    files: list[UploadFile] = File(..., description="Upload up to 3 images"),
    current_user: Profile = Depends(get_current_user)
    ):
    if len(files) > 3:
        raise HTTPException(status_code=400, detail="Maximum of 3 images allowed per property.")
    if not files:
        raise HTTPException(status_code=400, detail="No images provided.")

    uploaded_urls = []

    try:
        for file in files:
            url = await process_and_upload_image(file)
            uploaded_urls.append(url)

    except Exception:
        if uploaded_urls:
            await delete_images_from_storage(uploaded_urls)
        raise
            
    return {
        "message": "Images successfully processed and uploaded.",
        "urls": uploaded_urls
    }



@router.post("/create-property", response_model=PropertyResponse, status_code=status.HTTP_201_CREATED)
def create_property(
    property_data: PropertyCreate, 
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user)
    ):
    try:
        point_str = f"POINT({property_data.longitude} {property_data.latitude})"
        new_property = Property(
            owner_id=current_user.id,
            title=property_data.title,
            area=property_data.area,
            description=property_data.description,
            type=property_data.type,
            price=property_data.price,
            image_urls=property_data.image_urls,
            coordinates=WKTElement(point_str, srid=4326)
        )

        db.add(new_property)
        db.commit()
        db.refresh(new_property)
        
        return new_property

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error creating property: {str(e)}")



@router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_property(
    property_id: UUID,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user)
):
    property_record = db.query(Property).filter(Property.id == property_id).first()
    
    if not property_record:
        raise HTTPException(status_code=404, detail="Property not found")
        
    if str(property_record.owner_id) != str(current_user.id) and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete this property.")

    if property_record.image_urls:
        await delete_images_from_storage(property_record.image_urls)
        
    db.delete(property_record)
    db.commit()
    return None