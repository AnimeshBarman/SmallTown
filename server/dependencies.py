from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import jwt, JWTError
import os
from dotenv import load_dotenv
from pathlib import Path

from database import get_db
from models.db_models import Profile
from security import (SECRET_KEY, ALGORITHM)

env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

security = HTTPBearer()


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Validates the JWT and returns the Supabase user ID."""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        token_type = payload.get("type")
        
        if not user_id or token_type != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type or credentials.")
         
        return str(user_id)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials.")

def get_current_user(user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    """Fetches the user profile from the database."""
    user = db.query(Profile).filter(Profile.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found.")
    return user