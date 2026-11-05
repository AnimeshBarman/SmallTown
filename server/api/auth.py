from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from jose import JWTError, jwt
from starlette.concurrency import run_in_threadpool
from google.auth.exceptions import GoogleAuthError, TransportError
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token as google_id_token

import sys
import os
import uuid
from datetime import datetime, timezone
from sqlalchemy import text
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db
from models.db_models import Profile, ProfileNameChange
from schemas.user_schema import (
    GoogleLoginRequest,
    ProfileCreate,
    UserSignup,
    TokenResponse,
    ProfileResponse,
    ProfileUpdate,
)
from dependencies import (verify_token, get_current_user)
from security import (
    get_password_hash, verify_password, create_access_token, 
    create_refresh_token, hash_refresh_token, verify_refresh_token_hash,
)
from config import settings
from dependencies import ACCESS_COOKIE_NAME
from rate_limiter import (
    check_login_rate_limit,
    clear_login_identity_failures,
    record_login_failure,
)

router = APIRouter()
DUMMY_PASSWORD_HASH = get_password_hash("smalltown-login-timing-equalization")
PROFILE_NAME_CHANGE_LIMIT = 3
REFRESH_COOKIE_NAME = "smalltown_refresh"
ACCESS_COOKIE_PATH = "/api/v1"
REFRESH_COOKIE_PATH = "/api/v1/auth"


def _set_session_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    cookie_options = {
        "httponly": True,
        "secure": settings.COOKIE_SECURE,
        "samesite": "lax",
    }
    response.set_cookie(
        ACCESS_COOKIE_NAME,
        access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path=ACCESS_COOKIE_PATH,
        **cookie_options,
    )
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        refresh_token,
        max_age=7 * 24 * 60 * 60,
        path=REFRESH_COOKIE_PATH,
        **cookie_options,
    )


def _clear_session_cookies(response: Response) -> None:
    cookie_options = {
        "httponly": True,
        "secure": settings.COOKIE_SECURE,
        "samesite": "lax",
    }
    response.delete_cookie(ACCESS_COOKIE_NAME, path=ACCESS_COOKIE_PATH, **cookie_options)
    response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH, **cookie_options)


def _name_change_quota(db: Session, user_id: uuid.UUID) -> dict:
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if month_start.month == 12:
        reset_at = month_start.replace(year=month_start.year + 1, month=1)
    else:
        reset_at = month_start.replace(month=month_start.month + 1)

    used = db.query(func.count(ProfileNameChange.id)).filter(
        ProfileNameChange.user_id == user_id,
        ProfileNameChange.changed_at >= month_start,
    ).scalar() or 0
    return {
        "name_changes_limit": PROFILE_NAME_CHANGE_LIMIT,
        "name_changes_used": used,
        "name_changes_remaining": max(0, PROFILE_NAME_CHANGE_LIMIT - used),
        "name_changes_reset_at": reset_at,
    }


def _profile_response(current_user: Profile, db: Session) -> dict:
    return {
        "id": current_user.id,
        "fullname": current_user.fullname,
        "email": current_user.email,
        "role": current_user.role,
        "phone": current_user.phone,
        "avatar_url": current_user.avatar_url,
        "created_at": current_user.created_at,
        **_name_change_quota(db, current_user.id),
    }


@router.get("/me", response_model=ProfileResponse)
def get_my_profile(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _profile_response(current_user, db)


@router.patch("/me", response_model=ProfileResponse)
def update_my_profile(
    profile_data: ProfileUpdate,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updates = profile_data.model_dump(exclude_unset=True)
    name_changed = False

    if "fullname" in updates:
        db.execute(
            text("SELECT pg_advisory_xact_lock(hashtext(:lock_key))"),
            {"lock_key": f"smalltown:profile-name-limit:{current_user.id}"},
        )
        db.refresh(current_user)
        name_changed = updates["fullname"] != current_user.fullname
        if name_changed:
            quota = _name_change_quota(db, current_user.id)
            if quota["name_changes_remaining"] == 0:
                reset_date = quota["name_changes_reset_at"].date().isoformat()
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=(
                        "You can change your name up to 3 times per calendar month. "
                        f"Your limit resets on {reset_date}."
                    ),
                )

    for field, value in updates.items():
        setattr(current_user, field, value)
    if name_changed:
        db.add(ProfileNameChange(user_id=current_user.id))
    db.commit()
    db.refresh(current_user)
    return _profile_response(current_user, db)


def _create_session_tokens(user: Profile, db: Session) -> tuple[str, str]:
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    user.refresh_token = hash_refresh_token(refresh_token)
    db.commit()
    return access_token, refresh_token


def _verify_login_credentials(
    username: str,
    password: str,
    db: Session,
) -> tuple[Profile | None, bool]:
    user = db.query(Profile).filter(func.lower(Profile.email) == username).first()
    password_hash = user.hashed_password if user and user.hashed_password else DUMMY_PASSWORD_HASH
    password_is_valid = verify_password(password, password_hash)
    return user, bool(user and user.hashed_password and password_is_valid)


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(user_data: UserSignup, db: Session = Depends(get_db)):
    normalized_email = str(user_data.email).strip().lower()
    if db.query(Profile).filter(func.lower(Profile.email) == normalized_email).first():
        raise HTTPException(status_code=400, detail="Email already registered..!")
        
    new_profile = Profile(
        id=uuid.uuid4(),
        email=normalized_email,
        fullname=user_data.fullname,
        hashed_password=get_password_hash(user_data.password),
        role="seeker"
    )
    db.add(new_profile)
    db.commit()
    return {"message": "Account created successfully. Please login.."}

@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    normalized_email = form_data.username.strip().lower()
    await check_login_rate_limit(request, normalized_email)
    user, credentials_valid = await run_in_threadpool(
        _verify_login_credentials,
        normalized_email,
        form_data.password,
        db,
    )

    if not credentials_valid or user is None:
        await record_login_failure(request, normalized_email)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials..!")
    await clear_login_identity_failures(request, normalized_email)
    _set_session_cookies(
        response,
        *await run_in_threadpool(_create_session_tokens, user, db),
    )
    return {"authenticated": True}

@router.post("/google", response_model=TokenResponse)
def google_login(
    request: GoogleLoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
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

    _set_session_cookies(response, *_create_session_tokens(user, db))
    return {"authenticated": True}

@router.post("/refresh", response_model=TokenResponse)
def refresh_token(request: Request, response: Response, db: Session = Depends(get_db)):
    presented_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not presented_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh session is missing.",
        )
    try:
        payload = jwt.decode(
            presented_token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        user_id = payload.get("sub")
        token_type = payload.get("type")
        
        if token_type != "refresh" or not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type..!")
            
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token..!")
        
    user = (
        db.query(Profile)
        .filter(Profile.id == user_id)
        .with_for_update()
        .first()
    )
    if not user or not verify_refresh_token_hash(presented_token, user.refresh_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked or invalid..!")
    access_token, refresh_token = _create_session_tokens(user, db)
    _set_session_cookies(response, access_token, refresh_token)
    return {"authenticated": True}

@router.post("/logout")
def logout(
    response: Response,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.refresh_token = None
    db.commit()
    _clear_session_cookies(response)
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
            existing_profile.email = user_data.email
            if existing_profile.fullname is None:
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