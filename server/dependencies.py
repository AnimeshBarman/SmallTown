from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from database import get_db
from models.db_models import Profile
from security import SECRET_KEY, ALGORITHM

ACCESS_COOKIE_NAME = "smalltown_access"


def verify_token(request: Request) -> str:
    token = request.cookies.get(ACCESS_COOKIE_NAME)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication is required.",
        )
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
# Fetches the user profile from the database
    user = db.query(Profile).filter(Profile.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found.")
    return user