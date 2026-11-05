import unittest
from uuid import uuid4

from fastapi import HTTPException, Response
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.requests import Request

from api.auth import (
    ACCESS_COOKIE_PATH,
    REFRESH_COOKIE_PATH,
    REFRESH_COOKIE_NAME,
    _clear_session_cookies,
    _set_session_cookies,
)
from api.feedback import router as feedback_router
from config import settings
from dependencies import ACCESS_COOKIE_NAME, verify_token
from security import (
    create_access_token,
    hash_refresh_token,
    verify_refresh_token_hash,
)


def make_request(headers: list[tuple[bytes, bytes]]) -> Request:
    return Request({
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "https",
        "path": "/api/v1/auth/me",
        "raw_path": b"/api/v1/auth/me",
        "query_string": b"",
        "root_path": "",
        "headers": headers,
        "client": ("127.0.0.1", 1234),
        "server": ("smalltown.test", 443),
    })


class AuthSessionTests(unittest.TestCase):
    def test_access_token_is_accepted_from_cookie(self):
        user_id = str(uuid4())
        token = create_access_token({"sub": user_id})
        request = make_request([
            (b"cookie", f"{ACCESS_COOKIE_NAME}={token}".encode()),
        ])

        self.assertEqual(verify_token(request), user_id)

    def test_authorization_header_is_not_a_fallback(self):
        token = create_access_token({"sub": str(uuid4())})
        request = make_request([
            (b"authorization", f"Bearer {token}".encode()),
        ])

        with self.assertRaises(HTTPException) as raised:
            verify_token(request)
        self.assertEqual(raised.exception.status_code, 401)

    def test_refresh_token_hash_verifies_without_storing_token(self):
        token = "opaque-refresh-token"
        stored_hash = hash_refresh_token(token)

        self.assertNotEqual(stored_hash, token)
        self.assertTrue(verify_refresh_token_hash(token, stored_hash))
        self.assertFalse(verify_refresh_token_hash("different-token", stored_hash))
        self.assertFalse(verify_refresh_token_hash(token, None))

    def test_session_cookies_are_http_only_and_scoped(self):
        response = Response()
        _set_session_cookies(response, "access-value", "refresh-value")
        headers = response.headers.getlist("set-cookie")

        self.assertEqual(len(headers), 2)
        access_cookie = next(value for value in headers if value.startswith(f"{ACCESS_COOKIE_NAME}="))
        refresh_cookie = next(value for value in headers if value.startswith(f"{REFRESH_COOKIE_NAME}="))
        for cookie in headers:
            self.assertIn("httponly", cookie.lower())
            self.assertIn("samesite=lax", cookie.lower())
            self.assertEqual("secure" in cookie.lower(), settings.COOKIE_SECURE)
        self.assertIn(f"path={ACCESS_COOKIE_PATH}", access_cookie.lower())
        self.assertIn(f"path={REFRESH_COOKIE_PATH}", refresh_cookie.lower())

    def test_logout_expires_both_cookies(self):
        response = Response()
        _clear_session_cookies(response)
        headers = response.headers.getlist("set-cookie")

        self.assertEqual(len(headers), 2)
        self.assertTrue(all("max-age=0" in cookie.lower() for cookie in headers))

    def test_feedback_paths_do_not_redirect_before_authentication(self):
        app = FastAPI()
        app.include_router(feedback_router, prefix="/api/v1/feedback")
        client = TestClient(app)

        for path in ("/api/v1/feedback", "/api/v1/feedback/"):
            response = client.get(path, follow_redirects=False)
            self.assertEqual(response.status_code, 401)


if __name__ == "__main__":
    unittest.main()
