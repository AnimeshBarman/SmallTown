from datetime import datetime, timedelta, timezone
import hashlib
import hmac
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, status, Query, Request, Header
from sqlalchemy.orm import Session
from sqlalchemy import and_, cast, func, or_, text
from sqlalchemy.dialects.postgresql import insert
from typing import List, Literal
from geoalchemy2 import Geography, Geometry
from geoalchemy2.elements import WKTElement

import sys
import os
from uuid import UUID
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db
from models.db_models import City, Property, PropertyView, Profile, SavedProperty
from schemas.property_schema import (
    PropertyCreate,
    PropertyDetailResponse,
    PropertyPageResponse,
    PropertyResponse,
    PropertyUpdate,
)
from services.storage_service import (process_and_upload_image, delete_images_from_storage)
from services.captcha_service import verify_listing_captcha

from dependencies import get_current_user
from security import SECRET_KEY


router = APIRouter()
LISTINGS_PER_DAY_LIMIT = 3
LISTING_RATE_WINDOW = timedelta(hours=24)


def _listing_quota(db: Session, owner_id) -> dict:
    now = datetime.now(timezone.utc)
    window_start = now - LISTING_RATE_WINDOW
    recent_listings = db.query(Property).filter(
        Property.owner_id == owner_id,
        Property.created_at >= window_start,
    )
    count = recent_listings.count()
    oldest_listing = (
        recent_listings.order_by(Property.created_at.asc()).first()
        if count >= LISTINGS_PER_DAY_LIMIT
        else None
    )
    resets_at = None
    if oldest_listing and oldest_listing.created_at:
        created_at = oldest_listing.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        resets_at = (created_at + LISTING_RATE_WINDOW).isoformat()

    return {
        "limit": LISTINGS_PER_DAY_LIMIT,
        "used": count,
        "remaining": max(0, LISTINGS_PER_DAY_LIMIT - count),
        "resets_at": resets_at,
    }


def _enforce_listing_quota(db: Session, owner_id) -> None:
    quota = _listing_quota(db, owner_id)
    if quota["remaining"] == 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "You can publish up to 3 listings in a rolling 24-hour period. "
                f"Try again after {quota['resets_at']}."
            ),
            headers={"Retry-After": "86400"},
        )


async def require_listing_captcha(
    request: Request,
    x_captcha_token: str = Header(..., alias="X-Captcha-Token", min_length=1),
) -> None:
    await verify_listing_captcha(request, x_captcha_token)

def _property_rows(db: Session, query, *, limit: int | None = None, offset: int = 0):
    query = query.outerjoin(Profile, Profile.id == Property.owner_id).with_entities(
        Property,
        func.ST_Y(cast(Property.coordinates, Geometry)).label("latitude"),
        func.ST_X(cast(Property.coordinates, Geometry)).label("longitude"),
        Profile.fullname.label("owner_name"),
    )
    if limit is not None:
        query = query.limit(limit).offset(offset)
    property_rows = query.all()
    return [
        {
            **PropertyResponse.model_validate(property_record).model_dump(),
            "latitude": latitude,
            "longitude": longitude,
            "owner_name": owner_name,
        }
        for property_record, latitude, longitude, owner_name in property_rows
    ]


@router.get("/cities")
def get_cities(db: Session = Depends(get_db)):
    return db.query(City).filter(City.is_active.is_(True)).order_by(City.name).all()


