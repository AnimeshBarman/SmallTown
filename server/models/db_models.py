import uuid
import sys
import os
from datetime import datetime
from decimal import Decimal
from typing import Any
from sqlalchemy import String, Integer, Numeric, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.sql import func
from sqlalchemy.orm import Mapped, mapped_column
from geoalchemy2 import Geography

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import Base

class Profile(Base):
    __tablename__ = "profiles"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    fullname: Mapped[str | None] = mapped_column(String, nullable=True)
    email: Mapped[str ] = mapped_column(String, unique=True)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)
    role: Mapped[str] = mapped_column(String, default="seeker")
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class Property(Base):
    __tablename__ = "properties"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"))
    
    title: Mapped[str] = mapped_column(String, nullable=False)
    area: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    type: Mapped[str] = mapped_column(String, nullable=False)  # room, pg, flat
    price: Mapped[Decimal] = mapped_column(Numeric, nullable=False) 
    image_urls: Mapped[list[str]] = mapped_column(ARRAY(String), default=[])
    
    coordinates: Mapped[Any] = mapped_column(Geography(geometry_type='POINT', srid=4326, spatial_index=True), nullable=False)
    
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())



class Landmark(Base):
    __tablename__ = "landmarks"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    city_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cities.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String, nullable=False)
    coordinates: Mapped[Any] = mapped_column(Geography(geometry_type='POINT', srid=4326), nullable=False)