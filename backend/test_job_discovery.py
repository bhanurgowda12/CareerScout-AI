import json
import os
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient

import main


class RemotiveJobDiscoveryTests(unittest.TestCase):
    def setUp(self):
        main._job_cache.update(jobs=None, fetched_at=None, expires_at=0.0)
        main._jobicy_cache.clear()
        main._company_board_cache.clear()
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
            "salary": "$90,000 - $120,000",
            "tags": ["Python", "APIs", "Remote"],
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
        self.assertEqual(result["jobs"][0]["salary"], "$90,000 - $120,000")
        self.assertEqual(result["jobs"][0]["skills"], ["Python", "APIs", "Remote"])
        self.assertEqual(result["jobs"][0]["sourceType"], "aggregator")
        self.assertEqual(result["jobs"][0]["url"], self.listing()["url"])
        self.assertEqual(result["sources"], ["Remotive"])
        self.assertEqual(len(fetch.call_args_list), 2)
        self.assertTrue(any(
            call.args[0].full_url == "https://remotive.com/api/remote-jobs?limit=100"
            for call in fetch.call_args_list
        ))

    def test_search_matches_partial_terms_across_title_and_description(self):
        matching_job = self.listing(
            id=124,
            title="Senior React Full-stack Developer",
            description="<p>Build frontend products for developers.</p>",
            url="https://remotive.com/remote-jobs/software-dev/full-stack-developer-124",
            candidate_required_location="Worldwide",
        )
        def provider_response(request, timeout):
            if urlparse(request.full_url).hostname == "jobicy.com":
                return self.response({"jobs": []})
            return self.response({
                "jobs": [self.listing(title="Backend Engineer"), matching_job],
            })

        with patch.object(main, "urlopen", side_effect=provider_response) as fetch:
            response = self.client.get(
                "/api/job-discovery?query=fRoNtEnD%20dEvElOpEr&remoteOnly=true&location=San%20Francisco&limit=1"
            )
            broad_response = self.client.get("/api/job-discovery?query=DEVELOPER&remoteOnly=true")

        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(len(result["jobs"]), 1)
        self.assertEqual(result["jobs"][0]["title"], "Senior React Full-stack Developer")
        self.assertEqual(result["jobs"][0]["location"], "Worldwide")
        self.assertFalse(result["cached"])

        self.assertEqual(broad_response.status_code, 200)
        self.assertFalse(broad_response.json()["cached"])
        self.assertEqual(
            [job["title"] for job in broad_response.json()["jobs"]],
            ["Senior React Full-stack Developer"],
        )
        self.assertEqual(len(fetch.call_args_list), 3)
        self.assertTrue(all("Bengaluru" not in call.args[0].full_url for call in fetch.call_args_list))

    def test_role_synonyms_are_or_matched_across_the_cached_provider_listings(self):
        jobs = [
            self.listing(title="Senior Full-Stack Engineer"),
            self.listing(title="Frontend Developer"),
            self.listing(title="Backend Engineer"),
        ]
        with patch.object(main, "urlopen", return_value=self.response({"jobs": jobs})):
            response = self.client.get(
                "/api/job-discovery?roleTerms=Full+Stack+Developer"
                "&roleTerms=Full-Stack+Engineer&limit=50"
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [job["title"] for job in response.json()["jobs"]],
            ["Senior Full-Stack Engineer"],
        )

    def test_expired_cache_refresh_failure_is_not_reported_as_empty_results(self):
        main._job_cache.update(
            jobs=[main._normalize_remotive_job(self.listing())],
            fetched_at="2026-01-02T10:00:00+00:00",
            expires_at=0.0,
        )
        with patch.object(main, "urlopen", side_effect=TimeoutError()):
            response = self.client.get("/api/job-discovery?query=python")

        self.assertEqual(response.status_code, 503)
        self.assertIn("temporarily unavailable", response.json()["detail"]["message"])
        self.assertEqual(
            {item["name"] for item in response.json()["detail"]["providerStatus"]},
            {"Remotive", "Jobicy"},
        )
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

        self.assertEqual(response.status_code, 503)
        self.assertIn("temporarily unavailable", response.json()["detail"]["message"])
        self.assertIsNone(main._job_cache["jobs"])

    def test_invalid_provider_response_structure_returns_502(self):
        with patch.object(main, "urlopen", return_value=self.response({"unexpected": []})):
            response = self.client.get("/api/job-discovery")

        self.assertEqual(response.status_code, 503)
        self.assertIn("temporarily unavailable", response.json()["detail"]["message"])

    def test_malformed_or_oversized_provider_response_returns_502(self):
        malformed = MagicMock()
        malformed.__enter__.return_value.read.return_value = b'{"jobs":'
        with patch.object(main, "urlopen", return_value=malformed):
            malformed_response = self.client.get("/api/job-discovery")

        oversized = self.response({"jobs": []})
        with patch.object(main, "REMOTIVE_MAX_RESPONSE_BYTES", 2):
            with patch.object(main, "JOBICY_MAX_RESPONSE_BYTES", 2):
                with patch.object(main, "urlopen", return_value=oversized):
                    oversized_response = self.client.get("/api/job-discovery")

        self.assertEqual(malformed_response.status_code, 503)
        self.assertEqual(oversized_response.status_code, 503)
        self.assertIsNone(main._job_cache["jobs"])

    def test_successful_response_is_cached_across_search_requests(self):
        def provider_response(request, timeout):
            if urlparse(request.full_url).hostname == "jobicy.com":
                return self.response({"jobs": []})
            return self.response({"jobs": [self.listing()]})

        with patch.object(main, "urlopen", side_effect=provider_response) as fetch:
            first_response = self.client.get("/api/job-discovery")
            second_response = self.client.get("/api/job-discovery")

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.assertFalse(first_response.json()["cached"])
        self.assertTrue(second_response.json()["cached"])
        self.assertEqual(len(fetch.call_args_list), 2)

    def test_timeout_and_upstream_http_error_return_safe_service_errors(self):
        with patch.object(main, "urlopen", side_effect=TimeoutError()):
            timeout_response = self.client.get("/api/job-discovery")

        self.assertEqual(timeout_response.status_code, 503)
        self.assertIn("temporarily unavailable", timeout_response.json()["detail"]["message"])

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
            invalid_limit = self.client.get("/api/job-discovery?limit=501")
            limited = self.client.get("/api/job-discovery?limit=1")

        self.assertEqual(invalid_query.status_code, 422)
        self.assertEqual(invalid_limit.status_code, 422)
        self.assertEqual(limited.status_code, 200)
        self.assertEqual(len(limited.json()["jobs"]), 1)
        self.assertEqual(len(fetch.call_args_list), 2)

    def jobicy_listing(self, **overrides):
        job = {
            "id": 567,
            "jobTitle": "Junior Data Analyst",
            "companyName": "Example Company",
            "url": "https://jobicy.com/jobs/example-data-analyst",
            "jobGeo": "Europe",
            "jobType": ["Full-Time"],
            "jobLevel": "Entry Level",
            "jobDescription": "<p>Analyze data with Python and SQL.</p>",
            "pubDate": "2026-10-24T10:00:00+00:00",
            "salaryMin": 50000,
            "salaryMax": 60000,
            "salaryCurrency": "EUR",
            "salaryPeriod": "yearly",
            "jobIndustry": ["Data Science"],
        }
        job.update(overrides)
        return job

    def test_normalizes_jobicy_public_listing_fields_and_missing_metadata(self):
        normalized = main._normalize_jobicy_job(self.jobicy_listing())
        self.assertEqual(normalized["source"], "Jobicy")
        self.assertEqual(normalized["sourceType"], "aggregator")
        self.assertEqual(normalized["title"], "Junior Data Analyst")
        self.assertEqual(normalized["company"], "Example Company")
        self.assertEqual(normalized["employmentType"], "Full-Time")
        self.assertEqual(normalized["experienceLevel"], "Entry Level")
        self.assertEqual(normalized["salary"], "EUR 50,000 - 60,000 yearly")
        self.assertEqual(normalized["description"], "Analyze data with Python and SQL.")

        sparse = main._normalize_jobicy_job(self.jobicy_listing(
            jobType=None,
            jobLevel=None,
            salaryMin=None,
            salaryMax=None,
            salaryCurrency=None,
            salaryPeriod=None,
            jobGeo=None,
        ))
        self.assertEqual(sparse["employmentType"], "")
        self.assertEqual(sparse["experienceLevel"], "")
        self.assertEqual(sparse["salary"], "")
        self.assertEqual(sparse["location"], "")
        self.assertTrue(sparse["isRemote"])

    def test_jobicy_fetch_caches_mocked_public_api_results(self):
        def paginated_response(request, timeout):
            params = parse_qs(urlparse(request.full_url).query)
            if params.get("cursor") == ["page-2"]:
                return self.response({
                    "jobs": [self.jobicy_listing(
                        id=568,
                        jobTitle="AI Intern",
                        url="https://jobicy.com/jobs/example-ai-intern-568",
                    )],
                    "nextCursor": "page-3",
                })
            return self.response({
                "success": True,
                "jobs": [self.jobicy_listing()],
                "nextCursor": "page-2",
            })

        with patch.object(main, "urlopen", side_effect=paginated_response) as fetch:
            jobs, fetched_at, cached, warnings = main._get_jobicy_jobs()
            second_jobs, second_fetched_at, second_cached, second_warnings = main._get_jobicy_jobs()

        self.assertEqual(len(jobs), 2)
        self.assertEqual(jobs[0]["source"], "Jobicy")
        self.assertFalse(cached)
        self.assertTrue(second_cached)
        self.assertTrue(warnings)
        self.assertEqual(warnings, second_warnings)
        self.assertEqual(fetched_at, second_fetched_at)
        self.assertEqual(jobs, second_jobs)
        self.assertEqual(len(fetch.call_args_list), 2)
        first_params = parse_qs(urlparse(fetch.call_args_list[0].args[0].full_url).query)
        second_params = parse_qs(urlparse(fetch.call_args_list[1].args[0].full_url).query)
        self.assertEqual(first_params["count"], ["200"])
        self.assertEqual(second_params["cursor"], ["page-2"])

    def test_jobicy_only_applies_keyword_when_student_entered_one(self):
        calls = []

        def provider_response(request, timeout):
            calls.append(request.full_url)
            if urlparse(request.full_url).hostname == "jobicy.com":
                return self.response({"jobs": []})
            return self.response({"jobs": []})

        with patch.object(main, "urlopen", side_effect=provider_response):
            self.client.get("/api/job-discovery")
            self.client.get("/api/job-discovery?query=python")

        jobicy_queries = [
            parse_qs(urlparse(url).query)
            for url in calls
            if urlparse(url).hostname == "jobicy.com"
        ]
        self.assertEqual(len(jobicy_queries), 2)
        self.assertNotIn("tag", jobicy_queries[0])
        self.assertEqual(jobicy_queries[1].get("tag"), ["python"])

    def test_jobicy_pagination_failure_keeps_first_page_and_reports_partial_coverage(self):
        def provider_response(request, timeout):
            if parse_qs(urlparse(request.full_url).query).get("cursor"):
                raise TimeoutError()
            return self.response({
                "jobs": [self.jobicy_listing()],
                "nextCursor": "page-2",
            })

        with patch.object(main, "urlopen", side_effect=provider_response):
            jobs, _fetched_at, cached, warnings = main._get_jobicy_jobs()

        self.assertEqual(len(jobs), 1)
        self.assertFalse(cached)
        self.assertTrue(warnings)
        self.assertIn("pagination stopped", warnings[0])

    def test_all_job_types_returns_all_sources_without_default_role_or_keyword(self):
        remotive_job = main._normalize_remotive_job(self.listing())
        jobicy_job = main._normalize_jobicy_job(self.jobicy_listing())
        with patch.object(main, "_get_remotive_jobs", return_value=([remotive_job], "stamp", True)):
            with patch.object(main, "_get_jobicy_jobs", return_value=([jobicy_job], "stamp", True, [])):
                response = self.client.get("/api/job-discovery?limit=500")

        self.assertEqual(response.status_code, 200)
        self.assertEqual({job["source"] for job in response.json()["jobs"]}, {"Remotive", "Jobicy"})
        self.assertEqual(response.json()["totalRetrieved"], 2)
        self.assertEqual({item["name"] for item in response.json()["providerStatus"]}, {"Remotive", "Jobicy"})

    def test_internship_and_fresher_filters_classify_titles_and_keep_unknown_records_uncertain(self):
        listings = [
            main._normalize_remotive_job(self.listing(
                id=1,
                title="Software Intern",
                url="https://remotive.com/jobs/software-intern-1",
            )),
            main._normalize_remotive_job(self.listing(
                id=2,
                title="Graduate Software Engineer",
                url="https://remotive.com/jobs/graduate-engineer-2",
            )),
            main._normalize_remotive_job(self.listing(
                id=3,
                title="Senior Software Engineer",
                url="https://remotive.com/jobs/senior-engineer-3",
            )),
            main._normalize_remotive_job(self.listing(
                id=4,
                title="Software Engineer",
                url="https://remotive.com/jobs/software-engineer-4",
            )),
        ]
        with patch.object(main, "_get_remotive_jobs", return_value=(listings, "stamp", True)):
            with patch.object(main, "_get_jobicy_jobs", return_value=([], "stamp", True, [])):
                internships = self.client.get("/api/job-discovery?experience=Internships").json()["jobs"]
                freshers = self.client.get("/api/job-discovery?experience=Freshers%20%26%20graduates").json()["jobs"]
                entry_level = self.client.get("/api/job-discovery?experience=Entry-level%20jobs").json()["jobs"]

        self.assertEqual([job["title"] for job in internships], ["Software Intern", "Software Engineer"])
        self.assertEqual([job["title"] for job in freshers], ["Graduate Software Engineer", "Software Engineer"])
        self.assertEqual([job["title"] for job in entry_level], ["Graduate Software Engineer", "Software Engineer"])
        self.assertEqual(internships[1]["experienceClassification"], "not stated")
        self.assertEqual(freshers[0]["experienceClassification"], "entry level")

    def test_location_filter_separates_local_remote_global_and_unspecified_without_claiming_city(self):
        listings = [
            main._normalize_remotive_job(self.listing(
                id=1,
                title="Local Engineer",
                candidate_required_location="Bengaluru, India",
                url="https://remotive.com/jobs/local-1",
            )),
            main._normalize_remotive_job(self.listing(
                id=2,
                title="Global Engineer",
                candidate_required_location="Worldwide",
                url="https://remotive.com/jobs/global-2",
            )),
            main._normalize_remotive_job(self.listing(
                id=3,
                title="Remote Engineer",
                candidate_required_location="",
                url="https://remotive.com/jobs/remote-3",
            )),
            main._normalize_remotive_job(self.listing(
                id=4,
                title="US Engineer",
                candidate_required_location="United States",
                url="https://remotive.com/jobs/us-4",
            )),
        ]
        with patch.object(main, "_get_remotive_jobs", return_value=(listings, "stamp", True)):
            with patch.object(main, "_get_jobicy_jobs", return_value=([], "stamp", True, [])):
                response = self.client.get("/api/job-discovery?location=Bengaluru")

        self.assertEqual(response.status_code, 200)
        matches = {job["title"]: job["locationMatch"] for job in response.json()["jobs"]}
        self.assertEqual(matches, {
            "Local Engineer": "local",
            "Global Engineer": "remote-global",
            "Remote Engineer": "remote-unspecified",
        })

    def test_company_search_uses_configured_official_board_and_profile_fields(self):
        timestamp = "2026-10-25T10:00:00+00:00"
        config = {
            "Example Co": {
                "officialName": "Example Corporation",
                "website": "https://example.com",
                "careersUrl": "https://example.com/careers",
                "description": "Configured description",
                "industry": "Software",
                "headquarters": "Somewhere",
                "officeLocations": ["Remote"],
                "verifiedAt": "2026-10-01",
                "boards": {"greenhouse": "example-board"},
            }
        }
        official_job = {
            "id": "greenhouse:42",
            "title": "Graduate Software Engineer",
            "company": "Example Corporation",
            "location": "Remote",
            "employmentType": "",
            "experienceLevel": "",
            "workMode": "",
            "salary": "",
            "skills": [],
            "description": "Build and test software.",
            "publicationDate": "",
            "url": "https://boards.greenhouse.io/example-board/jobs/42",
            "category": "Engineering",
            "isRemote": None,
            "source": "Greenhouse",
            "sourceType": "official_company_board",
            "sourceLabel": "Official Greenhouse company board",
        }
        with patch.dict(os.environ, {"COMPANY_JOB_BOARDS_JSON": json.dumps(config)}):
            with patch.object(main, "_get_remotive_jobs", return_value=([], timestamp, True)):
                with patch.object(main, "_get_jobicy_jobs", return_value=([], timestamp, True)):
                    with patch.object(main, "_fetch_company_board", return_value=([official_job], timestamp, False)):
                        response = self.client.get("/api/job-discovery?mode=company&company=Example%20Co")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["companyStatus"], "configured")
        self.assertEqual(payload["company"]["officialName"], "Example Corporation")
        self.assertEqual(payload["company"]["careersUrl"], "https://example.com/careers")
        self.assertEqual(payload["company"]["detailsSource"], "CareerScout administrator configuration")
        self.assertEqual(payload["officialListings"], 1)
        self.assertEqual(payload["aggregatorListings"], 0)
        self.assertEqual(payload["jobs"][0]["sourceType"], "official_company_board")

    def test_company_lookup_returns_only_matching_jobs_and_verified_career_link_when_available(self):
        google_job = main._normalize_remotive_job(self.listing(
            company_name="Google",
            url="https://remotive.com/remote-jobs/software-dev/google-engineer-44",
        ))
        with patch.dict(os.environ, {"COMPANY_JOB_BOARDS_JSON": ""}):
            with patch.object(main, "_get_remotive_jobs", return_value=([google_job], "stamp", True)):
                with patch.object(main, "_get_jobicy_jobs", return_value=([], "stamp", True, [])):
                    google_response = self.client.get(
                        "/api/job-discovery?mode=company&company=Google"
                    )
                    unsupported_response = self.client.get(
                        "/api/job-discovery?mode=company&company=Unlisted%20Company"
                    )

        self.assertEqual(google_response.status_code, 200)
        self.assertEqual(google_response.json()["companyStatus"], "careers_link_available")
        self.assertEqual(
            google_response.json()["company"]["careersUrl"],
            "https://www.google.com/about/careers/applications/",
        )
        self.assertEqual([job["company"] for job in google_response.json()["jobs"]], ["Google"])
        self.assertEqual(unsupported_response.status_code, 200)
        self.assertEqual(unsupported_response.json()["companyStatus"], "not_configured")
        self.assertEqual(unsupported_response.json()["company"]["careersUrl"], "")

    def test_partial_provider_failure_and_unconfigured_company_do_not_claim_no_openings(self):
        listing = main._normalize_remotive_job(self.listing())
        with patch.dict(os.environ, {"COMPANY_JOB_BOARDS_JSON": ""}):
            with patch.object(main, "_get_remotive_jobs", return_value=([listing], "2026-10-25T00:00:00+00:00", True)):
                with patch.object(main, "_get_jobicy_jobs", side_effect=ValueError("Jobicy is temporarily unavailable.")):
                    partial = self.client.get("/api/job-discovery?mode=company&company=Example%20Co")
        self.assertEqual(partial.status_code, 200)
        self.assertTrue(partial.json()["partial"])
        self.assertEqual(len(partial.json()["jobs"]), 1)
        self.assertEqual(partial.json()["companyStatus"], "not_configured")
        self.assertIn("Jobicy", partial.json()["providerErrors"][0])

        with patch.dict(os.environ, {"COMPANY_JOB_BOARDS_JSON": ""}):
            with patch.object(main, "_get_remotive_jobs", return_value=([], "2026-10-25T00:00:00+00:00", True)):
                with patch.object(main, "_get_jobicy_jobs", return_value=([], "2026-10-25T00:00:00+00:00", True)):
                    empty = self.client.get("/api/job-discovery?mode=company&company=Unlisted%20Company")
        self.assertEqual(empty.status_code, 200)
        self.assertEqual(empty.json()["totalRetrieved"], 0)
        self.assertEqual(empty.json()["companyStatus"], "not_configured")
        self.assertEqual(empty.json()["providerErrors"], [])


if __name__ == "__main__":
    unittest.main()
