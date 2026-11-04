import json
import os
import unittest
from pathlib import Path
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

    def test_role_aliases_match_titles_descriptions_and_categories_without_partial_java_matches(self):
        jobs = [
            main._normalize_remotive_job(self.listing(
                id=1,
                title="Python Engineer",
                url="https://remotive.com/jobs/python-engineer",
            )),
            main._normalize_remotive_job(self.listing(
                id=2,
                title="JavaScript Developer",
                url="https://remotive.com/jobs/javascript-developer",
            )),
            main._normalize_remotive_job(self.listing(
                id=3,
                title="Platform Developer",
                description="<p>Work with a Java Engineer to build services.</p>",
                url="https://remotive.com/jobs/java-description",
            )),
        ]
        with patch.object(main, "_get_remotive_jobs", return_value=(jobs, "stamp", True)):
            with patch.object(main, "_get_jobicy_jobs", return_value=([], "stamp", True, [])):
                python_response = self.client.get(
                    "/api/job-discovery?roleTerms=Python+Developer&roleTerms=Python+Engineer"
                )
                java_response = self.client.get(
                    "/api/job-discovery?roleTerms=Java+Developer&roleTerms=Java+Engineer"
                )

        self.assertEqual([job["title"] for job in python_response.json()["jobs"]], ["Python Engineer"])
        self.assertEqual([job["title"] for job in java_response.json()["jobs"]], ["Platform Developer"])

    def test_category_filter_matches_terms_across_listing_text_and_supports_multiple_categories(self):
        jobs = [
            main._normalize_remotive_job(self.listing(
                id=1,
                title="Platform Engineer",
                description="<p>Build React applications with a React Engineer.</p>",
                url="https://remotive.com/jobs/react-description",
            )),
            main._normalize_remotive_job(self.listing(
                id=2,
                title="Analyst",
                category="Data Scientist",
                url="https://remotive.com/jobs/data-category",
            )),
            main._normalize_remotive_job(self.listing(
                id=3,
                title="Finance Analyst",
                description="<p>Prepare monthly reports.</p>",
                category="Finance",
                url="https://remotive.com/jobs/finance",
            )),
        ]
        with patch.object(main, "_get_remotive_jobs", return_value=(jobs, "stamp", True)):
            with patch.object(main, "_get_jobicy_jobs", return_value=([], "stamp", True, [])):
                response = self.client.get(
                    "/api/job-discovery?category=React+Engineer&category=Data+Scientist"
                )

        self.assertEqual(
            [job["title"] for job in response.json()["jobs"]],
            ["Platform Engineer", "Analyst"],
        )

    def test_skill_filters_match_title_description_category_and_provider_tags(self):
        jobs = [
            main._normalize_remotive_job(self.listing(
                id=1,
                title="Python Developer",
                description="",
                tags=[],
                url="https://remotive.com/jobs/python-title",
            )),
            main._normalize_remotive_job(self.listing(
                id=2,
                title="Frontend Engineer",
                description="<p>Build with TypeScript.</p>",
                tags=[],
                url="https://remotive.com/jobs/typescript-description",
            )),
            main._normalize_remotive_job(self.listing(
                id=3,
                title="Analyst",
                description="",
                category="Data Science",
                tags=[],
                url="https://remotive.com/jobs/data-category",
            )),
            main._normalize_remotive_job(self.listing(
                id=4,
                title="Backend Engineer",
                description="",
                tags=["MongoDB"],
                url="https://remotive.com/jobs/mongodb-tag",
            )),
            main._normalize_remotive_job(self.listing(
                id=5,
                title="JavaScript Developer",
                description="",
                tags=[],
                url="https://remotive.com/jobs/javascript-only",
            )),
        ]
        with patch.object(main, "_get_remotive_jobs", return_value=(jobs, "stamp", True)):
            with patch.object(main, "_get_jobicy_jobs", return_value=([], "stamp", True, [])):
                title_match = self.client.get("/api/job-discovery?skills=Python").json()["jobs"]
                description_match = self.client.get("/api/job-discovery?skills=TypeScript").json()["jobs"]
                category_match = self.client.get("/api/job-discovery?skills=Data+Science").json()["jobs"]
                tag_match = self.client.get("/api/job-discovery?skills=MongoDB").json()["jobs"]
                java_match = self.client.get("/api/job-discovery?skills=Java").json()["jobs"]
                any_selected_match = self.client.get(
                    "/api/job-discovery?skills=Python&skills=MongoDB"
                ).json()["jobs"]
                post_search = self.client.post(
                    "/api/job-discovery",
                    json={"category": ["Backend Engineer"], "skills": ["MongoDB"], "limit": 500},
                )

        self.assertEqual([job["title"] for job in title_match], ["Python Developer"])
        self.assertEqual([job["title"] for job in description_match], ["Frontend Engineer"])
        self.assertEqual([job["title"] for job in category_match], ["Analyst"])
        self.assertEqual([job["title"] for job in tag_match], ["Backend Engineer"])
        self.assertEqual(java_match, [])
        self.assertEqual([job["title"] for job in any_selected_match], ["Python Developer", "Backend Engineer"])
        self.assertEqual(post_search.status_code, 200)
        self.assertEqual([job["title"] for job in post_search.json()["jobs"]], ["Backend Engineer"])

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

    def test_unrestricted_post_search_and_default_role_labels_keep_provider_listings(self):
        remotive_job = main._normalize_remotive_job(self.listing(
            id=7001,
            title="Python Developer",
            url="https://remotive.com/jobs/python-developer-7001",
        ))
        jobicy_job = main._normalize_jobicy_job(self.jobicy_listing(
            id=7002,
            jobTitle="Java Developer",
            url="https://jobicy.com/jobs/java-developer-7002",
        ))
        with patch.object(main, "_get_remotive_jobs", return_value=([remotive_job], "stamp", True)):
            with patch.object(main, "_get_jobicy_jobs", return_value=([jobicy_job], "stamp", True, [])):
                all_job_label = self.client.post("/api/job-discovery", json={
                    "limit": 500,
                    "mode": "jobs",
                    "query": "",
                    "roleTerms": ["ALL TYPE JOB"],
                    "category": ["All Job Types"],
                    "skills": ["", "Any skill"],
                    "company": "",
                    "location": "",
                    "workMode": "Any work mode",
                    "experience": "All opportunities",
                    "employmentType": "Any employment",
                })
                all_types_label = self.client.post("/api/job-discovery", json={
                    "limit": 500,
                    "mode": "jobs",
                    "roleTerms": ["All Job Types"],
                })
                empty_filters = self.client.post("/api/job-discovery", json={
                    "limit": 500,
                    "mode": "jobs",
                    "query": " ",
                    "roleTerms": [""],
                    "category": [""],
                    "skills": [""],
                    "company": " ",
                    "location": " ",
                    "workMode": "",
                    "experience": "",
                    "employmentType": "",
                })

        for response in (all_job_label, all_types_label, empty_filters):
            self.assertEqual(response.status_code, 200)
            self.assertEqual(
                {job["source"] for job in response.json()["jobs"]},
                {"Remotive", "Jobicy"},
            )
            self.assertEqual(response.json()["totalRetrieved"], 2)

    def test_explicit_role_category_and_skill_filters_still_restrict_results(self):
        listings = [
            main._normalize_remotive_job(self.listing(
                id=7011,
                title="Python Developer",
                category="Python",
                tags=["Python"],
                url="https://remotive.com/jobs/python-developer-7011",
            )),
            main._normalize_remotive_job(self.listing(
                id=7012,
                title="Java Developer",
                description="<p>Build applications.</p>",
                category="Java",
                tags=["Java"],
                url="https://remotive.com/jobs/java-developer-7012",
            )),
        ]
        with patch.object(main, "_get_remotive_jobs", return_value=(listings, "stamp", True)):
            with patch.object(main, "_get_jobicy_jobs", return_value=([], "stamp", True, [])):
                role_response = self.client.post("/api/job-discovery", json={
                    "roleTerms": ["Python Developer"],
                })
                category_response = self.client.post("/api/job-discovery", json={
                    "category": ["Java Developer"],
                })
                skill_response = self.client.post("/api/job-discovery", json={
                    "skills": ["Java"],
                })

        self.assertEqual([job["title"] for job in role_response.json()["jobs"]], ["Python Developer"])
        self.assertEqual([job["title"] for job in category_response.json()["jobs"]], ["Java Developer"])
        self.assertEqual([job["title"] for job in skill_response.json()["jobs"]], ["Java Developer"])

    def test_internship_and_fresher_filters_classify_titles_and_keep_unknown_records_uncertain(self):
        listings = [
            main._normalize_remotive_job(self.listing(
                id=1,
                title="Software Intern",
                job_type="",
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
                title="Junior Software Engineer",
                url="https://remotive.com/jobs/junior-engineer-4",
            )),
            main._normalize_remotive_job(self.listing(
                id=5,
                title="Software Engineer",
                url="https://remotive.com/jobs/software-engineer-5",
            )),
        ]
        with patch.object(main, "_get_remotive_jobs", return_value=(listings, "stamp", True)):
            with patch.object(main, "_get_jobicy_jobs", return_value=([], "stamp", True, [])):
                internships = self.client.get("/api/job-discovery?experience=Internships").json()["jobs"]
                freshers = self.client.get("/api/job-discovery?experience=Freshers%20%26%20graduates").json()["jobs"]
                entry_level = self.client.get("/api/job-discovery?experience=Entry-level%20jobs").json()["jobs"]
                experienced = self.client.get("/api/job-discovery?experience=Experienced%20jobs").json()["jobs"]

        self.assertEqual([job["title"] for job in internships], ["Software Intern"])
        self.assertEqual(
            [job["title"] for job in freshers],
            ["Software Intern", "Graduate Software Engineer", "Software Engineer"],
        )
        self.assertEqual(
            [job["title"] for job in entry_level],
            ["Software Intern", "Junior Software Engineer", "Software Engineer"],
        )
        self.assertEqual(
            [job["title"] for job in experienced],
            ["Software Intern", "Senior Software Engineer", "Software Engineer"],
        )
        self.assertEqual(internships[0]["experienceClassification"], "internship")
        self.assertEqual(internships[0]["experienceClassificationSource"], "title")
        self.assertEqual(len(internships), 1)
        internship_with_unknown_seniority = freshers[0]
        self.assertEqual(internship_with_unknown_seniority["experienceOpportunityType"], "internship")
        self.assertEqual(internship_with_unknown_seniority["experienceSeniority"], "unknown")
        graduate = next(job for job in freshers if job["title"] == "Graduate Software Engineer")
        junior = next(job for job in entry_level if job["title"] == "Junior Software Engineer")
        senior = next(job for job in experienced if job["title"] == "Senior Software Engineer")
        unknown = next(job for job in experienced if job["title"] == "Software Engineer")
        self.assertEqual(graduate["experienceSeniority"], "fresher/graduate")
        self.assertEqual(junior["experienceSeniority"], "entry-level")
        self.assertEqual(senior["experienceSeniority"], "experienced")
        self.assertEqual(unknown["experienceSeniority"], "unknown")

    def test_role_and_experience_filters_return_distinct_confirmed_matches_and_unconfirmed_listings(self):
        listings = [
            main._normalize_remotive_job(self.listing(
                id=31,
                title="Full Stack Developer",
                job_type="",
                experience_level="Internship",
                url="https://remotive.com/jobs/full-stack-internship-31",
            )),
            main._normalize_remotive_job(self.listing(
                id=32,
                title="Full Stack Developer Internship",
                job_type="",
                url="https://remotive.com/jobs/full-stack-internship-32",
            )),
            main._normalize_remotive_job(self.listing(
                id=33,
                title="Full Stack Developer",
                experience_level="Graduate",
                url="https://remotive.com/jobs/full-stack-graduate-33",
            )),
            main._normalize_remotive_job(self.listing(
                id=34,
                title="Graduate Full Stack Developer",
                url="https://remotive.com/jobs/full-stack-graduate-34",
            )),
            main._normalize_remotive_job(self.listing(
                id=35,
                title="Full Stack Developer",
                experience_level="Entry Level",
                url="https://remotive.com/jobs/full-stack-entry-35",
            )),
            main._normalize_remotive_job(self.listing(
                id=36,
                title="Junior Full Stack Developer",
                url="https://remotive.com/jobs/full-stack-entry-36",
            )),
            main._normalize_remotive_job(self.listing(
                id=37,
                title="Full Stack Developer",
                job_type="",
                url="https://remotive.com/jobs/full-stack-unknown-37",
            )),
        ]
        expected_classifications = {
            "31": ("internship", "provider"),
            "32": ("internship", "title"),
            "33": ("fresher/graduate", "provider"),
            "34": ("fresher/graduate", "title"),
            "35": ("entry-level", "provider"),
            "36": ("entry-level", "title"),
            "37": ("unknown", "unknown"),
        }
        experience_cases = {
            "Internships": {"31", "32"},
            "Freshers & graduates": {"33", "34"},
            "Entry-level jobs": {"35", "36"},
        }
        confirmed_results = {}
        with patch.object(main, "_get_remotive_jobs", return_value=(listings, "stamp", True)):
            with patch.object(main, "_get_jobicy_jobs", return_value=([], "stamp", True, [])):
                for experience, expected_ids in experience_cases.items():
                    response = self.client.post("/api/job-discovery", json={
                        "roleTerms": ["Full Stack Developer"],
                        "experience": experience,
                        "limit": 500,
                    })
                    self.assertEqual(response.status_code, 200)
                    dimension = (
                        ("experienceOpportunityType", "experienceOpportunityTypeSource")
                        if experience == "Internships"
                        else ("experienceSeniority", "experienceSenioritySource")
                    )
                    actual_classifications = {
                        job["id"]: (job[dimension[0]], job[dimension[1]])
                        for job in response.json()["jobs"]
                    }
                    expected_ids_for_dimension = (
                        {
                            "31": ("internship", "provider"),
                            "32": ("internship", "title"),
                            "37": ("unknown", "unknown"),
                        }
                        if experience == "Internships"
                        else {
                            "31": ("unknown", "unknown"),
                            "32": ("unknown", "unknown"),
                            "37": ("unknown", "unknown"),
                            **{
                                listing_id: classification
                                for listing_id, classification in expected_classifications.items()
                                if listing_id in expected_ids
                            },
                        }
                    )
                    self.assertEqual(actual_classifications, expected_ids_for_dimension, experience)
                    confirmed_results[experience] = {
                        listing_id
                        for listing_id, (classification, _source) in actual_classifications.items()
                        if classification != "unknown"
                    }

        self.assertEqual(len({frozenset(ids) for ids in confirmed_results.values()}), len(experience_cases))

    def test_backend_experience_classifier_matches_shared_cross_language_cases(self):
        cases = json.loads(
            (Path(__file__).resolve().parents[1] / "shared" / "experienceClassificationCases.json")
            .read_text(encoding="utf-8")
        )
        for case in cases:
            with self.subTest(case=case["name"]):
                result = main._classify_experience_level(case["listing"])
                self.assertEqual(result["classification"], case["classification"])
                self.assertEqual(result["source"], case["source"])
                for case_key, result_key in (
                    ("opportunityType", "opportunityType"),
                    ("opportunityTypeSource", "opportunityTypeSource"),
                    ("seniority", "seniority"),
                    ("senioritySource", "senioritySource"),
                ):
                    if case_key in case:
                        self.assertEqual(result[result_key], case[case_key])

    def test_description_inferred_levels_are_filtered_and_returned_with_evidence(self):
        listings = [
            main._normalize_remotive_job(self.listing(
                id=51,
                title="Full-Stack Developer",
                description="<p>3+ years of experience as a full-stack or frontend-heavy engineer.</p>",
                url="https://remotive.com/jobs/full-stack-experienced-51",
            )),
            main._normalize_remotive_job(self.listing(
                id=52,
                title="Full-Stack Developer",
                description="<p>No prior experience required.</p>",
                url="https://remotive.com/jobs/full-stack-entry-52",
            )),
            main._normalize_remotive_job(self.listing(
                id=53,
                title="Full-Stack Developer",
                description="<p>Students use this product. Build with Python.</p>",
                url="https://remotive.com/jobs/full-stack-unknown-53",
            )),
        ]
        with patch.object(main, "_get_remotive_jobs", return_value=(listings, "stamp", True)):
            with patch.object(main, "_get_jobicy_jobs", return_value=([], "stamp", True, [])):
                experienced = self.client.post("/api/job-discovery", json={
                    "roleTerms": ["Full Stack Developer"],
                    "experience": "Experienced jobs",
                    "limit": 50,
                }).json()["jobs"]
                entry_level = self.client.post("/api/job-discovery", json={
                    "roleTerms": ["Full Stack Developer"],
                    "experience": "Entry-level jobs",
                    "limit": 50,
                }).json()["jobs"]

        self.assertEqual(
            [(job["id"], job["experienceSeniority"], job["experienceSenioritySource"]) for job in experienced],
            [("51", "experienced", "description-inferred"), ("53", "unknown", "unknown")],
        )
        self.assertEqual(
            [(job["id"], job["experienceSeniority"], job["experienceSenioritySource"]) for job in entry_level],
            [("52", "entry-level", "description-inferred"), ("53", "unknown", "unknown")],
        )
        self.assertIn("3+ years of experience", experienced[0]["experienceSeniorityEvidence"])
        self.assertEqual(entry_level[0]["experienceClassificationSource"], "description-inferred")

    def test_provider_normalizers_preserve_available_experience_metadata(self):
        remotive = main._normalize_remotive_job(self.listing(
            experience_level="Graduate",
            job_type="Full-time",
        ))
        self.assertEqual(remotive["experienceLevel"], "Graduate")
        self.assertEqual(
            remotive["experienceMetadata"],
            [{"label": "Experience level", "value": "Graduate"}],
        )
        self.assertEqual(main._classify_experience_level(remotive)["classification"], "fresher/graduate")

        jobicy = main._normalize_jobicy_job(self.jobicy_listing(jobLevel="Junior"))
        self.assertEqual(jobicy["experienceLevel"], "Junior")
        self.assertEqual(
            jobicy["experienceMetadata"],
            [{"label": "Job level", "value": "Junior"}],
        )
        self.assertEqual(main._classify_experience_level(jobicy)["classification"], "entry-level")

        for job_level, expected, source in (
            ("Any", "unknown", "unknown"),
            ("Director", "experienced", "provider"),
            ("Midweight", "unknown", "unknown"),
        ):
            with self.subTest(job_level=job_level):
                normalized = main._normalize_jobicy_job(self.jobicy_listing(
                    jobTitle="Software Engineer",
                    jobType=[],
                    jobLevel=job_level,
                ))
                self.assertEqual(normalized["experienceLevel"], job_level)
                self.assertEqual(normalized["experienceMetadata"], [
                    {"label": "Job level", "value": job_level},
                ])
                result = main._classify_experience_level(normalized)
                self.assertEqual(result["seniority"], expected)
                self.assertEqual(result["senioritySource"], source)

        company = {"company": "Example Co"}
        greenhouse = main._normalize_company_board_job("greenhouse", {
            "id": 11,
            "title": "Software Engineer",
            "absolute_url": "https://boards.greenhouse.io/example/jobs/11",
            "metadata": [
                {"name": "Experience Level", "value": "Entry Level"},
                {"name": "Seniority", "value": "Entry Level"},
                {"name": "Team", "value": "Platform"},
            ],
        }, company)
        lever = main._normalize_company_board_job("lever", {
            "id": "12",
            "text": "Senior Engineer",
            "hostedUrl": "https://jobs.lever.co/example/12",
            "categories": {"seniority": "Senior", "commitment": "Full-time"},
        }, company)
        ashby = main._normalize_company_board_job("ashby", {
            "id": "13",
            "title": "Principal Engineer",
            "jobUrl": "https://jobs.ashbyhq.com/example/13",
            "experienceLevel": "Principal",
        }, company)
        self.assertEqual(greenhouse["experienceLevel"], "Entry Level")
        self.assertEqual(
            greenhouse["experienceMetadata"],
            [
                {"label": "Experience Level", "value": "Entry Level"},
                {"label": "Seniority", "value": "Entry Level"},
            ],
        )
        self.assertEqual(main._classify_experience_level(greenhouse)["classification"], "entry-level")
        self.assertEqual(lever["experienceLevel"], "Senior")
        self.assertEqual(main._classify_experience_level(lever)["classification"], "experienced")
        self.assertEqual(ashby["experienceLevel"], "Principal")
        self.assertEqual(main._classify_experience_level(ashby)["classification"], "experienced")

        full_time_only = main._normalize_company_board_job("lever", {
            "id": "14",
            "text": "Software Engineer",
            "hostedUrl": "https://jobs.lever.co/example/14",
            "categories": {"commitment": "Full-time"},
        }, company)
        self.assertEqual(full_time_only["experienceMetadata"], [])
        self.assertEqual(main._classify_experience_level(full_time_only)["classification"], "unknown")

    def test_work_mode_and_employment_filters_keep_unknown_metadata_distinct_from_confirmed_matches(self):
        unknown = main._normalize_remotive_job(self.listing(
            id=10,
            title="Unknown metadata",
            url="https://remotive.com/jobs/unknown-metadata",
        ))
        unknown.update(workMode="", isRemote=None, employmentType="")
        onsite_internship = {
            **unknown,
            "id": "test:onsite",
            "title": "On-site Internship",
            "url": "https://remotive.com/jobs/onsite-internship",
            "workMode": "On-site",
            "isRemote": False,
            "employmentType": "Internship",
        }
        remote_full_time = {
            **unknown,
            "id": "test:remote",
            "title": "Remote Full-time",
            "url": "https://remotive.com/jobs/remote-full-time",
            "workMode": "Remote",
            "isRemote": True,
            "employmentType": "Full-time",
        }
        listings = [unknown, onsite_internship, remote_full_time]
        with patch.object(main, "_get_remotive_jobs", return_value=(listings, "stamp", True)):
            with patch.object(main, "_get_jobicy_jobs", return_value=([], "stamp", True, [])):
                mode_response = self.client.get("/api/job-discovery?workMode=On-site")
                employment_response = self.client.get("/api/job-discovery?employmentType=Internship")

        self.assertEqual(
            [job["title"] for job in mode_response.json()["jobs"]],
            ["Unknown metadata", "On-site Internship"],
        )
        self.assertEqual(
            [job["title"] for job in employment_response.json()["jobs"]],
            ["Unknown metadata", "On-site Internship"],
        )
        self.assertEqual(main._known_work_mode(unknown), "")
        self.assertEqual(main._known_employment_types(unknown), [])

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
