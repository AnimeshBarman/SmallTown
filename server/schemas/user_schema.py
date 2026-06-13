from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID

class ProfileCreate(BaseModel):
    id: UUID
    email: EmailStr
    fullname: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str = "seeker"