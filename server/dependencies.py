from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import jwt, JWTError
import os
from dotenv import load_dotenv
from pathlib import Path

from database import get_db
from models.db_models import Profile

env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

security = HTTPBearer()
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")

if not SUPABASE_JWT_SECRET:
    raise RuntimeError("SUPABASE_JWT_SECRET environment variable is not set.")

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Validates the JWT and returns the Supabase user ID."""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False})
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token format.")
            
        return str(user_id)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials.")

def get_current_user(user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    """Fetches the user profile from the database."""
    user = db.query(Profile).filter(Profile.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found.")
    return user