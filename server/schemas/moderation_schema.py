from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic import field_validator
from image_urls import filter_trusted_property_image_urls


ReportReason = Literal["suspicious", "inaccurate", "inappropriate", "other"]
ReportStatus = Literal["open", "resolved", "dismissed"]
ListingStatus = Literal["active", "removed"]


class ListingReportCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    reason: ReportReason
    details: str | None = Field(default=None, max_length=1000)


class ListingReportUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    status: Literal["resolved", "dismissed"]
    resolution_note: str | None = Field(default=None, max_length=1000)
    remove_listing: bool = False

    @model_validator(mode="after")
    def require_removal_reason(self) -> "ListingReportUpdate":
        if self.remove_listing and (
            self.resolution_note is None or len(self.resolution_note.strip()) < 10
        ):
            raise ValueError("A clear reason is required when removing a listing.")
        return self


class ListingModerationUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    status: ListingStatus
    reason: str | None = Field(default=None, min_length=10, max_length=1000)

    @model_validator(mode="after")
    def require_removal_reason(self) -> "ListingModerationUpdate":
        if self.status == "removed" and not (self.reason and self.reason.strip()):
            raise ValueError("A clear reason is required when restricting a listing.")
        return self


class AdminPropertyDeletion(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    reason: str = Field(min_length=10, max_length=1000)


class ListingReportResponse(BaseModel):
    id: UUID
    property_id: UUID
    property_title: str
    property_area: str | None
    property_city: str | None
    reporter_id: UUID
    reporter_email: str
    reason: ReportReason
    details: str | None
    status: ReportStatus
    created_at: datetime
    reviewed_at: datetime | None
    reviewed_by_id: UUID | None
    resolution_note: str | None


class AdminPropertyResponse(BaseModel):
    id: UUID
    title: str
    area: str | None
    address: str | None
    city: str | None
    description: str | None
    type: str
    price: float
    image_urls: list[str]
    owner_id: UUID | None
    owner_name: str | None
    owner_email: str
    contact_phone: str | None
    status: str
    view_count: int
    created_at: datetime
    moderation_reason: str | None
    moderated_at: datetime | None

    @field_validator("image_urls", mode="before")
    @classmethod
    def filter_untrusted_image_urls(cls, values: object) -> list[str]:
        return filter_trusted_property_image_urls(values)


class AdminPropertyPageResponse(BaseModel):
    items: list[AdminPropertyResponse]
    total: int
    limit: int
    offset: int


class ListingModerationActionResponse(BaseModel):
    status: ListingStatus
    reason: str | None
    admin_email: str | None
    created_at: datetime


class ListingDeletionNoticeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    property_id: UUID
    property_title: str
    city: str | None
    owner_email: str
    admin_email: str
    reason: str
    deleted_at: datetime
    moderation_history: list[ListingModerationActionResponse]


class OwnerListingDeletionNoticeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    property_title: str
    city: str | None
    reason: str
    deleted_at: datetime
