from types import SimpleNamespace
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from firebase_admin import auth as firebase_auth
from firebase_admin import exceptions as firebase_exceptions

import main


class FirebaseAuthenticationTests(unittest.TestCase):
    def setUp(self):
        self.admin_app = SimpleNamespace(project_id="careerscout-ai-43715")
        self.credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials="test-id-token",
        )

    def authenticate(self):
        return main.require_firebase_user(request=None, credentials=self.credentials)

    def test_valid_token_is_verified_without_auth_api_revocation_lookup(self):
        decoded_token = {
            "uid": "student-123",
            "email_verified": True,
            "firebase": {"sign_in_provider": "password"},
        }
        with (
            patch.object(main, "get_firebase_admin_app", return_value=self.admin_app),
            patch.object(main.firebase_auth, "verify_id_token", return_value=decoded_token) as verify,
        ):
            self.assertEqual(self.authenticate(), "student-123")

        verify.assert_called_once_with(
            "test-id-token",
            app=self.admin_app,
            check_revoked=False,
        )

    def test_invalid_token_returns_401(self):
        with (
            patch.object(main, "get_firebase_admin_app", return_value=self.admin_app),
            patch.object(
                main.firebase_auth,
                "verify_id_token",
                side_effect=firebase_auth.InvalidIdTokenError("invalid token"),
            ),
        ):
            with self.assertRaises(HTTPException) as raised:
                self.authenticate()

        self.assertEqual(raised.exception.status_code, 401)
        self.assertEqual(raised.exception.detail["code"], "firebase-token-invalid")

    def test_auth_service_permission_failure_returns_503(self):
        with (
            patch.object(main, "get_firebase_admin_app", return_value=self.admin_app),
            patch.object(
                main.firebase_auth,
                "verify_id_token",
                side_effect=firebase_exceptions.PermissionDeniedError("permission denied"),
            ),
        ):
            with self.assertRaises(HTTPException) as raised:
                self.authenticate()

        self.assertEqual(raised.exception.status_code, 503)
        self.assertEqual(raised.exception.detail["code"], "firebase-verification-unavailable")


if __name__ == "__main__":
    unittest.main()