from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime

class PropertyBase(BaseModel):
    title: str = Field(..., min_length=5, max_length=100, description="Property title")
    area: Optional[str] = None
    description: Optional[str] = None
    type: str = Field(..., description="Must be room, pg, or flat")
    price: float = Field(..., gt=0, description="Price should be greater than 0")


class PropertyCreate(PropertyBase):
    latitude: float = Field(..., description="Map Latitude")
    longitude: float = Field(..., description="Map Longitude")


class PropertyResponse(PropertyBase):
    id: UUID
    owner_id: Optional[UUID] = None
    is_verified: bool
    view_count: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True