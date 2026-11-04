from pydantic import BaseModel, Field, ConfigDict
from typing import Optional

class SearchRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    query: str = Field(..., min_length=5, max_length=200, description="User search query")


class NearbySearchRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(..., ge=-180, le=180, allow_inf_nan=False)


class AISearchResult(BaseModel):
    property_type: str | None = None
    max_price: float | None = None
    landmark: str | None = None