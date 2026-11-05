from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user
from models.db_models import (
    ListingDeletionNotice,
    ListingModerationAction,
    ListingReport,
    Profile,
    Property as RentalProperty,
)
from rate_limiter import rate_limit_listing_report
from services.storage_service import delete_images_from_storage
from schemas.moderation_schema import (
    AdminPropertyDeletion,
    AdminPropertyResponse,
    AdminPropertyPageResponse,
    ListingDeletionNoticeResponse,
    ListingModerationUpdate,
    ListingModerationActionResponse,
    ListingReportCreate,
    ListingReportResponse,
    ListingReportUpdate,
)


router = APIRouter()


def _require_admin(current_user: Profile) -> None:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access is required.",
        )


def _admin_property_data(property_record: RentalProperty, owner: Profile | None) -> dict:
    return {
        "id": property_record.id,
        "title": property_record.title,
        "area": property_record.area,
        "address": property_record.address,
        "city": property_record.city,
        "description": property_record.description,
        "type": property_record.type,
        "price": property_record.price,
        "image_urls": property_record.image_urls or [],
        "owner_id": property_record.owner_id,
        "owner_name": owner.fullname if owner else None,
        "owner_email": owner.email if owner else "Profile unavailable",
        "contact_phone": property_record.contact_phone,
        "status": property_record.status,
        "view_count": property_record.view_count,
        "created_at": property_record.created_at,
        "moderation_reason": property_record.moderation_reason,
        "moderated_at": property_record.moderated_at,
    }


@router.post(
    "/properties/{property_id}/reports",
    status_code=status.HTTP_201_CREATED,
)
async def create_listing_report(
    property_id: UUID,
    report_data: ListingReportCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    await rate_limit_listing_report(request, str(current_user.id))

    property_record = db.query(RentalProperty).filter(
        RentalProperty.id == property_id,
        RentalProperty.status == "active",
    ).first()
    if property_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found.")
    if property_record.owner_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot report your own listing.",
        )

    existing_report = db.query(ListingReport.id).filter(
        ListingReport.property_id == property_id,
        ListingReport.reporter_id == current_user.id,
        ListingReport.status == "open",
    ).first()
    if existing_report:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have an open report for this listing.",
        )

    report = ListingReport(
        property_id=property_id,
        reporter_id=current_user.id,
        reason=report_data.reason,
        details=report_data.details or None,
    )
    db.add(report)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        constraint_name = getattr(getattr(error.orig, "diag", None), "constraint_name", None)
        if constraint_name == "uq_listing_reports_open_reporter_property":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You already have an open report for this listing.",
            ) from None
        raise

    return {"message": "Thank you. Your report has been sent for review."}


