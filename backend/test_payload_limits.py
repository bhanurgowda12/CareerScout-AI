import asyncio
import json
import os
import unittest
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient

os.environ["CAREERSCOUT_ENV"] = "test"
os.environ["RATE_LIMIT_STORAGE"] = "memory"

import main


class RequestAndResponseSizeLimitTests(unittest.TestCase):
    def setUp(self):
        main.rate_limiter._memory_events.clear()
        self.client = TestClient(main.app)

    def youtube_dependencies(self, response, **environment):
        return (
            patch.dict(os.environ, {"YOUTUBE_API_KEY": "test-key", **environment}),
            patch.object(main, "get_firebase_admin_app", return_value=MagicMock(project_id="test")),
            patch.object(
                main.firebase_auth,
                "verify_id_token",
                return_value={
                    "uid": "student-123",
                    "email_verified": True,
                    "firebase": {"sign_in_provider": "password"},
                },
            ),
            patch.object(main, "urlopen", return_value=response),
        )

    def youtube_response(self, body):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = body
        return response

    def test_oversized_post_body_is_rejected_before_json_parsing(self):
        oversized_body = b'{"query":"' + b"x" * main.JOB_DISCOVERY_MAX_REQUEST_BODY_BYTES + b'"}'
        with (
            patch.object(main.rate_limit_config, "job_discovery_limit", 1000),
            patch.object(main, "_get_remotive_jobs") as remotive,
            patch.object(main, "_get_jobicy_jobs") as jobicy,
        ):
            response = self.client.post(
                "/api/job-discovery",
                content=oversized_body,
                headers={"Content-Type": "application/json"},
            )

        self.assertEqual(response.status_code, 413)
        self.assertEqual(
            response.json()["detail"],
            "Request body exceeds the allowed size.",
        )
        remotive.assert_not_called()
        jobicy.assert_not_called()

    def test_malformed_post_json_is_rejected_without_provider_work(self):
        with (
            patch.object(main.rate_limit_config, "job_discovery_limit", 1000),
            patch.object(main, "_get_remotive_jobs") as remotive,
            patch.object(main, "_get_jobicy_jobs") as jobicy,
        ):
            response = self.client.post(
                "/api/job-discovery",
                content=b'{"query":',
                headers={"Content-Type": "application/json"},
            )

        self.assertEqual(response.status_code, 422)
        remotive.assert_not_called()
        jobicy.assert_not_called()

    def test_request_body_limit_is_configurable(self):
        setting = "CAREERSCOUT_JOB_DISCOVERY_MAX_REQUEST_BODY_BYTES"
        with patch.dict(os.environ, {setting: "128"}):
            configured_limit = main._positive_environment_integer(setting, 64 * 1024)

        self.assertEqual(configured_limit, 128)
        with patch.dict(os.environ, {setting: "0"}):
            with self.assertRaisesRegex(ValueError, "must be a positive integer"):
                main._positive_environment_integer(setting, 64 * 1024)

    def test_oversized_chunked_body_is_rejected_without_content_length(self):
        messages = iter((
            {"type": "http.request", "body": b"12345678", "more_body": True},
            {"type": "http.request", "body": b"9", "more_body": False},
        ))
        response_messages = []
        downstream_called = False

        async def receive():
            return next(messages)

        async def send(message):
            response_messages.append(message)

        async def downstream(_scope, _receive, _send):
            nonlocal downstream_called
            downstream_called = True

        middleware = main.JobDiscoveryBodySizeLimitMiddleware(downstream, max_body_bytes=8)
        scope = {
            "type": "http",
            "method": "POST",
            "path": "/api/job-discovery",
            "headers": [],
        }

        asyncio.run(middleware(scope, receive, send))

        self.assertFalse(downstream_called)
        self.assertEqual(response_messages[0]["status"], 413)

    def test_page_token_over_limit_is_rejected_before_youtube_request(self):
        response = self.youtube_response(b'{"items":[]}')
        dependencies = self.youtube_dependencies(response)
        with (
            dependencies[0],
            dependencies[1],
            dependencies[2],
            dependencies[3] as youtube,
        ):
            result = self.client.get(
                "/api/learning-resources",
                params={
                    "skill": "Python",
                    "language": "en",
                    "pageToken": "x" * (main.YOUTUBE_MAX_PAGE_TOKEN_LENGTH + 1),
                },
                headers={"Authorization": "Bearer test-token"},
            )

        self.assertEqual(result.status_code, 422)
        youtube.assert_not_called()

    def test_valid_youtube_response_and_page_token_at_limit_are_preserved(self):
        body = json.dumps({
            "items": [{
                "id": {"videoId": "video-id"},
                "snippet": {
                    "title": "Python tutorial",
                    "channelTitle": "CareerScout",
                    "thumbnails": {"high": {"url": "https://example.com/thumb.jpg"}},
                },
            }],
            "nextPageToken": "next-token",
        }).encode()
        response = self.youtube_response(body)
        dependencies = self.youtube_dependencies(response)
        page_token = "x" * main.YOUTUBE_MAX_PAGE_TOKEN_LENGTH
        with dependencies[0], dependencies[1], dependencies[2], dependencies[3] as youtube:
            result = self.client.get(
                "/api/learning-resources",
                params={"skill": "Python", "language": "en", "pageToken": page_token},
                headers={"Authorization": "Bearer test-id-token"},
            )

        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()["nextPageToken"], "next-token")
        self.assertEqual(result.json()["videos"][0]["videoId"], "video-id")
        query = parse_qs(urlparse(youtube.call_args.args[0].full_url).query)
        self.assertEqual(query["pageToken"], [page_token])

    def test_oversized_youtube_response_is_rejected_before_json_parsing(self):
        response = self.youtube_response(b"x" * 129)
        dependencies = self.youtube_dependencies(response)
        with (
            patch.object(main, "YOUTUBE_MAX_RESPONSE_BYTES", 128),
            dependencies[0],
            dependencies[1],
            dependencies[2],
            dependencies[3] as youtube,
        ):
            result = self.client.get(
                "/api/learning-resources?skill=Python&language=en",
                headers={"Authorization": "Bearer test-token"},
            )

        self.assertEqual(result.status_code, 502)
        self.assertEqual(
            result.json()["detail"],
            "YouTube learning resources are temporarily unavailable.",
        )
        youtube.assert_called_once()
        youtube.return_value.__enter__.return_value.read.assert_called_once_with(129)

    def test_wrapped_youtube_timeout_returns_safe_gateway_error(self):
        dependencies = self.youtube_dependencies(self.youtube_response(b""))
        with (
            dependencies[0],
            dependencies[1],
            dependencies[2],
            patch.object(main, "urlopen", side_effect=URLError("timed out")),
        ):
            result = self.client.get(
                "/api/learning-resources?skill=Python&language=en",
                headers={"Authorization": "Bearer test-id-token"},
            )

        self.assertEqual(result.status_code, 502)
        self.assertEqual(
            result.json()["detail"],
            "YouTube learning resources are temporarily unavailable.",
        )

    def test_youtube_upstream_http_failures_return_safe_gateway_errors(self):
        cases = ((429, 429), (500, 502))
        for upstream_status, expected_status in cases:
            with self.subTest(upstream_status=upstream_status):
                dependencies = self.youtube_dependencies(self.youtube_response(b""))
                upstream_error = HTTPError(
                    "https://youtube.example/search",
                    upstream_status,
                    "upstream failure with private details",
                    None,
                    None,
                )
                with (
                    dependencies[0],
                    dependencies[1],
                    dependencies[2],
                    patch.dict(
                        main.app.dependency_overrides,
                        {main.require_firebase_user: lambda: "student-123"},
                    ),
                    patch.object(main, "urlopen", side_effect=upstream_error),
                ):
                    result = self.client.get(
                        "/api/learning-resources?skill=Python&language=en",
                        headers={"Authorization": "Bearer test-id-token"},
                    )

                self.assertEqual(result.status_code, expected_status)
                self.assertNotIn("private details", result.text)

    def test_malformed_and_undecodable_youtube_json_return_safe_errors(self):
        for body in (
            b'{"items":',
            b"\xff\xfe",
            b"[" * 1200 + b"]" * 1200,
        ):
            with self.subTest(body=body):
                response = self.youtube_response(body)
                dependencies = self.youtube_dependencies(response)
                with dependencies[0], dependencies[1], dependencies[2], dependencies[3]:
                    result = self.client.get(
                        "/api/learning-resources?skill=Python&language=en",
                        headers={"Authorization": "Bearer test-token"},
                    )

                self.assertEqual(result.status_code, 502)
                self.assertEqual(
                    result.json()["detail"],
                    "YouTube learning resources are temporarily unavailable.",
                )

    def test_invalid_youtube_response_shapes_and_field_types_return_safe_errors(self):
        payloads = (
            [],
            {},
            {"items": {}},
            {"items": ["not-an-item"]},
            {"items": [{}]},
            {"items": [{"id": {"videoId": "id"}}]},
            {"items": [{"id": {"videoId": "id"}, "snippet": {"title": "Title"}}]},
            {"items": [{"id": {"videoId": 123}, "snippet": {"title": "Title", "channelTitle": "Channel"}}]},
            {"items": [{"id": {"videoId": "id"}, "snippet": {"title": "Title", "channelTitle": 12}}]},
            {"items": [{"id": None, "snippet": {"title": "Title", "channelTitle": "Channel"}}]},
            {"items": [{"id": {"videoId": "id"}, "snippet": None}]},
            {"items": [{"id": {"videoId": "id"}, "snippet": {"thumbnails": None}}]},
            {"items": [{"id": {"videoId": "id"}, "snippet": {"thumbnails": {"high": None}}}]},
            {"items": [], "nextPageToken": 12},
            {"items": [], "nextPageToken": None},
        )
        for payload in payloads:
            with self.subTest(payload=payload):
                response = self.youtube_response(json.dumps(payload).encode())
                dependencies = self.youtube_dependencies(response)
                with dependencies[0], dependencies[1], dependencies[2], dependencies[3]:
                    result = self.client.get(
                        "/api/learning-resources?skill=Python&language=en",
                        headers={"Authorization": "Bearer test-token"},
                    )

                self.assertEqual(result.status_code, 502)
                self.assertEqual(
                    result.json()["detail"],
                    "YouTube learning resources are temporarily unavailable.",
                )

    def test_youtube_timeout_returns_safe_gateway_error(self):
        dependencies = self.youtube_dependencies(self.youtube_response(b""))
        with (
            dependencies[0],
            dependencies[1],
            dependencies[2],
            patch.object(main, "urlopen", side_effect=TimeoutError()),
        ):
            result = self.client.get(
                "/api/learning-resources?skill=Python&language=en",
                headers={"Authorization": "Bearer test-token"},
            )

        self.assertEqual(result.status_code, 502)
        self.assertEqual(
            result.json()["detail"],
            "YouTube learning resources are temporarily unavailable.",
        )


if __name__ == "__main__":
    unittest.main()
