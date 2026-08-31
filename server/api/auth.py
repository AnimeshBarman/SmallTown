from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db
from models.db_models import Profile
from schemas.user_schema import ProfileCreate

router = APIRouter()

@router.post("/sync-profile")
def sync_user_profile(user_data: ProfileCreate, db: Session = Depends(get_db)):
    try:
        existing_profile = db.query(Profile).filter(Profile.id == user_data.id).first()
        
        if existing_profile:
            return {"message": "Profile already exists"}

        new_profile = Profile(
            id=user_data.id,
            email=user_data.email,
            fullname=user_data.fullname,
            avatar_url=user_data.avatar_url,
            role=user_data.role
        )

        db.add(new_profile)
        db.commit()
        db.refresh(new_profile)
        
        return {"message": "Profile created successfully", "profile_id": new_profile.id}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error syncing profile: {str(e)}")