import json
import os
import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import nullcontext
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient

os.environ["CAREERSCOUT_ENV"] = "test"
os.environ["RATE_LIMIT_STORAGE"] = "memory"

import main
from provider_controls import (
    BoundedThreadPoolExecutor,
    ProviderCapacityExceeded,
    ProviderConcurrency,
    ProviderCoordinationUnavailable,
    ProviderLease,
)


class ProviderConcurrencyTests(unittest.TestCase):
    def setUp(self):
        main._company_board_cache.clear()
        main.rate_limiter._memory_events.clear()
        self.client = TestClient(main.app)

    def test_memory_provider_limit_rejects_excess_concurrent_work(self):
        limiter = ProviderConcurrency("memory", None, max_concurrent=2)
        lock = threading.Lock()
        active = 0
        peak = 0

        def perform_request():
            nonlocal active, peak
            try:
                with limiter.permit():
                    with lock:
                        active += 1
                        peak = max(peak, active)
                    time.sleep(0.05)
                    with lock:
                        active -= 1
                return "accepted"
            except ProviderCapacityExceeded:
                return "rejected"

        with ThreadPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(lambda _index: perform_request(), range(8)))

        self.assertEqual(peak, 2)
        self.assertEqual(results.count("accepted"), 2)
        self.assertEqual(results.count("rejected"), 6)

    def test_bounded_executor_limits_active_and_queued_tasks(self):
        started = threading.Event()
        release = threading.Event()
        executor = BoundedThreadPoolExecutor(max_workers=1, max_pending=1)
        try:
            running = executor.submit(lambda: (started.set(), release.wait(2)))
            self.assertTrue(started.wait(1))
            queued = executor.submit(lambda: "queued")
            with self.assertRaises(ProviderCapacityExceeded):
                executor.submit(lambda: "overflow")
            release.set()
            running.result(timeout=1)
            self.assertEqual(queued.result(timeout=1), "queued")
        finally:
            release.set()
            executor.shutdown(wait=True)

    def test_same_company_board_is_fetched_once_for_simultaneous_requests(self):
        company = {
            "company": "Example Co",
        }
        calls = []

        def fetch(_url, _source, _max_response_bytes=None, lease_guard=None):
            calls.append(1)
            time.sleep(0.05)
            return []

        with patch.object(main, "_provider_json", side_effect=fetch):
            with ThreadPoolExecutor(max_workers=2) as executor:
                results = list(executor.map(
                    lambda _index: main._fetch_company_board(
                        "lever",
                        "example-board",
                        company,
                    ),
                    range(2),
                ))

        self.assertEqual(len(calls), 1)
        self.assertEqual([result[0] for result in results], [[], []])
        self.assertEqual(sorted(result[2] for result in results), [False, True])

    def test_expired_shared_cache_is_not_promoted_to_a_fresh_local_entry(self):
        stale_fetched_at = (
            datetime.now(timezone.utc) - timedelta(minutes=14, seconds=59)
        ).isoformat()
        lease = ProviderLease()
        cache_key = "lever:example-board:example co:example co"
        with (
            patch.object(
                main.provider_concurrency,
                "singleflight",
                return_value=nullcontext(lease),
            ),
            patch.object(
                main.provider_concurrency,
                "get_shared_board_cache",
                return_value=(["stale listing"], stale_fetched_at, time.time() + 2),
            ),
            patch.object(main.provider_concurrency, "set_shared_board_cache"),
        ):
            jobs, _fetched_at, cached = main._fetch_company_board(
                "lever",
                "example-board",
                {"company": "Example Co", "normalizedName": "example co"},
            )

        self.assertEqual(jobs, ["stale listing"])
        self.assertTrue(cached)
        local_expiry = main._company_board_cache[cache_key]["expires_at"]
        self.assertLessEqual(local_expiry - time.monotonic(), 1.5)

    def test_redis_lease_loss_is_detected_by_active_operation(self):
        lease = ProviderLease()
        lease.lose()
        with self.assertRaises(ProviderCoordinationUnavailable):
            lease.ensure_valid()

    def test_renewal_loss_marks_active_lease_invalid(self):
        class LostLeaseRedis:
            def eval(self, *args):
                return 0

        limiter = ProviderConcurrency("memory", None, max_concurrent=1)
        limiter._redis = LostLeaseRedis()
        limiter.lease_seconds = 1
        renewal = limiter._start_lease_renewal("lease-key", "owner-token")
        try:
            deadline = time.monotonic() + 2
            while time.monotonic() < deadline:
                try:
                    renewal[2].ensure_valid()
                except ProviderCoordinationUnavailable:
                    break
                time.sleep(0.02)
            else:
                self.fail("A failed renewal did not invalidate its lease.")
        finally:
            limiter._stop_lease_renewal(renewal)

    def test_redis_startup_rejects_mismatched_concurrency_configuration(self):
        class FakeRedis:
            config = '{"coordination_prefix":"careerscout:provider","lease_seconds":60,"max_concurrent":4}'

            def ping(self):
                return True

            def set(self, _key, _value, nx=False):
                self.assert_nx = nx
                return False

            def get(self, _key):
                return self.config

        limiter = ProviderConcurrency(
            "memory",
            None,
            max_concurrent=8,
            coordination_prefix="careerscout:provider",
        )
        limiter._redis = FakeRedis()
        with self.assertRaisesRegex(RuntimeError, "configuration differs"):
            limiter.startup()

    def test_company_board_fanout_is_capped_and_reported(self):
        config = {
            "Example Co": {
                "boards": {
                    "greenhouse": "example-greenhouse",
                    "lever": "example-lever",
                },
            },
        }
        with (
            patch.dict(os.environ, {"COMPANY_JOB_BOARDS_JSON": json.dumps(config)}),
            patch.object(main, "COMPANY_BOARD_MAX_FETCHES_PER_SEARCH", 1),
            patch.object(main, "_get_remotive_jobs", return_value=([], "stamp", True)),
            patch.object(main, "_get_jobicy_jobs", return_value=([], "stamp", True, [])),
            patch.object(main, "_fetch_company_board", return_value=([], "stamp", True)) as fetch_board,
        ):
            response = self.client.get("/api/job-discovery")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(fetch_board.call_count, 1)
        self.assertTrue(any(
            "configured company board feeds" in error
            for error in response.json()["providerErrors"]
        ))

    def test_provider_coordination_failure_does_not_fall_back_to_memory(self):
        limiter = ProviderConcurrency("memory", None, max_concurrent=1)

        class FailingRedis:
            def eval(self, *args):
                raise ConnectionError("Redis unavailable")

        limiter.storage = "redis"
        limiter._redis = FailingRedis()
        with self.assertRaises(ProviderCoordinationUnavailable):
            with limiter.permit():
                self.fail("A failed Redis acquire must not enter the provider call.")
        self.assertTrue(limiter._memory_slots.acquire(blocking=False))
        limiter._memory_slots.release()

    def test_provider_capacity_exhaustion_returns_existing_service_error_shape(self):
        with (
            patch.object(main, "_get_remotive_jobs", side_effect=ProviderCapacityExceeded()),
            patch.object(main, "_get_jobicy_jobs", side_effect=ProviderCapacityExceeded()),
        ):
            response = self.client.get("/api/job-discovery")

        self.assertEqual(response.status_code, 503)
        detail = response.json()["detail"]
        self.assertIn("providerStatus", detail)
        self.assertIn("providerErrors", detail)


if __name__ == "__main__":
    unittest.main()
