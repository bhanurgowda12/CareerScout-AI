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
        with self.assertLogs(main.__name__, level="WARNING") as captured_logs:
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
        self.assertIn("category=invalid-token", captured_logs.output[0])
        self.assertNotIn("test-id-token", captured_logs.output[0])

    def test_specific_invalid_token_reasons_precede_invalid_token_fallback(self):
        cases = (
            (
                'Invalid audience claim "aud".',
                "project-mismatch",
                "firebase-token-project-mismatch",
            ),
            ("Invalid issuer claim.", "issuer-mismatch", "firebase-token-issuer-mismatch"),
            ("Invalid token signature.", "signature-invalid", "firebase-token-signature-invalid"),
        )
        for message, expected_category, expected_code in cases:
            with self.subTest(category=expected_category):
                category, error_code, _ = main._classify_token_verification_error(
                    firebase_auth.InvalidIdTokenError(message)
                )

                self.assertEqual(category, expected_category)
                self.assertEqual(error_code, expected_code)

    def test_expired_token_remains_classified_as_expired(self):
        with self.assertLogs(main.__name__, level="WARNING") as captured_logs:
            with (
                patch.object(main, "get_firebase_admin_app", return_value=self.admin_app),
                patch.object(
                    main.firebase_auth,
                    "verify_id_token",
                    side_effect=firebase_auth.ExpiredIdTokenError("Token expired", None),
                ),
            ):
                with self.assertRaises(HTTPException) as raised:
                    self.authenticate()

        self.assertEqual(raised.exception.status_code, 401)
        self.assertEqual(raised.exception.detail["code"], "firebase-token-expired")
        self.assertIn("category=expired-token", captured_logs.output[0])

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