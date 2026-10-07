from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ProfileCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)

    id: UUID
    email: EmailStr
    fullname: str | None = None
    avatar_url: str | None = None
    # role: Literal["seeker", "owner", "admin"] = "seeker"


class UserSignup(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    password: str = Field(..., min_length=8, max_length=64, description="Password must be at least 8 characters")
    fullname: str = Field(..., min_length=2, max_length=100)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)