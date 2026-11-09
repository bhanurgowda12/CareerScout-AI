import hashlib
import ipaddress
import logging
import math
import os
import threading
import time
from collections import deque
from dataclasses import dataclass
from typing import Mapping
from uuid import uuid4

from fastapi.responses import JSONResponse
from starlette.datastructures import Headers


class RateLimitStorageError(RuntimeError):
    pass


@dataclass
class RateLimitConfig:
    environment: str
    storage: str
    redis_url: str | None
    trusted_proxy_networks: tuple
    job_discovery_limit: int
    job_discovery_window_seconds: int
    learning_user_limit: int
    learning_user_window_seconds: int

    @classmethod
    def from_environment(cls, environ: Mapping[str, str] | None = None):
        environ = os.environ if environ is None else environ
        environment = environ.get("CAREERSCOUT_ENV", "production").strip().lower()
        if environment not in {"local", "development", "test", "production"}:
            raise ValueError("CAREERSCOUT_ENV must be local, development, test, or production.")

        default_storage = "redis" if environment == "production" else "memory"
        storage = environ.get("RATE_LIMIT_STORAGE", default_storage).strip().lower()
        if storage not in {"memory", "redis"}:
            raise ValueError("RATE_LIMIT_STORAGE must be memory or redis.")
        if storage == "memory" and environment == "production":
            raise ValueError("In-memory rate limiting is not allowed in production.")

        redis_url = environ.get("REDIS_URL", "").strip() or None
        if storage == "redis" and not redis_url:
            raise ValueError("REDIS_URL is required when RATE_LIMIT_STORAGE=redis.")

        trusted_networks = []
        for value in environ.get("CAREERSCOUT_TRUSTED_PROXY_CIDRS", "").split(","):
            cidr = value.strip()
            if cidr:
                try:
                    trusted_networks.append(ipaddress.ip_network(cidr, strict=False))
                except ValueError as error:
                    raise ValueError(
                        f"Invalid CIDR in CAREERSCOUT_TRUSTED_PROXY_CIDRS: {cidr}"
                    ) from error

        return cls(
            environment=environment,
            storage=storage,
            redis_url=redis_url,
            trusted_proxy_networks=tuple(trusted_networks),
            job_discovery_limit=_positive_integer(
                environ, "CAREERSCOUT_JOB_DISCOVERY_RATE_LIMIT", 120
            ),
            job_discovery_window_seconds=_positive_integer(
                environ, "CAREERSCOUT_JOB_DISCOVERY_RATE_WINDOW_SECONDS", 60
            ),
            learning_user_limit=_positive_integer(
                environ, "CAREERSCOUT_LEARNING_RATE_LIMIT", 30
            ),
            learning_user_window_seconds=_positive_integer(
                environ, "CAREERSCOUT_LEARNING_RATE_WINDOW_SECONDS", 60
            ),
        )


def _positive_integer(environ: Mapping[str, str], name: str, default: int):
    try:
        value = int(environ.get(name, str(default)))
    except ValueError as error:
        raise ValueError(f"{name} must be a positive integer.") from error
    if value < 1:
        raise ValueError(f"{name} must be a positive integer.")
    return value


