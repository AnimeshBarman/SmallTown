from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Literal
from uuid import UUID
from datetime import datetime
from decimal import Decimal

class PropertyBase(BaseModel):
    title: str = Field(..., min_length=5, max_length=100, description="Property title")
    # area: str = Field(..., min_length=5, max_length=100, description="Area or Locality name")
    area: Optional[str] = None
    description: Optional[str] = None
    type: Literal["room", "pg", "flat"]
    price: Decimal = Field(..., gt=0, description="Price should be greater than 0")
    image_urls: list[str] = Field(default_factory=list, max_length=3, description="Upto 3 image URLs")

class PropertyCreate(PropertyBase):
    latitude: float = Field(..., description="Map Latitude")
    longitude: float = Field(..., description="Map Longitude")


class PropertyResponse(PropertyBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    owner_id: Optional[UUID] = None
    is_verified: bool
    view_count: int
    status: str
    created_at: datetime
