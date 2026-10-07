from pydantic import BaseModel, Field, ConfigDict
from typing import Optional

class SearchRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    query: str = Field(..., min_length=5, max_length=200, description="User search query")

class AISearchResult(BaseModel):
    property_type: str | None = None
    max_price: float | None = None
    landmark: str | None = None