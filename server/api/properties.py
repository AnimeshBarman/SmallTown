from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session
from typing import List
from geoalchemy2.elements import WKTElement
from uuid import UUID

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db
from models.db_models import Property
from schemas.property_schema import PropertyCreate, PropertyResponse
from services.storage_service import upload_property_images

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
            area=property_data.area,
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



@router.post("/{property_id}/images")
async def upload_images(
    property_id: UUID,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user)
    ):
    if len(files) > 3:
        raise HTTPException(status_code=400, detail="Maximum 3 images allowed per property.")

    property_record = db.query(Property).filter(Property.id == property_id).first()
    if not property_record:
        raise HTTPException(status_code=404, detail="Property not found.")

    if str(property_record.owner_id) != str(current_user.id):        
        raise HTTPException(status_code=403, detail="You are not authorized to upload images for this property.")

    existing_images: list = property_record.image_urls or []  # type: ignore
    
    if len(existing_images) + len(files) > 3:
        raise HTTPException(
            status_code=400, 
            detail=f"Property already has {len(existing_images)} images. You can only upload up to 3 total."
        )

    new_image_urls = await upload_property_images(files, str(property_id))

    current_urls = list(existing_images)
    current_urls.extend(new_image_urls)
    
    property_record.image_urls = current_urls  # type: ignore
    db.commit()
    db.refresh(property_record)

    return {"message": "Images uploaded successfully", "image_urls": property_record.image_urls}

