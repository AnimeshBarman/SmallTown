from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID

class ProfileCreate(BaseModel):
    id: UUID
    email: EmailStr
    fullname: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str = "seeker"

class UserSignup(BaseModel):
    email: EmailStr
    password: str
    fullname: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshRequest(BaseModel):
    refresh_token: str