@router.get("/", response_model=PropertyPageResponse)
def get_all_properties(
    city: str = Query("Cooch Behar", min_length=2, max_length=100),
    sort: Literal["newest", "oldest", "price_asc"] = Query("newest"),
    limit: int = Query(12, ge=1, le=24),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    active_city = db.query(City.id).filter(
        func.lower(City.name) == city.lower(),
        City.is_active.is_(True),
    ).first()
    if active_city is None:
        raise HTTPException(status_code=404, detail="City is not currently available.")

    city_match = func.lower(Property.city) == city.lower()
    if city.lower() == "cooch behar":
        cooch_behar_bounds = cast(
            func.ST_SetSRID(func.ST_MakeEnvelope(88.7, 25.9, 89.85, 26.75), 4326),
            Geography,
        )
        city_match = or_(
            city_match,
            and_(
                Property.city.is_(None),
                func.ST_Intersects(Property.coordinates, cooch_behar_bounds),
            ),
        )

    base_query = (
        db.query(Property)
        .filter(Property.status == "active", city_match)
    )
    total = base_query.count()
    if sort == "oldest":
        query = base_query.order_by(Property.created_at.asc())
    elif sort == "price_asc":
        query = base_query.order_by(Property.price.asc(), Property.created_at.desc())
    else:
        query = base_query.order_by(Property.created_at.desc())
    return {
        "items": _property_rows(db, query, limit=limit, offset=offset),
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/mine", response_model=List[PropertyResponse])
def get_my_properties(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    query = (
        db.query(Property)
        .filter(Property.owner_id == current_user.id)
        .order_by(Property.created_at.desc())
    )
    return _property_rows(db, query)


@router.get("/saved", response_model=List[PropertyResponse])
def get_saved_properties(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    query = (
        db.query(Property)
        .join(SavedProperty, SavedProperty.property_id == Property.id)
        .filter(SavedProperty.user_id == current_user.id, Property.status == "active")
        .order_by(SavedProperty.created_at.desc())
    )
    return _property_rows(db, query)


@router.get("/listing-quota")
def get_listing_quota(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    return _listing_quota(db, current_user.id)


@router.get("/{property_id}/saved")
def is_property_saved(
    property_id: UUID,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    saved = db.query(SavedProperty.user_id).filter(
        SavedProperty.user_id == current_user.id,
        SavedProperty.property_id == property_id,
    ).first()
    return {"saved": saved is not None}


@router.get("/{property_id}", response_model=PropertyDetailResponse)
def get_property_detail(property_id: UUID, db: Session = Depends(get_db)):
    row = (
        db.query(
            Property,
            func.ST_Y(cast(Property.coordinates, Geometry)).label("latitude"),
            func.ST_X(cast(Property.coordinates, Geometry)).label("longitude"),
            Property.contact_phone,
            Profile.fullname.label("owner_name"),
        )
        .outerjoin(Profile, Profile.id == Property.owner_id)
        .filter(Property.id == property_id, Property.status == "active")
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Property not found")

    property_record, latitude, longitude, contact_phone, owner_name = row
    return {
        **PropertyResponse.model_validate(property_record).model_dump(),
        "latitude": latitude,
        "longitude": longitude,
        "contact_phone": contact_phone,
        "owner_name": owner_name,
    }


@router.post("/upload-images")
async def upload_property_images(
    files: list[UploadFile] = File(..., description="Upload up to 3 images"),
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    _: None = Depends(require_listing_captcha),
    ):
    _enforce_listing_quota(db, current_user.id)
    if len(files) > 3:
        raise HTTPException(status_code=400, detail="Maximum of 3 images allowed per property.")
    if not files:
        raise HTTPException(status_code=400, detail="No images provided.")

    uploaded_urls = []

    try:
        for file in files:
            url = await process_and_upload_image(file)
            uploaded_urls.append(url)

    except Exception:
        if uploaded_urls:
            await delete_images_from_storage(uploaded_urls)
        raise
            
    return {
        "message": "Images successfully processed and uploaded.",
        "urls": uploaded_urls
    }



@router.post("/create-property", response_model=PropertyResponse, status_code=status.HTTP_201_CREATED)
def create_property(
    property_data: PropertyCreate, 
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    _: None = Depends(require_listing_captcha),
    ):
    db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:lock_key))"),
        {"lock_key": f"smalltown:listing-limit:{current_user.id}"},
    )
    _enforce_listing_quota(db, current_user.id)
    city = db.query(City).filter(
        func.lower(City.name) == property_data.city.lower(),
        City.is_active.is_(True),
    ).first()
    if city is None:
        raise HTTPException(status_code=422, detail="Choose a city from the available list.")
    try:
        point_str = f"POINT({property_data.longitude} {property_data.latitude})"
        new_property = Property(
            owner_id=current_user.id,
            title=property_data.title,
            area=property_data.area,
            address=property_data.address,
            city=city.name,
            contact_phone=property_data.contact_phone,
            description=property_data.description,
            type=property_data.type,
            price=property_data.price,
            image_urls=property_data.image_urls,
            coordinates=WKTElement(point_str, srid=4326)
        )

        db.add(new_property)
        db.commit()
        db.refresh(new_property)
        
        return new_property

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error creating property: {str(e)}")


@router.patch("/{property_id}", response_model=PropertyResponse)
def update_property(
    property_id: UUID,
    property_data: PropertyUpdate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    property_record = db.query(Property).filter(Property.id == property_id).first()
    if property_record is None:
        raise HTTPException(status_code=404, detail="Property not found.")
    if property_record.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to edit this property.")

    changes = property_data.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="Provide at least one field to update.")
    for required_field in ("title", "address", "city", "type", "price"):
        if required_field in changes and changes[required_field] is None:
            raise HTTPException(
                status_code=422,
                detail=f"{required_field.replace('_', ' ').capitalize()} cannot be empty.",
            )

    if ("latitude" in changes) != ("longitude" in changes):
        raise HTTPException(
            status_code=422,
            detail="Latitude and longitude must be updated together.",
        )

    if "city" in changes:
        city = db.query(City).filter(
            func.lower(City.name) == changes["city"].lower(),
            City.is_active.is_(True),
        ).first()
        if city is None:
            raise HTTPException(status_code=422, detail="Choose a city from the available list.")
        changes["city"] = city.name

    latitude = changes.pop("latitude", None)
    longitude = changes.pop("longitude", None)
    for field, value in changes.items():
        setattr(property_record, field, value)
    if latitude is not None and longitude is not None:
        property_record.coordinates = WKTElement(
            f"POINT({longitude} {latitude})",
            srid=4326,
        )

    db.commit()
    db.refresh(property_record)
    return property_record



@router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_property(
    property_id: UUID,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user)
):
    property_record = db.query(Property).filter(Property.id == property_id).first()
    
    if not property_record:
        raise HTTPException(status_code=404, detail="Property not found")
        
    if str(property_record.owner_id) != str(current_user.id) and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete this property.")

    if property_record.image_urls:
        await delete_images_from_storage(property_record.image_urls)
        
    db.delete(property_record)
    db.commit()
    return None


@router.post("/{property_id}/save", status_code=status.HTTP_201_CREATED)
def save_property(
    property_id: UUID,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    property_record = db.query(Property.id).filter(
        Property.id == property_id,
        Property.status == "active",
    ).first()
    if property_record is None:
        raise HTTPException(status_code=404, detail="Property not found")

    db.execute(
        insert(SavedProperty)
        .values(user_id=current_user.id, property_id=property_id)
        .on_conflict_do_nothing()
    )
    db.commit()
    return {"saved": True}


@router.delete("/{property_id}/save", status_code=status.HTTP_204_NO_CONTENT)
def unsave_property(
    property_id: UUID,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    db.query(SavedProperty).filter(
        SavedProperty.user_id == current_user.id,
        SavedProperty.property_id == property_id,
    ).delete(synchronize_session=False)
    db.commit()
    return None


@router.post("/{property_id}/view")
def count_property_view(
    property_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
):
    property_record = db.query(Property).filter(
        Property.id == property_id,
        Property.status == "active",
    ).first()
    if property_record is None:
        raise HTTPException(status_code=404, detail="Property not found")

    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "")
    visitor_id = request.headers.get("x-visitor-id")
    try:
        visitor_identity = str(UUID(visitor_id)) if visitor_id else f"{client_ip}|{user_agent}"
    except ValueError:
        visitor_identity = f"{client_ip}|{user_agent}"
    viewed_on = datetime.now(timezone.utc).date()
    visitor_hash = hmac.new(
        SECRET_KEY.encode(),
        f"{visitor_identity}|{viewed_on.isoformat()}".encode(),
        hashlib.sha256,
    ).hexdigest()

    db.query(PropertyView).filter(
        PropertyView.property_id == property_id,
        PropertyView.viewed_on < viewed_on - timedelta(days=30),
    ).delete(synchronize_session=False)
    result = db.execute(
        insert(PropertyView)
        .values(
            property_id=property_id,
            visitor_hash=visitor_hash,
            viewed_on=viewed_on,
        )
        .on_conflict_do_nothing()
    )
    if result.rowcount:
        db.query(Property).filter(Property.id == property_id).update(
            {Property.view_count: Property.view_count + 1},
            synchronize_session=False,
        )
    db.commit()
    current_count = db.query(Property.view_count).filter(Property.id == property_id).scalar()
    return {"view_count": current_count}