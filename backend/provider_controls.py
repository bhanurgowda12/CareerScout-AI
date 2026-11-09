import hashlib
import json
import logging
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from uuid import uuid4


class ProviderCapacityExceeded(RuntimeError):
    pass


class ProviderCoordinationUnavailable(RuntimeError):
    pass


class ProviderLease:
    def __init__(self):
        self._lost = threading.Event()

    def lose(self):
        self._lost.set()

    def ensure_valid(self):
        if self._lost.is_set():
            raise ProviderCoordinationUnavailable(
                "Provider coordination lease was lost."
            )


def _positive_integer(name, default, maximum):
    try:
        value = int(os.environ.get(name, str(default)))
    except ValueError as error:
        raise ValueError(f"{name} must be a positive integer.") from error
    if value < 1:
        raise ValueError(f"{name} must be a positive integer.") from None
    if value > maximum:
        raise ValueError(f"{name} must be no greater than {maximum}.")
    return value


class ProviderConcurrency:
    _CONFIG_KEY = "careerscout:{provider-config}:configuration"
    _ACQUIRE_SCRIPT = """
for index = 1, #KEYS do
    if redis.call('SET', KEYS[index], ARGV[1], 'NX', 'PX', ARGV[2]) then
        return index
    end
end
return 0
"""
    _RELEASE_SCRIPT = """
if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
end
return 0
"""
    _RENEW_SCRIPT = """
if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
return 0
"""

    def __init__(
        self,
        storage,
        redis_url,
        max_concurrent,
        lease_seconds=60,
        coordination_prefix="careerscout:provider",
    ):
        if lease_seconds < 30:
            raise ValueError("Provider concurrency leases must be at least 30 seconds.")
        self.storage = storage
        self.max_concurrent = max_concurrent
        self.lease_seconds = lease_seconds
        self.coordination_prefix = coordination_prefix.rstrip(":")
        self._memory_slots = threading.BoundedSemaphore(max_concurrent)
        self._memory_flights = {}
        self._memory_flights_lock = threading.Lock()
        self._redis = None
        if storage == "redis":
            try:
                from redis import Redis
            except ImportError as error:
                raise RuntimeError(
                    "Redis provider coordination requires the redis package."
                ) from error
            self._redis = Redis.from_url(
                redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
            )
        elif storage != "memory":
            raise ValueError("Provider coordination storage must be redis or memory.")

    def startup(self):
        if self._redis is not None:
            try:
                self._redis.ping()
                fingerprint = json.dumps({
                    "max_concurrent": self.max_concurrent,
                    "lease_seconds": self.lease_seconds,
                    "coordination_prefix": self.coordination_prefix,
                }, sort_keys=True, separators=(",", ":"))
                self._redis.set(self._CONFIG_KEY, fingerprint, nx=True)
                configured = self._redis.get(self._CONFIG_KEY)
            except Exception as error:
                raise RuntimeError("Redis provider coordination is unavailable.") from error
            if configured != fingerprint:
                raise RuntimeError(
                    "Provider concurrency configuration differs between instances."
                )

    def shutdown(self):
        if self._redis is not None:
            self._redis.close()

    def _active_keys(self):
        return [
            f"{self.coordination_prefix}:{{provider-slots}}:{index}"
            for index in range(self.max_concurrent)
        ]

    def _start_lease_renewal(self, key, token):
        stopped = threading.Event()
        lease = ProviderLease()

        def renew():
            interval = max(1, self.lease_seconds // 3)
            while not stopped.wait(interval):
                try:
                    renewed = self._redis.eval(
                        self._RENEW_SCRIPT,
                        1,
                        key,
                        token,
                        self.lease_seconds * 1000,
                    )
                except Exception:
                    logging.getLogger(__name__).exception(
                        "Could not renew a provider coordination lease."
                    )
                    lease.lose()
                    return
                if not renewed:
                    logging.getLogger(__name__).error(
                        "Provider coordination lease was lost before release."
                    )
                    lease.lose()
                    return

        thread = threading.Thread(target=renew, daemon=True)
        thread.start()
        return stopped, thread, lease

    @staticmethod
    def _stop_lease_renewal(renewal):
        if renewal is not None:
            stopped, thread, _lease = renewal
            stopped.set()
            thread.join(timeout=1)

    @contextmanager
    def permit(self):
        if self._redis is None:
            if not self._memory_slots.acquire(blocking=False):
                raise ProviderCapacityExceeded("Provider concurrency capacity is exhausted.")
            try:
                yield ProviderLease()
            finally:
                self._memory_slots.release()
            return

        token = uuid4().hex
        try:
            slot = int(self._redis.eval(
                self._ACQUIRE_SCRIPT,
                len(self._active_keys()),
                *self._active_keys(),
                token,
                self.lease_seconds * 1000,
            ))
        except Exception as error:
            raise ProviderCoordinationUnavailable(
                "Provider concurrency coordination is unavailable."
            ) from error
        if slot == 0:
            raise ProviderCapacityExceeded("Provider concurrency capacity is exhausted.")
        active_key = self._active_keys()[slot - 1]
        renewal = None
        try:
            renewal = self._start_lease_renewal(active_key, token)
            yield renewal[2]
        finally:
            self._stop_lease_renewal(renewal)
            try:
                self._redis.eval(
                    self._RELEASE_SCRIPT,
                    1,
                    active_key,
                    token,
                )
            except Exception:
                logging.getLogger(__name__).exception(
                    "Could not release a provider concurrency lease; it will expire automatically."
                )

    @contextmanager
    def singleflight(self, key, wait_seconds):
        if self._redis is None:
            with self._memory_flights_lock:
                lock = self._memory_flights.setdefault(key, threading.Lock())
            if not lock.acquire(timeout=wait_seconds):
                raise ProviderCapacityExceeded(
                    "A matching provider request is still in progress."
                )
            try:
                yield ProviderLease()
            finally:
                lock.release()
            return

        digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
        lock_key = f"{self.coordination_prefix}:singleflight:{digest}"
        token = uuid4().hex
        deadline = time.monotonic() + wait_seconds
        acquired = False
        renewal = None
        try:
            while time.monotonic() < deadline:
                try:
                    acquired = bool(self._redis.set(
                        lock_key,
                        token,
                        nx=True,
                        px=self.lease_seconds * 1000,
                    ))
                except Exception as error:
                    raise ProviderCoordinationUnavailable(
                        "Provider single-flight coordination is unavailable."
                    ) from error
                if acquired:
                    break
                time.sleep(min(0.05, max(0, deadline - time.monotonic())))
            if not acquired:
                raise ProviderCapacityExceeded(
                    "A matching provider request is still in progress."
                )
            renewal = self._start_lease_renewal(lock_key, token)
            yield renewal[2]
        finally:
            if acquired:
                self._stop_lease_renewal(renewal)
                try:
                    self._redis.eval(self._RELEASE_SCRIPT, 1, lock_key, token)
                except Exception:
                    logging.getLogger(__name__).exception(
                        "Could not release a provider single-flight lock; it will expire automatically."
                    )

    def get_shared_board_cache(self, key):
        if self._redis is None:
            return None
        redis_key = self._shared_cache_key(key)
        try:
            value = self._redis.get(redis_key)
            ttl_milliseconds = self._redis.pttl(redis_key)
        except Exception as error:
            raise ProviderCoordinationUnavailable(
                "Provider cache coordination is unavailable."
            ) from error
        if value is None or ttl_milliseconds <= 0:
            return None
        try:
            payload = json.loads(value)
            jobs = payload["jobs"]
            fetched_at = payload["fetched_at"]
            expires_at = payload["expires_at"]
            if (
                not isinstance(jobs, list)
                or not isinstance(fetched_at, str)
                or not isinstance(expires_at, (int, float))
                or expires_at <= time.time()
            ):
                raise ValueError("Invalid shared provider cache.")
            return jobs, fetched_at, min(expires_at, time.time() + ttl_milliseconds / 1000)
        except (json.JSONDecodeError, KeyError, TypeError, ValueError):
            logging.getLogger(__name__).warning("Discarding invalid shared company-board cache entry.")
            try:
                self._redis.delete(redis_key)
            except Exception as error:
                raise ProviderCoordinationUnavailable(
                    "Provider cache coordination is unavailable."
                ) from error
            return None

    def set_shared_board_cache(self, key, jobs, fetched_at, ttl_seconds):
        if self._redis is None:
            return
        payload = json.dumps({
            "jobs": jobs,
            "fetched_at": fetched_at,
            "expires_at": time.time() + ttl_seconds,
        }, separators=(",", ":"))
        try:
            self._redis.set(self._shared_cache_key(key), payload, ex=ttl_seconds)
        except Exception as error:
            raise ProviderCoordinationUnavailable(
                "Provider cache coordination is unavailable."
            ) from error

    def _shared_cache_key(self, key):
        digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
        return f"{self.coordination_prefix}:cache:{digest}"


class BoundedThreadPoolExecutor(ThreadPoolExecutor):
    def __init__(self, max_workers, max_pending, **kwargs):
        super().__init__(max_workers=max_workers, **kwargs)
        self._outstanding_slots = threading.BoundedSemaphore(max_workers + max_pending)

    def submit(self, fn, /, *args, **kwargs):
        if not self._outstanding_slots.acquire(blocking=False):
            raise ProviderCapacityExceeded("Provider task queue capacity is exhausted.")
        try:
            future = super().submit(fn, *args, **kwargs)
        except BaseException:
            self._outstanding_slots.release()
            raise
        future.add_done_callback(lambda _future: self._outstanding_slots.release())
        return future


PROVIDER_MAX_CONCURRENT = _positive_integer("CAREERSCOUT_PROVIDER_MAX_CONCURRENT", 8, 256)
PROVIDER_WORKERS = _positive_integer("CAREERSCOUT_PROVIDER_WORKERS", 7, 64)
PROVIDER_MAX_PENDING = _positive_integer("CAREERSCOUT_PROVIDER_MAX_PENDING", 21, 512)
COMPANY_BOARD_MAX_FETCHES_PER_SEARCH = _positive_integer(
    "CAREERSCOUT_COMPANY_BOARD_MAX_FETCHES_PER_SEARCH", 12, 36
)
PROVIDER_CONCURRENCY_LEASE_SECONDS = _positive_integer(
    "CAREERSCOUT_PROVIDER_CONCURRENCY_LEASE_SECONDS", 60, 3600
)
PROVIDER_SINGLEFLIGHT_WAIT_SECONDS = _positive_integer(
    "CAREERSCOUT_PROVIDER_SINGLEFLIGHT_WAIT_SECONDS", 15, 60
)
