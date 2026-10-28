from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from jose import JWTError, jwt
from google.auth.exceptions import GoogleAuthError, TransportError
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token as google_id_token

import sys
import os
import uuid
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db
from models.db_models import Profile
from schemas.user_schema import (
    GoogleLoginRequest,
    ProfileCreate,
    UserSignup,
    TokenResponse,
    RefreshRequest,
    ProfileResponse,
    ProfileUpdate,
)
from dependencies import (verify_token, get_current_user)
from security import (
    get_password_hash, verify_password, create_access_token, 
    create_refresh_token, SECRET_KEY, ALGORITHM
)
from config import settings

router = APIRouter()


@router.get("/me", response_model=ProfileResponse)
def get_my_profile(current_user: Profile = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=ProfileResponse)
def update_my_profile(
    profile_data: ProfileUpdate,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    for field, value in profile_data.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


def _create_session_tokens(user: Profile, db: Session) -> dict[str, str]:
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    user.refresh_token = refresh_token
    db.commit()
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(user_data: UserSignup, db: Session = Depends(get_db)):
    if db.query(Profile).filter(Profile.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered..!")
        
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
    return _create_session_tokens(user, db)


@router.post("/google", response_model=TokenResponse)
def google_login(request: GoogleLoginRequest, db: Session = Depends(get_db)):
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google login is not configured.",
        )

    try:
        claims = google_id_token.verify_oauth2_token(
            request.id_token,
            GoogleRequest(),
            audience=settings.GOOGLE_CLIENT_ID,
        )
    except TransportError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google token verification is temporarily unavailable.",
        ) from None
    except (ValueError, GoogleAuthError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google ID token.",
        ) from None

    email = claims.get("email")
    subject = claims.get("sub")
    if (
        not isinstance(email, str)
        or not email
        or not isinstance(subject, str)
        or not subject
        or claims.get("email_verified") is not True
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google account must have a verified email address.",
        )

    normalized_email = email.lower()
    user = db.query(Profile).filter(func.lower(Profile.email) == normalized_email).first()
    if user is None:
        fullname = claims.get("name")
        avatar_url = claims.get("picture")
        user = Profile(
            id=uuid.uuid4(),
            email=normalized_email,
            fullname=fullname if isinstance(fullname, str) else None,
            avatar_url=avatar_url if isinstance(avatar_url, str) else None,
            role="seeker",
        )
        db.add(user)
        db.flush()

    return _create_session_tokens(user, db)

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
            role="seeker"
        )

        db.add(new_profile)
        db.commit()
        db.refresh(new_profile)
        
        return {"message": "Profile created successfully", "profile_id": new_profile.id}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error syncing profile: {str(e)}")