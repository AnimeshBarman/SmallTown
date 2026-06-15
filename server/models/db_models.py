from sqlalchemy import Column, String, Integer, Numeric, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.sql import func
from geoalchemy2 import Geography
import uuid

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import Base

class Profile(Base):
    __tablename__ = "profiles"
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    fullname = Column(String)
    email = Column(String, unique=True)
    avatar_url = Column(String)
    role = Column(String, default="seeker")
    phone = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Property(Base):
    __tablename__ = "properties"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"))
    
    title = Column(String, nullable=False)
    description = Column(String)
    type = Column(String, nullable=False)  # room, pg, flat
    price = Column(Numeric, nullable=False)
    image_urls = Column(ARRAY(String), default=[])
    
    coordinates = Column(Geography(geometry_type='POINT', srid=4326, spatial_index=True), nullable=False)
    
    is_verified = Column(Boolean, default=False)
    view_count = Column(Integer, default=0)
    status = Column(String, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())



class Landmark(Base):
    __tablename__ = "landmarks"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    city_id = Column(UUID(as_uuid=True), ForeignKey("cities.id", ondelete="CASCADE"))
    name = Column(String, nullable=False)
    coordinates = Column(Geography(geometry_type='POINT', srid=4326), nullable=False)