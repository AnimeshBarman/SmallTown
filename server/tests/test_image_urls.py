import unittest
from uuid import uuid4

from config import settings
from image_urls import is_trusted_property_image_url


class TrustedPropertyImageUrlTests(unittest.TestCase):
    def setUp(self):
        project_url = settings.SUPABASE_URL.rstrip("/")
        image_name = f"{uuid4()}.webp"
        self.valid_url = (
            f"{project_url}/storage/v1/object/public/property-images/{image_name}"
        )

    def test_accepts_https_image_in_property_bucket(self):
        self.assertTrue(is_trusted_property_image_url(self.valid_url))

    def test_rejects_non_https_image(self):
        self.assertFalse(is_trusted_property_image_url(self.valid_url.replace("https://", "http://", 1)))

    def test_rejects_other_bucket(self):
        self.assertFalse(
            is_trusted_property_image_url(
                self.valid_url.replace("/property-images/", "/other-bucket/", 1)
            )
        )

    def test_rejects_other_host(self):
        self.assertFalse(
            is_trusted_property_image_url(
                self.valid_url.replace(settings.SUPABASE_URL.split("://", 1)[1].split("/", 1)[0], "images.example", 1)
            )
        )

    def test_rejects_non_uuid_or_nested_object_path(self):
        base = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/public/property-images/"
        self.assertFalse(is_trusted_property_image_url(f"{base}other-image.webp"))
        self.assertFalse(is_trusted_property_image_url(f"{base}a%2Fb.webp"))


if __name__ == "__main__":
    unittest.main()
