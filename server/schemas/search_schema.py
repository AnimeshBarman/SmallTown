from pydantic import BaseModel
from typing import Optional

class SearchRequest(BaseModel):
    query: str

class AISearchResult(BaseModel):
    property_type: Optional[str] = None
    max_price: Optional[float] = None
    landmark: Optional[str] = None