@router.get("/moderation/properties", response_model=AdminPropertyPageResponse)
def get_admin_properties(
    city: str | None = Query(None, min_length=2, max_length=100),
    property_type: Literal["room", "pg", "flat"] | None = Query(None, alias="type"),
    listing_status: Literal["active", "removed", "all"] = Query("all", alias="status"),
    search: str | None = Query(None, min_length=1, max_length=100),
    limit: int = Query(24, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    _require_admin(current_user)

    query = db.query(RentalProperty, Profile).outerjoin(Profile, Profile.id == RentalProperty.owner_id)
    if city:
        query = query.filter(func.lower(RentalProperty.city) == city.strip().lower())
    if property_type:
        query = query.filter(RentalProperty.type == property_type)
    if listing_status != "all":
        query = query.filter(RentalProperty.status == listing_status)
    if search:
        normalized_search = search.strip().lower()
        query = query.filter(or_(
            func.lower(RentalProperty.title).contains(normalized_search, autoescape=True),
            func.lower(func.coalesce(RentalProperty.area, "")).contains(normalized_search, autoescape=True),
            func.lower(func.coalesce(RentalProperty.address, "")).contains(normalized_search, autoescape=True),
            func.lower(Profile.email).contains(normalized_search, autoescape=True),
            func.lower(func.coalesce(Profile.fullname, "")).contains(normalized_search, autoescape=True),
        ))

    total = query.count()
    rows = (
        query.order_by(RentalProperty.created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    return {
        "items": [_admin_property_data(property_record, owner) for property_record, owner in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get(
    "/moderation/cities",
    response_model=list[str],
)
def get_admin_listing_cities(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    _require_admin(current_user)
    return [
        city
        for (city,) in db.query(RentalProperty.city)
        .filter(RentalProperty.city.isnot(None))
        .distinct()
        .order_by(RentalProperty.city)
        .all()
    ]


@router.patch(
    "/moderation/properties/{property_id}",
    response_model=AdminPropertyResponse,
)
def update_admin_property_status(
    property_id: UUID,
    moderation_data: ListingModerationUpdate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    _require_admin(current_user)
    property_record = db.query(RentalProperty).filter(RentalProperty.id == property_id).with_for_update().first()
    if property_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found.")

    property_record.status = moderation_data.status
    property_record.moderation_reason = moderation_data.reason if moderation_data.status == "removed" else None
    property_record.moderated_at = datetime.now(timezone.utc) if moderation_data.status == "removed" else None
    property_record.moderated_by_id = current_user.id if moderation_data.status == "removed" else None
    db.add(ListingModerationAction(
        property_id=property_record.id,
        admin_id=current_user.id,
        status=moderation_data.status,
        reason=moderation_data.reason if moderation_data.status == "removed" else None,
    ))
    db.commit()
    db.refresh(property_record)
    owner = db.query(Profile).filter(Profile.id == property_record.owner_id).first()
    if owner is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing owner not found.")
    return _admin_property_data(property_record, owner)


@router.delete(
    "/moderation/properties/{property_id}",
    response_model=ListingDeletionNoticeResponse,
)
async def permanently_delete_admin_property(
    property_id: UUID,
    deletion_data: AdminPropertyDeletion,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    _require_admin(current_user)
    property_record = (
        db.query(RentalProperty)
        .filter(RentalProperty.id == property_id)
        .with_for_update()
        .first()
    )
    if property_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found.")

    owner = db.query(Profile).filter(Profile.id == property_record.owner_id).first()

    history = (
        db.query(ListingModerationAction, Profile.email)
        .outerjoin(Profile, Profile.id == ListingModerationAction.admin_id)
        .filter(ListingModerationAction.property_id == property_id)
        .order_by(ListingModerationAction.created_at.desc())
        .all()
    )
    notice = ListingDeletionNotice(
        property_id=property_record.id,
        owner_id=owner.id if owner else None,
        admin_id=current_user.id,
        property_title=property_record.title,
        city=property_record.city,
        owner_email=owner.email if owner else "Profile unavailable",
        admin_email=current_user.email,
        reason=deletion_data.reason,
        moderation_history=[
            {
                "status": action.status,
                "reason": action.reason,
                "admin_email": admin_email,
                "created_at": action.created_at.isoformat(),
            }
            for action, admin_email in history
        ],
    )

    await delete_images_from_storage(property_record.image_urls or [])
    db.add(notice)
    db.delete(property_record)
    db.commit()
    db.refresh(notice)
    return notice


@router.get(
    "/moderation/deletions",
    response_model=list[ListingDeletionNoticeResponse],
)
def get_admin_listing_deletions(
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    _require_admin(current_user)
    return (
        db.query(ListingDeletionNotice)
        .order_by(ListingDeletionNotice.deleted_at.desc())
        .limit(limit)
        .all()
    )


@router.get(
    "/moderation/properties/{property_id}/history",
    response_model=list[ListingModerationActionResponse],
)
def get_listing_moderation_history(
    property_id: UUID,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    _require_admin(current_user)
    if not db.query(RentalProperty.id).filter(RentalProperty.id == property_id).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found.")
    rows = (
        db.query(ListingModerationAction, Profile.email)
        .outerjoin(Profile, Profile.id == ListingModerationAction.admin_id)
        .filter(ListingModerationAction.property_id == property_id)
        .order_by(ListingModerationAction.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "status": action.status,
            "reason": action.reason,
            "admin_email": admin_email,
            "created_at": action.created_at,
        }
        for action, admin_email in rows
    ]


@router.get("/moderation/reports", response_model=list[ListingReportResponse])
def get_listing_reports(
    report_status: Literal["open", "resolved", "dismissed", "all"] = Query("open", alias="status"),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    _require_admin(current_user)

    query = (
        db.query(ListingReport, RentalProperty, Profile)
        .join(RentalProperty, RentalProperty.id == ListingReport.property_id)
        .join(Profile, Profile.id == ListingReport.reporter_id)
    )
    if report_status != "all":
        query = query.filter(ListingReport.status == report_status)

    rows = query.order_by(ListingReport.created_at.desc()).limit(limit).all()
    return [
        {
            "id": report.id,
            "property_id": property_record.id,
            "property_title": property_record.title,
            "property_area": property_record.area,
            "property_city": property_record.city,
            "reporter_id": reporter.id,
            "reporter_email": reporter.email,
            "reason": report.reason,
            "details": report.details,
            "status": report.status,
            "created_at": report.created_at,
            "reviewed_at": report.reviewed_at,
            "reviewed_by_id": report.reviewed_by_id,
            "resolution_note": report.resolution_note,
        }
        for report, property_record, reporter in rows
    ]


@router.patch(
    "/moderation/reports/{report_id}",
    response_model=ListingReportResponse,
)
def update_listing_report(
    report_id: UUID,
    report_data: ListingReportUpdate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    _require_admin(current_user)
    report = db.query(ListingReport).filter(ListingReport.id == report_id).first()
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")
    if report_data.remove_listing and report_data.status != "resolved":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A listing can only be removed when resolving a report.",
        )

    report.status = report_data.status
    report.reviewed_at = datetime.now(timezone.utc)
    report.reviewed_by_id = current_user.id
    report.resolution_note = report_data.resolution_note or None
    if report_data.remove_listing:
        property_record = db.query(RentalProperty).filter(RentalProperty.id == report.property_id).first()
        if property_record is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found.")
        property_record.status = "removed"
        property_record.moderation_reason = report_data.resolution_note
        property_record.moderated_at = report.reviewed_at
        property_record.moderated_by_id = current_user.id
        db.add(ListingModerationAction(
            property_id=property_record.id,
            admin_id=current_user.id,
            status="removed",
            reason=report_data.resolution_note,
        ))
    db.commit()
    db.refresh(report)

    property_record = db.query(RentalProperty).filter(RentalProperty.id == report.property_id).first()
    reporter = db.query(Profile).filter(Profile.id == report.reporter_id).first()
    if property_record is None or reporter is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report details are unavailable.")
    return {
        "id": report.id,
        "property_id": property_record.id,
        "property_title": property_record.title,
        "property_area": property_record.area,
        "property_city": property_record.city,
        "reporter_id": reporter.id,
        "reporter_email": reporter.email,
        "reason": report.reason,
        "details": report.details,
        "status": report.status,
        "created_at": report.created_at,
        "reviewed_at": report.reviewed_at,
        "reviewed_by_id": report.reviewed_by_id,
        "resolution_note": report.resolution_note,
    }
