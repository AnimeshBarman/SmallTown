from pydantic import BaseModel, Field
from typing import Optional

class SearchRequest(BaseModel):
    query: str = Field(..., max_length=200, description="User search query")

class AISearchResult(BaseModel):
    property_type: Optional[str] = None
    max_price: Optional[float] = None
    landmark: Optional[str] = None