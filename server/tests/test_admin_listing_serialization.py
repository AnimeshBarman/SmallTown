from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, MagicMock, patch
import unittest
from datetime import datetime, timezone
from uuid import uuid4

from api.moderation import _admin_property_data, permanently_delete_admin_property
from models.db_models import Profile, Property
from schemas.moderation_schema import AdminPropertyDeletion, AdminPropertyResponse


class AdminListingSerializationTests(IsolatedAsyncioTestCase):
    def test_listing_remains_serializable_without_owner_profile(self):
        property_record = Property(
            id=uuid4(),
            title="Older listing",
            area=None,
            address="",
            city=None,
            description=None,
            type="room",
            price=1000,
            image_urls=[],
            owner_id=None,
            contact_phone=None,
            status="active",
            view_count=0,
            created_at=datetime.now(timezone.utc),
            moderation_reason=None,
            moderated_at=None,
        )

        result = _admin_property_data(property_record, None)

        self.assertEqual(result["title"], "Older listing")
        self.assertIsNone(result["owner_id"])
        self.assertIsNone(result["owner_name"])
        self.assertEqual(result["owner_email"], "Profile unavailable")
        AdminPropertyResponse.model_validate(result)

    async def test_admin_can_delete_listing_without_owner_profile(self):
        property_record = Property(
            id=uuid4(),
            title="Orphaned listing",
            area=None,
            address="",
            city=None,
            description=None,
            type="room",
            price=1000,
            image_urls=[],
            owner_id=None,
            contact_phone=None,
            status="active",
            view_count=0,
            created_at=datetime.now(timezone.utc),
            moderation_reason=None,
            moderated_at=None,
        )
        admin = Profile(id=uuid4(), email="admin@example.com", role="admin")
        property_query = MagicMock()
        property_query.filter.return_value.with_for_update.return_value.first.return_value = property_record
        owner_query = MagicMock()
        owner_query.filter.return_value.first.return_value = None
        history_query = MagicMock()
        history_query.outerjoin.return_value.filter.return_value.order_by.return_value.all.return_value = []
        db = MagicMock()
        db.query.side_effect = [property_query, owner_query, history_query]
        added_notices = []
        db.add.side_effect = added_notices.append

        with patch("api.moderation.delete_images_from_storage", new_callable=AsyncMock):
            notice = await permanently_delete_admin_property(
                property_record.id,
                AdminPropertyDeletion(reason="This legacy listing is no longer valid."),
                db,
                admin,
            )

        self.assertEqual(notice.owner_id, None)
        self.assertEqual(notice.owner_email, "Profile unavailable")
        db.delete.assert_called_once_with(property_record)
        self.assertEqual(added_notices, [notice])


if __name__ == "__main__":
    unittest.main()
