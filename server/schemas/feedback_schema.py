from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class FeedbackCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    category: Literal["bug", "idea", "general"]
    message: str = Field(..., min_length=10, max_length=2000)
    email: EmailStr | None = None
    website: str = Field(default="", max_length=200)


class FeedbackResponse(BaseModel):
    id: UUID
    category: Literal["bug", "idea", "general"]
    message: str
    email: EmailStr | None
    created_at: datetime
