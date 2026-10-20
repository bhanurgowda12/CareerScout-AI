import json
import os
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlparse

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient
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

    def youtube_response(self, payload):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps(payload).encode()
        return response

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

    def test_missing_bearer_token_returns_401(self):
        with self.assertRaises(HTTPException) as raised:
            main.require_firebase_user(request=None, credentials=None)

        self.assertEqual(raised.exception.status_code, 401)
        self.assertEqual(raised.exception.detail["code"], "firebase-sign-in-required")

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

    def test_malformed_token_returns_401(self):
        with (
            patch.object(main, "get_firebase_admin_app", return_value=self.admin_app),
            patch.object(
                main.firebase_auth,
                "verify_id_token",
                side_effect=firebase_auth.InvalidIdTokenError("Malformed token"),
            ),
        ):
            with self.assertRaises(HTTPException) as raised:
                self.authenticate()

        self.assertEqual(raised.exception.status_code, 401)
        self.assertEqual(raised.exception.detail["code"], "firebase-token-invalid")

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

    def test_supported_languages_set_youtube_search_parameters(self):
        cases = (
            ("en", "English"),
            ("kn", "Kannada"),
            ("hi", "Hindi"),
            ("te", "Telugu"),
            ("ta", "Tamil"),
            ("ml", "Malayalam"),
            ("mr", "Marathi"),
            ("bn", "Bengali"),
        )
        with patch.dict(os.environ, {"YOUTUBE_API_KEY": "test-youtube-key"}):
            for language_code, language_name in cases:
                with self.subTest(language=language_code):
                    response = self.youtube_response({"items": []})
                    with patch.object(main, "urlopen", return_value=response) as urlopen_mock:
                        main.get_learning_resources(
                            skill="JavaScript",
                            language=language_code,
                            _user_id="student-123",
                        )

                    parameters = parse_qs(urlparse(urlopen_mock.call_args.args[0].full_url).query)
                    self.assertEqual(parameters["q"], [f"JavaScript tutorial {language_name}"])
                    self.assertEqual(parameters["relevanceLanguage"], [language_code])
                    self.assertEqual(parameters["regionCode"], ["IN"])
                    self.assertEqual(parameters["type"], ["video"])
                    self.assertEqual(parameters["maxResults"], ["10"])

    def test_unsupported_language_is_rejected_before_youtube_request(self):
        with (
            patch.dict(os.environ, {"YOUTUBE_API_KEY": "test-youtube-key"}),
            patch.object(main, "urlopen") as urlopen_mock,
        ):
            with self.assertRaises(HTTPException) as raised:
                main.get_learning_resources(
                    skill="JavaScript",
                    language="xx",
                    _user_id="student-123",
                )

        self.assertEqual(raised.exception.status_code, 422)
        urlopen_mock.assert_not_called()

    def test_languages_are_separate_youtube_searches(self):
        responses = [self.youtube_response({"items": []}) for _ in range(2)]
        with (
            patch.dict(os.environ, {"YOUTUBE_API_KEY": "test-youtube-key"}),
            patch.object(main, "urlopen", side_effect=responses) as urlopen_mock,
        ):
            for language_code in ("kn", "en"):
                main.get_learning_resources(
                    skill="React",
                    language=language_code,
                    _user_id="student-123",
                )

        queries = [
            parse_qs(urlparse(call.args[0].full_url).query)["q"][0]
            for call in urlopen_mock.call_args_list
        ]
        self.assertEqual(queries, ["React tutorial Kannada", "React tutorial English"])

    def test_multiple_skills_use_the_same_protected_authentication_path(self):
        client = TestClient(main.app)
        decoded_token = {
            "uid": "student-123",
            "email_verified": True,
            "firebase": {"sign_in_provider": "password"},
        }
        with (
            patch.dict(os.environ, {"YOUTUBE_API_KEY": "test-youtube-key"}),
            patch.object(main, "get_firebase_admin_app", return_value=self.admin_app),
            patch.object(main.firebase_auth, "verify_id_token", return_value=decoded_token) as verify,
            patch.object(main, "urlopen", return_value=self.youtube_response({"items": []})),
        ):
            responses = [
                client.get(
                    "/api/learning-resources",
                    params={"skill": skill, "language": "en"},
                    headers={"Authorization": "Bearer test-id-token"},
                )
                for skill in ("React", "HTML", "Accessibility")
            ]

        self.assertEqual([response.status_code for response in responses], [200, 200, 200])
        self.assertEqual(verify.call_count, 3)
        self.assertEqual(
            [call.args[0] for call in verify.call_args_list],
            ["test-id-token", "test-id-token", "test-id-token"],
        )

    def test_pagination_token_and_result_limit(self):
        items = [
            {
                "id": {"videoId": f"video-{index}"},
                "snippet": {
                    "title": f"Lesson {index}",
                    "channelTitle": "Learning Channel",
                    "thumbnails": {},
                },
            }
            for index in range(12)
        ]
        response = self.youtube_response({"items": items, "nextPageToken": "next-page"})
        with (
            patch.dict(os.environ, {"YOUTUBE_API_KEY": "test-youtube-key"}),
            patch.object(main, "urlopen", return_value=response) as urlopen_mock,
        ):
            result = main.get_learning_resources(
                skill="TypeScript",
                language="te",
                page_token="previous-page",
                _user_id="student-123",
            )

        parameters = parse_qs(urlparse(urlopen_mock.call_args.args[0].full_url).query)
        self.assertEqual(parameters["pageToken"], ["previous-page"])
        self.assertEqual(parameters["maxResults"], ["10"])
        self.assertEqual(len(result["videos"]), 10)
        self.assertEqual(result["nextPageToken"], "next-page")


if __name__ == "__main__":
    unittest.main()