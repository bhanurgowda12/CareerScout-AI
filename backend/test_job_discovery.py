import json
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError

from fastapi.testclient import TestClient

import main


class RemotiveJobDiscoveryTests(unittest.TestCase):
    def setUp(self):
        main._job_cache.update(jobs=None, fetched_at=None, expires_at=0.0)
        self.client = TestClient(main.app)

    def response(self, payload):
        result = MagicMock()
        result.__enter__.return_value.read.return_value = json.dumps(payload).encode()
        return result

    def listing(self, **overrides):
        job = {
            "id": 123,
            "title": "Python Engineer",
            "company_name": "Example Co",
            "candidate_required_location": "Worldwide",
            "publication_date": "2026-01-02T10:00:00",
            "description": "<p>Build APIs with Python.</p><script>ignore this</script>",
            "url": "https://remotive.com/remote-jobs/software-dev/python-engineer-123",
            "category": "Software Development",
            "job_type": "full-time",
        }
        job.update(overrides)
        return job

    def test_normalizes_listings_and_filters_the_cached_provider_results(self):
        with patch.object(main, "urlopen", return_value=self.response({"jobs": [self.listing()]})) as fetch:
            response = self.client.get("/api/job-discovery?query=python&remoteOnly=true&limit=1")

        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result["source"], "Remotive")
        self.assertFalse(result["cached"])
        self.assertEqual(len(result["fetchedAt"]), 32)
        self.assertEqual(len(result["jobs"]), 1)
        self.assertEqual(result["jobs"][0]["company"], "Example Co")
        self.assertEqual(result["jobs"][0]["description"], "Build APIs with Python.")
        self.assertTrue(result["jobs"][0]["isRemote"])
        self.assertEqual(result["jobs"][0]["url"], self.listing()["url"])
        fetch.assert_called_once()
        self.assertIn("https://remotive.com/api/remote-jobs?limit=100", fetch.call_args.args[0].full_url)

    def test_search_matches_partial_terms_across_title_and_description(self):
        matching_job = self.listing(
            title="Senior React Full-stack Developer",
            description="<p>Build frontend products for developers.</p>",
            candidate_required_location="Worldwide",
        )
        with patch.object(main, "urlopen", return_value=self.response({
            "jobs": [self.listing(title="Backend Engineer"), matching_job],
        })) as fetch:
            response = self.client.get(
                "/api/job-discovery?query=fRoNtEnD%20dEvElOpEr&remoteOnly=true&limit=1"
            )

        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(len(result["jobs"]), 1)
        self.assertEqual(result["jobs"][0]["title"], "Senior React Full-stack Developer")
        self.assertEqual(result["jobs"][0]["location"], "Worldwide")
        self.assertFalse(result["cached"])

        broad_response = self.client.get("/api/job-discovery?query=DEVELOPER&remoteOnly=true")
        self.assertEqual(broad_response.status_code, 200)
        self.assertTrue(broad_response.json()["cached"])
        self.assertEqual(
            [job["title"] for job in broad_response.json()["jobs"]],
            ["Senior React Full-stack Developer"],
        )
        fetch.assert_called_once()
        self.assertNotIn("Bengaluru", fetch.call_args.args[0].full_url)

    def test_expired_cache_refresh_failure_is_not_reported_as_empty_results(self):
        main._job_cache.update(
            jobs=[main._normalize_remotive_job(self.listing())],
            fetched_at="2026-01-02T10:00:00+00:00",
            expires_at=0.0,
        )
        with patch.object(main, "urlopen", side_effect=TimeoutError()):
            response = self.client.get("/api/job-discovery?query=python")

        self.assertEqual(response.status_code, 503)
        self.assertIn("temporarily unavailable", response.json()["detail"])
        self.assertNotIn("jobs", response.json())

    def test_empty_provider_response_is_a_valid_empty_result(self):
        with patch.object(main, "urlopen", return_value=self.response({"jobs": []})):
            response = self.client.get("/api/job-discovery")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["jobs"], [])

    def test_invalid_individual_records_are_skipped(self):
        with patch.object(main, "urlopen", return_value=self.response({
            "jobs": [
                self.listing(),
                {"title": "Missing company"},
                self.listing(url="http://remotive.com/remote-jobs/insecure"),
                "not a job",
            ],
        })):
            response = self.client.get("/api/job-discovery")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["jobs"]), 1)

    def test_nonempty_response_with_no_valid_listings_is_not_cached_as_empty(self):
        with patch.object(main, "urlopen", return_value=self.response({
            "jobs": [{"title": "Missing company"}, "not a job"],
        })):
            response = self.client.get("/api/job-discovery")

        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json()["detail"], "The remote job provider returned an invalid response.")
        self.assertIsNone(main._job_cache["jobs"])

    def test_invalid_provider_response_structure_returns_502(self):
        with patch.object(main, "urlopen", return_value=self.response({"unexpected": []})):
            response = self.client.get("/api/job-discovery")

        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json()["detail"], "The remote job provider returned an invalid response.")

    def test_malformed_or_oversized_provider_response_returns_502(self):
        malformed = MagicMock()
        malformed.__enter__.return_value.read.return_value = b'{"jobs":'
        with patch.object(main, "urlopen", return_value=malformed):
            malformed_response = self.client.get("/api/job-discovery")

        oversized = self.response({"jobs": []})
        with patch.object(main, "REMOTIVE_MAX_RESPONSE_BYTES", 2):
            with patch.object(main, "urlopen", return_value=oversized):
                oversized_response = self.client.get("/api/job-discovery")

        self.assertEqual(malformed_response.status_code, 502)
        self.assertEqual(oversized_response.status_code, 502)
        self.assertIsNone(main._job_cache["jobs"])

    def test_successful_response_is_cached_across_search_requests(self):
        with patch.object(main, "urlopen", return_value=self.response({"jobs": [self.listing()]})) as fetch:
            first_response = self.client.get("/api/job-discovery")
            second_response = self.client.get("/api/job-discovery?query=python")

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.assertFalse(first_response.json()["cached"])
        self.assertTrue(second_response.json()["cached"])
        fetch.assert_called_once()

    def test_timeout_and_upstream_http_error_return_safe_service_errors(self):
        with patch.object(main, "urlopen", side_effect=TimeoutError()):
            timeout_response = self.client.get("/api/job-discovery")

        self.assertEqual(timeout_response.status_code, 503)
        self.assertIn("temporarily unavailable", timeout_response.json()["detail"])

        main._job_cache.update(jobs=None, fetched_at=None, expires_at=0.0)
        upstream_error = HTTPError("https://remotive.com", 429, "rate limited", None, None)
        with patch.object(main, "urlopen", side_effect=upstream_error):
            http_response = self.client.get("/api/job-discovery")

        self.assertEqual(http_response.status_code, 503)
        self.assertNotIn("rate limited", http_response.text)

    def test_query_parameters_are_validated_and_result_count_is_capped(self):
        with patch.object(main, "urlopen", return_value=self.response({"jobs": [
            self.listing(id=1),
            self.listing(id=2, title="Python Developer"),
        ]})) as fetch:
            invalid_query = self.client.get(f"/api/job-discovery?query={'x' * 101}")
            invalid_limit = self.client.get("/api/job-discovery?limit=51")
            limited = self.client.get("/api/job-discovery?limit=1")

        self.assertEqual(invalid_query.status_code, 422)
        self.assertEqual(invalid_limit.status_code, 422)
        self.assertEqual(limited.status_code, 200)
        self.assertEqual(len(limited.json()["jobs"]), 1)
        fetch.assert_called_once()


if __name__ == "__main__":
    unittest.main()
