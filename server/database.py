from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.pool import NullPool
from config import settings


SQLALCHEMY_DATABASE_URL = settings.DATABASE_URI

if not SQLALCHEMY_DATABASE_URL:
    raise RuntimeError("DATABASE_URI environment variable is not set. Please set it in your .env or shell environment..!")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    poolclass=NullPool,
    pool_pre_ping=True
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()