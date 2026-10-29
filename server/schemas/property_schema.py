from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Literal
from uuid import UUID
from datetime import datetime
from decimal import Decimal
import re
from pydantic import field_validator, model_validator

class PropertyBase(BaseModel):
    title: str = Field(..., min_length=5, max_length=100, description="Property title")
    area: str = Field(..., min_length=2, max_length=100, description="Area or locality")
    address: str = Field(..., min_length=5, max_length=250, description="Full property address")
    city: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    type: Literal["room", "pg", "flat"]
    price: Decimal = Field(..., gt=0, description="Price should be greater than 0")
    image_urls: list[str] = Field(default_factory=list, max_length=3, description="Upto 3 image URLs")

class PropertyCreate(PropertyBase):
    latitude: float = Field(..., description="Map Latitude")
    longitude: float = Field(..., description="Map Longitude")
    contact_phone: str = Field(..., min_length=7, max_length=30)

    @field_validator("contact_phone")
    @classmethod
    def validate_contact_phone(cls, value: str) -> str:
        normalized = value.strip()
        if not re.fullmatch(r"[+0-9()\-\s]{7,30}", normalized):
            raise ValueError("Enter a valid contact phone number.")
        return normalized


class PropertyUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    title: str | None = Field(default=None, min_length=5, max_length=100)
    area: str | None = Field(default=None, min_length=2, max_length=100)
    address: str | None = Field(default=None, min_length=5, max_length=250)
    city: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = Field(default=None, min_length=10)
    type: Literal["room", "pg", "flat"] | None = None
    price: Decimal | None = Field(default=None, gt=0)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    contact_phone: str | None = Field(default=None, min_length=7, max_length=30)

    @field_validator("contact_phone")
    @classmethod
    def validate_contact_phone(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not re.fullmatch(r"[+0-9()\-\s]{7,30}", normalized):
            raise ValueError("Enter a valid contact phone number.")
        return normalized

    @model_validator(mode="after")
    def validate_coordinates(self) -> "PropertyUpdate":
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Latitude and longitude must be updated together.")
        return self


class PropertyResponse(PropertyBase):
    model_config = ConfigDict(from_attributes=True)

    area: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    id: UUID
    owner_id: Optional[UUID] = None
    owner_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_verified: bool
    view_count: int
    status: str
    created_at: datetime


class PropertyDetailResponse(PropertyResponse):
    contact_phone: Optional[str] = None


class PropertyPageResponse(BaseModel):
    items: list[PropertyResponse]
    total: int
    limit: int
    offset: int