class RateLimiter:
    _REDIS_SCRIPT = """
local now = redis.call('TIME')
local now_ms = now[1] * 1000 + math.floor(now[2] / 1000)
local window_ms = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now_ms - window_ms)
local count = redis.call('ZCARD', KEYS[1])
if count >= limit then
    local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
    local retry_ms = tonumber(oldest[2]) + window_ms - now_ms
    return {0, math.max(1, math.ceil(retry_ms / 1000))}
end
redis.call('ZADD', KEYS[1], now_ms, ARGV[3])
redis.call('PEXPIRE', KEYS[1], window_ms)
return {1, 0}
"""

    def __init__(self, config: RateLimitConfig):
        self.config = config
        self._memory_events = {}
        self._memory_lock = threading.Lock()
        self._redis = None
        if config.storage == "redis":
            try:
                from redis.asyncio import Redis
            except ImportError as error:
                raise RuntimeError(
                    "Redis rate limiting requires the redis package; install backend requirements."
                ) from error
            self._redis = Redis.from_url(config.redis_url, decode_responses=True)

    async def startup(self):
        if self._redis is not None:
            try:
                await self._redis.ping()
            except Exception as error:
                raise RuntimeError("Redis rate-limit storage is unavailable.") from error

    async def shutdown(self):
        if self._redis is not None:
            await self._redis.aclose()

    async def check(self, scope: str, subject: str, limit: int, window_seconds: int):
        subject_hash = hashlib.sha256(subject.encode("utf-8")).hexdigest()
        key = f"careerscout:rate-limit:{scope}:{subject_hash}"
        if self._redis is None:
            return self._check_memory(key, limit, window_seconds)
        try:
            allowed, retry_after = await self._redis.eval(
                self._REDIS_SCRIPT,
                1,
                key,
                window_seconds * 1000,
                limit,
                f"{time.time_ns()}:{uuid4().hex}",
            )
        except Exception as error:
            raise RateLimitStorageError("Redis rate-limit storage is unavailable.") from error
        return None if int(allowed) == 1 else max(1, int(retry_after))

    def _check_memory(self, key: str, limit: int, window_seconds: int):
        now = time.monotonic()
        cutoff = now - window_seconds
        with self._memory_lock:
            if len(self._memory_events) > 10_000:
                for existing_key, events in list(self._memory_events.items()):
                    while events and events[0] <= cutoff:
                        events.popleft()
                    if not events:
                        self._memory_events.pop(existing_key, None)

            events = self._memory_events.setdefault(key, deque())
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= limit:
                return max(1, math.ceil(events[0] + window_seconds - now))
            events.append(now)
            return None


def resolve_client_ip(scope, trusted_proxy_networks):
    client = scope.get("client")
    peer_ip = _parse_ip(client[0]) if client else None
    if peer_ip is None:
        return "unknown"
    if not _is_trusted_proxy(peer_ip, trusted_proxy_networks):
        return str(peer_ip)

    forwarded_for = Headers(scope=scope).get("x-forwarded-for")
    if not forwarded_for:
        return str(peer_ip)
    forwarded_ips = [_parse_ip(part.strip()) for part in forwarded_for.split(",")]
    if not forwarded_ips or any(address is None for address in forwarded_ips):
        return str(peer_ip)

    client_ip = peer_ip
    for forwarded_ip in reversed(forwarded_ips):
        if not _is_trusted_proxy(client_ip, trusted_proxy_networks):
            break
        client_ip = forwarded_ip
    return str(client_ip)


def _parse_ip(value):
    try:
        return ipaddress.ip_address(value)
    except (ValueError, TypeError):
        return None


def _is_trusted_proxy(address, trusted_proxy_networks):
    return any(address in network for network in trusted_proxy_networks)


class JobDiscoveryRateLimitMiddleware:
    def __init__(self, app, limiter: RateLimiter, config: RateLimitConfig):
        self.app = app
        self.limiter = limiter
        self.config = config

    async def __call__(self, scope, receive, send):
        if (
            scope["type"] != "http"
            or scope.get("path") != "/api/job-discovery"
            or scope.get("method") not in {"GET", "POST"}
        ):
            await self.app(scope, receive, send)
            return

        client_ip = resolve_client_ip(scope, self.config.trusted_proxy_networks)
        try:
            retry_after = await self.limiter.check(
                "job-discovery-ip",
                client_ip,
                self.config.job_discovery_limit,
                self.config.job_discovery_window_seconds,
            )
        except RateLimitStorageError:
            logging.getLogger(__name__).exception("Job-discovery rate-limit storage failed.")
            response = JSONResponse(
                status_code=503,
                content={"detail": "Rate limiting is temporarily unavailable."},
            )
            await response(scope, receive, send)
            return
        if retry_after is not None:
            response = JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Please retry later."},
                headers={"Retry-After": str(retry_after)},
            )
            await response(scope, receive, send)
            return

        await self.app(scope, receive, send)
