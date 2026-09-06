from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt

import sys
import os
import uuid
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db
from models.db_models import Profile
from schemas.user_schema import (ProfileCreate, UserSignup, TokenResponse, RefreshRequest)
from dependencies import (verify_token, get_current_user)
from security import (
    get_password_hash, verify_password, create_access_token, 
    create_refresh_token, SECRET_KEY, ALGORITHM
)

router = APIRouter()

@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(user_data: UserSignup, db: Session = Depends(get_db)):
    if db.query(Profile).filter(Profile.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered.")
        
    new_profile = Profile(
        id=uuid.uuid4(),
        email=user_data.email,
        fullname=user_data.fullname,
        hashed_password=get_password_hash(user_data.password),
        role="seeker"
    )
    db.add(new_profile)
    db.commit()
    return {"message": "Account created successfully. Please login.."}

@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(Profile).filter(Profile.email == form_data.username).first()
    
    if not user or not user.hashed_password or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials..!")
        
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    user.refresh_token = refresh_token
    db.commit()
    
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

@router.post("/refresh", response_model=TokenResponse)
def refresh_token(request: RefreshRequest, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(request.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        token_type = payload.get("type")
        
        if token_type != "refresh" or not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type..!")
            
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token..!")
        
    user = db.query(Profile).filter(Profile.id == user_id).first()
    if not user or user.refresh_token != request.refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked or invalid..!")
        
    new_access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": new_access_token, "refresh_token": user.refresh_token, "token_type": "bearer"}

@router.post("/logout")
def logout(current_user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.refresh_token = None
    db.commit()
    return {"message": "Successfully logged out."}

@router.post("/sync-profile")
def sync_user_profile(
    user_data: ProfileCreate,
    token_user_id: str = Depends(verify_token),
    db: Session = Depends(get_db)
):

    if str(user_data.id) != token_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot sync profile for another user..!")
    
    try:
        existing_profile = db.query(Profile).filter(Profile.id == user_data.id).first()
        
        if existing_profile:
            # Update existing data
            existing_profile.email = user_data.email
            existing_profile.fullname = user_data.fullname
            existing_profile.avatar_url = user_data.avatar_url
            db.commit()
            return {"message": "Profile updated successfully", "profile_id": existing_profile.id}

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