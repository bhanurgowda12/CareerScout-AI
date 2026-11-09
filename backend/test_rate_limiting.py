import asyncio
import ipaddress
import json
import os
import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

os.environ["CAREERSCOUT_ENV"] = "test"
os.environ["RATE_LIMIT_STORAGE"] = "memory"

import main
from rate_limiting import (
    RateLimitConfig,
    RateLimitStorageError,
    RateLimiter,
    resolve_client_ip,
)


class RateLimitingTests(unittest.TestCase):
    def setUp(self):
        main.rate_limiter._memory_events.clear()
        self.client = TestClient(main.app)

    def provider_mocks(self):
        return (
            patch.object(
                main,
                "_get_remotive_jobs",
                return_value=([], "2026-11-08T00:00:00+00:00", True),
            ),
            patch.object(
                main,
                "_get_jobicy_jobs",
                return_value=([], "2026-11-08T00:00:00+00:00", True, []),
            ),
        )

    def youtube_response(self):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps({"items": []}).encode()
        return response

    def test_public_get_and_post_share_ip_limit_and_return_retry_after(self):
        get_provider, jobicy_provider = self.provider_mocks()
        with (
            patch.object(main.rate_limit_config, "job_discovery_limit", 1),
            patch.object(main.rate_limit_config, "job_discovery_window_seconds", 60),
            get_provider,
            jobicy_provider,
        ):
            first = self.client.get("/api/job-discovery")
            limited = self.client.post("/api/job-discovery", json={"query": "python"})

        self.assertEqual(first.status_code, 200)
        self.assertEqual(limited.status_code, 429)
        self.assertGreaterEqual(int(limited.headers["Retry-After"]), 1)
        self.assertEqual(limited.json()["detail"], "Rate limit exceeded. Please retry later.")

    def test_limits_are_independent_per_client_ip(self):
        get_provider, jobicy_provider = self.provider_mocks()
        first_client = TestClient(main.app, client=("198.51.100.10", 1234))
        second_client = TestClient(main.app, client=("198.51.100.11", 1234))
        with (
            patch.object(main.rate_limit_config, "job_discovery_limit", 1),
            get_provider,
            jobicy_provider,
        ):
            first = first_client.get("/api/job-discovery")
            repeated = first_client.get("/api/job-discovery")
            other_ip = second_client.get("/api/job-discovery")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(repeated.status_code, 429)
        self.assertEqual(other_ip.status_code, 200)

    def test_forwarded_ip_is_used_only_for_configured_trusted_proxies(self):
        trusted_networks = (ipaddress.ip_network("10.0.0.0/8"),)
        untrusted_scope = {
            "type": "http",
            "client": ("198.51.100.8", 443),
            "headers": [(b"x-forwarded-for", b"203.0.113.4")],
        }
        trusted_scope = {
            "type": "http",
            "client": ("10.0.0.2", 443),
            "headers": [(b"x-forwarded-for", b"203.0.113.4, 10.0.0.3")],
        }
        malformed_scope = {
            "type": "http",
            "client": ("10.0.0.2", 443),
            "headers": [(b"x-forwarded-for", b"not-an-ip, 203.0.113.4")],
        }

        self.assertEqual(resolve_client_ip(untrusted_scope, trusted_networks), "198.51.100.8")
        self.assertEqual(resolve_client_ip(trusted_scope, trusted_networks), "203.0.113.4")
        self.assertEqual(resolve_client_ip(malformed_scope, trusted_networks), "10.0.0.2")

    def test_learning_limit_is_per_authenticated_user_and_preserves_authentication(self):
        def verify(token, app, check_revoked):
            return {
                "uid": token,
                "email_verified": True,
                "firebase": {"sign_in_provider": "password"},
            }

        with (
            patch.object(main.rate_limit_config, "learning_user_limit", 1),
            patch.object(main.rate_limit_config, "learning_user_window_seconds", 60),
            patch.dict(os.environ, {"YOUTUBE_API_KEY": "test-key"}),
            patch.object(main, "get_firebase_admin_app", return_value=MagicMock(project_id="test")),
            patch.object(main.firebase_auth, "verify_id_token", side_effect=verify) as verify_token,
            patch.object(main, "urlopen", return_value=self.youtube_response()),
        ):
            first_user = self.client.get(
                "/api/learning-resources?skill=Python&language=en",
                headers={"Authorization": "Bearer student-1"},
            )
            same_user = self.client.get(
                "/api/learning-resources?skill=Python&language=en",
                headers={"Authorization": "Bearer student-1"},
            )
            other_user = self.client.get(
                "/api/learning-resources?skill=Python&language=en",
                headers={"Authorization": "Bearer student-2"},
            )

        self.assertEqual(first_user.status_code, 200)
        self.assertEqual(same_user.status_code, 429)
        self.assertGreaterEqual(int(same_user.headers["Retry-After"]), 1)
        self.assertEqual(other_user.status_code, 200)
        self.assertEqual(verify_token.call_count, 3)
        self.assertTrue(all(call.kwargs["check_revoked"] is False for call in verify_token.call_args_list))

    def test_learning_resources_still_rejects_unverified_non_google_users(self):
        decoded_token = {
            "uid": "student-unverified",
            "email_verified": False,
            "firebase": {"sign_in_provider": "password"},
        }
        with (
            patch.dict(os.environ, {"YOUTUBE_API_KEY": "test-key"}),
            patch.object(main, "get_firebase_admin_app", return_value=MagicMock(project_id="test")),
            patch.object(main.firebase_auth, "verify_id_token", return_value=decoded_token),
            patch.object(main, "urlopen") as youtube_request,
        ):
            response = self.client.get(
                "/api/learning-resources?skill=Python&language=en",
                headers={"Authorization": "Bearer student-unverified"},
            )

        self.assertEqual(response.status_code, 403)
        youtube_request.assert_not_called()

    def test_production_requires_redis_and_never_uses_memory_fallback(self):
        with self.assertRaisesRegex(ValueError, "not allowed in production"):
            RateLimitConfig.from_environment({
                "CAREERSCOUT_ENV": "production",
                "RATE_LIMIT_STORAGE": "memory",
            })
        with self.assertRaisesRegex(ValueError, "REDIS_URL is required"):
            RateLimitConfig.from_environment({
                "CAREERSCOUT_ENV": "production",
                "RATE_LIMIT_STORAGE": "redis",
            })

        local_config = RateLimitConfig.from_environment({"CAREERSCOUT_ENV": "development"})
        self.assertEqual(local_config.storage, "memory")

    def test_redis_failure_fails_closed_without_using_memory(self):
        config = RateLimitConfig.from_environment({"CAREERSCOUT_ENV": "test"})
        limiter = RateLimiter(config)

        class FailingRedis:
            async def eval(self, *args):
                raise ConnectionError("redis unavailable")

        limiter._redis = FailingRedis()
        with self.assertRaises(RateLimitStorageError):
            asyncio.run(limiter.check("job-discovery-ip", "198.51.100.10", 1, 60))
        self.assertEqual(limiter._memory_events, {})

    def test_rate_limit_middleware_returns_503_when_redis_is_unavailable(self):
        async def redis_unavailable(*_args, **_kwargs):
            raise RateLimitStorageError("Redis rate-limit storage is unavailable.")

        with (
            patch.object(main.rate_limiter, "check", side_effect=redis_unavailable),
            patch.object(main, "_get_remotive_jobs") as remotive,
            patch.object(main, "_get_jobicy_jobs") as jobicy,
        ):
            response = self.client.get("/api/job-discovery")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.json()["detail"],
            "Rate limiting is temporarily unavailable.",
        )
        self.assertNotIn("Retry-After", response.headers)
        remotive.assert_not_called()
        jobicy.assert_not_called()


if __name__ == "__main__":
    unittest.main()
