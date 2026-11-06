"""Adopt existing databases and create the current application schema.

Revision ID: 20261106_01
Revises:
Create Date: 2026-11-06
"""
from alembic import op


revision = "20261106_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    # This first revision is deliberately idempotent: existing installs already
    # have most tables, while fresh databases need the complete baseline schema.
    op.execute("""
        CREATE TABLE IF NOT EXISTS profiles (
            id UUID NOT NULL PRIMARY KEY,
            fullname VARCHAR,
            email VARCHAR NOT NULL UNIQUE,
            avatar_url VARCHAR,
            role VARCHAR NOT NULL,
            phone VARCHAR,
            hashed_password VARCHAR,
            refresh_token VARCHAR,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS feedback (
            id UUID NOT NULL PRIMARY KEY,
            category VARCHAR(20) NOT NULL,
            message TEXT NOT NULL,
            email VARCHAR,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS cities (
            id UUID NOT NULL PRIMARY KEY,
            name VARCHAR NOT NULL UNIQUE,
            state VARCHAR,
            is_active BOOLEAN NOT NULL,
            center_latitude NUMERIC(9, 6),
            center_longitude NUMERIC(9, 6),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS profile_name_changes (
            id UUID NOT NULL PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS listing_deletion_notices (
            id UUID NOT NULL PRIMARY KEY,
            property_id UUID NOT NULL,
            owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
            admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
            property_title VARCHAR NOT NULL,
            city VARCHAR,
            owner_email VARCHAR NOT NULL,
            admin_email VARCHAR NOT NULL,
            reason TEXT NOT NULL,
            moderation_history JSON NOT NULL,
            deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS properties (
            id UUID NOT NULL PRIMARY KEY,
            owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            title VARCHAR NOT NULL,
            area VARCHAR,
            address VARCHAR NOT NULL,
            city VARCHAR NOT NULL,
            contact_phone VARCHAR,
            contact_sharing_consent BOOLEAN NOT NULL,
            description VARCHAR,
            type VARCHAR NOT NULL,
            price NUMERIC NOT NULL,
            image_urls VARCHAR[] NOT NULL,
            coordinates geography(POINT,4326) NOT NULL,
            is_verified BOOLEAN NOT NULL,
            view_count INTEGER NOT NULL,
            status VARCHAR NOT NULL,
            moderation_reason TEXT,
            moderated_at TIMESTAMPTZ,
            moderated_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS landmarks (
            id UUID NOT NULL PRIMARY KEY,
            city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
            name VARCHAR NOT NULL,
            coordinates geography(POINT,4326) NOT NULL
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS listing_reports (
            id UUID NOT NULL PRIMARY KEY,
            property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
            reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            reason VARCHAR(40) NOT NULL,
            details TEXT,
            status VARCHAR(20) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            reviewed_at TIMESTAMPTZ,
            reviewed_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
            resolution_note TEXT
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS listing_moderation_actions (
            id UUID NOT NULL PRIMARY KEY,
            property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
            admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
            status VARCHAR(20) NOT NULL,
            reason TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS saved_properties (
            user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (user_id, property_id)
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS property_views (
            property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
            visitor_hash VARCHAR(64) NOT NULL,
            viewed_on DATE NOT NULL,
            PRIMARY KEY (property_id, visitor_hash, viewed_on)
        )
    """)

    # Bring forward columns that were previously added imperatively at startup.
    op.execute("ALTER TABLE properties ADD COLUMN IF NOT EXISTS address VARCHAR")
    op.execute("ALTER TABLE properties ADD COLUMN IF NOT EXISTS city VARCHAR")
    op.execute("ALTER TABLE properties ADD COLUMN IF NOT EXISTS contact_phone VARCHAR")
    op.execute(
        "ALTER TABLE properties ADD COLUMN IF NOT EXISTS "
        "contact_sharing_consent BOOLEAN NOT NULL DEFAULT FALSE"
    )
    op.execute("ALTER TABLE properties ADD COLUMN IF NOT EXISTS moderation_reason TEXT")
    op.execute("ALTER TABLE properties ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ")
    op.execute(
        "ALTER TABLE properties ADD COLUMN IF NOT EXISTS "
        "moderated_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL"
    )
    op.execute("ALTER TABLE feedback ADD COLUMN IF NOT EXISTS email VARCHAR")
    op.execute(
        "ALTER TABLE cities ADD COLUMN IF NOT EXISTS "
        "is_active BOOLEAN NOT NULL DEFAULT FALSE"
    )
    op.execute("ALTER TABLE cities ADD COLUMN IF NOT EXISTS center_latitude NUMERIC(9, 6)")
    op.execute("ALTER TABLE cities ADD COLUMN IF NOT EXISTS center_longitude NUMERIC(9, 6)")
    op.execute(
        "ALTER TABLE cities ADD COLUMN IF NOT EXISTS "
        "created_at TIMESTAMPTZ NOT NULL DEFAULT now()"
    )
    op.execute("""
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
        $$
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_feedback_created_at ON feedback (created_at)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_profile_name_changes_user_changed "
        "ON profile_name_changes (user_id, changed_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_listing_deletion_notices_owner_deleted "
        "ON listing_deletion_notices (owner_id, deleted_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_listing_deletion_notices_deleted_at "
        "ON listing_deletion_notices (deleted_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_properties_coordinates "
        "ON properties USING gist (coordinates)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_properties_status_city_created_at "
        "ON properties (status, city, created_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_properties_city_created_at "
        "ON properties (city, created_at DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_landmarks_coordinates "
        "ON landmarks USING gist (coordinates)"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_listing_reports_open_reporter_property "
        "ON listing_reports (reporter_id, property_id) WHERE status = 'open'"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_listing_reports_status_created "
        "ON listing_reports (status, created_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_listing_moderation_actions_property_created "
        "ON listing_moderation_actions (property_id, created_at)"
    )

    op.execute("SELECT pg_advisory_xact_lock(hashtext('smalltown:seed-city:cooch-behar'))")
    op.execute(
        "UPDATE cities SET state = 'West Bengal', is_active = TRUE, "
        "center_latitude = 26.323, center_longitude = 89.451 "
        "WHERE name = 'Cooch Behar'"
    )
    op.execute(
        "INSERT INTO cities "
        "(id, name, state, is_active, center_latitude, center_longitude) "
        "SELECT 'ed78c4a4-b314-4b6c-81b7-4e27be921621', "
        "'Cooch Behar', 'West Bengal', TRUE, 26.323, 89.451 "
        "WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Cooch Behar')"
    )


def downgrade() -> None:
    # This adoption revision may have run against a database containing user data.
    # Never drop tables or revert compatibility changes automatically.
    pass
