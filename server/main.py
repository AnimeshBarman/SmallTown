from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from contextlib import asynccontextmanager
import uuid
import uvicorn
from database import get_db, engine
from models.db_models import Base

from api.properties import router as properties_router
from api.auth import router as auth_router
from api.search import router as search_router
from api.moderation import router as moderation_router
from api.feedback import router as feedback_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
        Base.metadata.create_all(bind=conn)
        conn.execute(text("ALTER TABLE properties ADD COLUMN IF NOT EXISTS address VARCHAR;"))
        conn.execute(text("ALTER TABLE properties ADD COLUMN IF NOT EXISTS city VARCHAR;"))
        conn.execute(text("ALTER TABLE properties ADD COLUMN IF NOT EXISTS contact_phone VARCHAR;"))
        conn.execute(text(
            "ALTER TABLE properties ADD COLUMN IF NOT EXISTS "
            "contact_sharing_consent BOOLEAN NOT NULL DEFAULT FALSE;"
        ))
        conn.execute(text("ALTER TABLE properties ADD COLUMN IF NOT EXISTS moderation_reason TEXT;"))
        conn.execute(text("ALTER TABLE properties ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;"))
        conn.execute(text(
            "ALTER TABLE properties ADD COLUMN IF NOT EXISTS "
            "moderated_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL;"
        ))
        conn.execute(text("""
            DO $$
            DECLARE
                enum_schema TEXT;
            BEGIN
                SELECT namespace.nspname
                INTO enum_schema
                FROM pg_type AS enum_type
                JOIN pg_namespace AS namespace ON namespace.oid = enum_type.typnamespace
                WHERE enum_type.typname = 'property_status'
                  AND enum_type.typtype = 'e'
                LIMIT 1;

                IF enum_schema IS NOT NULL THEN
                    EXECUTE format(
                        'ALTER TYPE %I.property_status ADD VALUE IF NOT EXISTS %L',
                        enum_schema,
                        'removed'
                    );
                END IF;
            END
            $$;
        """))
        conn.execute(text(
            "ALTER TABLE cities ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE;"
        ))
        conn.execute(text(
            "ALTER TABLE cities ADD COLUMN IF NOT EXISTS center_latitude NUMERIC(9, 6);"
        ))
        conn.execute(text(
            "ALTER TABLE cities ADD COLUMN IF NOT EXISTS center_longitude NUMERIC(9, 6);"
        ))
        conn.execute(text(
            "ALTER TABLE cities ADD COLUMN IF NOT EXISTS "
            "created_at TIMESTAMPTZ NOT NULL DEFAULT now();"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_properties_city_created_at "
            "ON properties (city, created_at DESC);"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_properties_status_city_created_at "
            "ON properties (status, city, created_at DESC);"
        ))
        city_values = {
            "id": uuid.uuid4(),
            "name": "Cooch Behar",
            "state": "West Bengal",
            "latitude": 26.323,
            "longitude": 89.451,
        }
        conn.execute(
            text("SELECT pg_advisory_xact_lock(hashtext('smalltown:seed-city:cooch-behar'))")
        )
        existing_city = conn.execute(
            text(
                "UPDATE cities SET state = :state, is_active = TRUE, "
                "center_latitude = :latitude, center_longitude = :longitude "
                "WHERE name = :name RETURNING id"
            ),
            city_values,
        ).first()
        if existing_city is None:
            conn.execute(
                text(
                    "INSERT INTO cities "
                    "(id, name, state, is_active, center_latitude, center_longitude) "
                    "VALUES (:id, :name, :state, TRUE, :latitude, :longitude)"
                ),
                city_values,
            )

    yield

app = FastAPI(lifespan=lifespan, title="Welcome to SmallTown Api", version="1.0.0")

origins = [
    "http://localhost:3000",
    "http://192.168.1.8:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(properties_router, prefix="/api/v1/properties", tags=["Properties"])
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(search_router, prefix="/api/v1/search", tags=["AI Search"])
app.include_router(moderation_router, prefix="/api/v1", tags=["Moderation"])
app.include_router(feedback_router, prefix="/api/v1/feedback", tags=["Feedback"])




@app.get("/")
def root():
    return {"Message": "Welcome to SmallTown Api"}


@app.get("/api/v1/test-db")
def test_database_connection(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"message": "Supabase PostgreSQL Database Connected Successfully! 🎉"}
    except Exception as e:
        return {"status": "Database Connection Failed..!", "error": str(e)}
    

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)