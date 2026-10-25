import json
import logging
import os
import re
import socket
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, quote, urlparse
from urllib.request import Request as URLRequest, urlopen

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import auth as firebase_auth
from firebase_admin import exceptions as firebase_exceptions
from fastapi import Depends, FastAPI, HTTPException, Query, Request as FastAPIRequest
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google.auth import exceptions as google_auth_exceptions
from google.auth.exceptions import DefaultCredentialsError

load_dotenv(Path(__file__).with_name(".env"))
logging.getLogger(__name__).warning(
    "CareerScout backend loaded; FIREBASE_PROJECT_ID configured: %s; YOUTUBE_API_KEY configured: %s",
    bool(os.environ.get("FIREBASE_PROJECT_ID", "").strip()),
    bool(os.environ.get("YOUTUBE_API_KEY", "").strip()),
)

app = FastAPI(title="CareerScout AI API")
additional_cors_origins = [
    origin.strip().rstrip("/")
    for origin in os.environ.get("CAREERSCOUT_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        *additional_cors_origins,
    ],
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
bearer_scheme = HTTPBearer(auto_error=False)
YOUTUBE_LANGUAGES = {
    "en": "English",
    "kn": "Kannada",
    "hi": "Hindi",
    "te": "Telugu",
    "ta": "Tamil",
    "ml": "Malayalam",
    "mr": "Marathi",
    "bn": "Bengali",
}
REMOTIVE_API_URL = "https://remotive.com/api/remote-jobs?limit=100"
REMOTIVE_CACHE_SECONDS = 8 * 60 * 60
REMOTIVE_MAX_RESPONSE_BYTES = 2 * 1024 * 1024
JOB_DISCOVERY_MAX_RESULTS = 500
JOBICY_API_URL = "https://jobicy.com/api/jobs"
JOBICY_CACHE_SECONDS = 60 * 60
JOBICY_PAGE_SIZE = 200
JOBICY_MAX_PAGES = 2
JOBICY_MAX_RESPONSE_BYTES = 8 * 1024 * 1024
_job_cache = {"jobs": None, "fetched_at": None, "expires_at": 0.0}
_job_cache_lock = threading.Lock()
_jobicy_cache = {}
_jobicy_cache_lock = threading.Lock()
COMPANY_BOARD_CACHE_SECONDS = 15 * 60
COMPANY_BOARD_MAX_RESULTS = 500
COMPANY_BOARD_TIMEOUT_SECONDS = 5
COMPANY_BOARD_MAX_CONFIGS = 12
_company_board_cache = {}
_company_board_cache_lock = threading.Lock()


class _JobDescriptionParser(HTMLParser):
    _BLOCK_TAGS = {"br", "div", "li", "p", "tr"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.hidden_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style"}:
            self.hidden_depth += 1
        elif not self.hidden_depth and tag in self._BLOCK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in {"script", "style"} and self.hidden_depth:
            self.hidden_depth -= 1
        elif not self.hidden_depth and tag in self._BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.hidden_depth:
            self.parts.append(data)


def _plain_job_description(value):
    if not isinstance(value, str):
        return ""
    parser = _JobDescriptionParser()
    parser.feed(value[:50000])
    return re.sub(r"\n{3,}", "\n\n", "".join(parser.parts)).strip()[:20000]


def _normalize_remotive_job(item):
    if not isinstance(item, dict):
        return None

    title = item.get("title")
    company = item.get("company_name")
    url = item.get("url")
    if not all(isinstance(value, str) and value.strip() for value in (title, company, url)):
        return None

    try:
        parsed_url = urlparse(url.strip())
    except ValueError:
        return None
    host = (parsed_url.hostname or "").lower()
    if parsed_url.scheme != "https" or not (host == "remotive.com" or host.endswith(".remotive.com")):
        return None

    def optional_text(key, max_length=500):
        value = item.get(key)
        return value.strip()[:max_length] if isinstance(value, str) else ""

    tags = item.get("tags")
    return {
        "id": str(item.get("id", ""))[:100],
        "title": title.strip()[:200],
        "company": company.strip()[:200],
        "location": optional_text("candidate_required_location"),
        "publicationDate": optional_text("publication_date", 40),
        "description": _plain_job_description(item.get("description")),
        "url": url.strip()[:2048],
        "category": optional_text("category"),
        "employmentType": optional_text("job_type", 100),
        "experienceLevel": "",
        "workMode": "Remote",
        "salary": optional_text("salary", 200),
        "skills": [
            tag.strip()[:100]
            for tag in tags[:30]
            if isinstance(tag, str) and tag.strip()
        ] if isinstance(tags, list) else [],
        "isRemote": True,
        "source": "Remotive",
        "sourceType": "aggregator",
        "sourceLabel": "Remotive job aggregator",
    }


def _get_remotive_jobs():
    now = time.monotonic()
    if _job_cache["jobs"] is not None and now < _job_cache["expires_at"]:
        return _job_cache["jobs"], _job_cache["fetched_at"], True

    with _job_cache_lock:
        now = time.monotonic()
        if _job_cache["jobs"] is not None and now < _job_cache["expires_at"]:
            return _job_cache["jobs"], _job_cache["fetched_at"], True

        request = URLRequest(
            REMOTIVE_API_URL,
            headers={
                "Accept": "application/json",
                "User-Agent": "CareerScout-AI/1.0 (job discovery; https://remotive.com)",
            },
        )
        try:
            with urlopen(request, timeout=10) as response:
                body = response.read(REMOTIVE_MAX_RESPONSE_BYTES + 1)
        except HTTPError as error:
            logging.getLogger(__name__).warning(
                "Remotive job search failed: status=%s", error.code
            )
            raise HTTPException(
                status_code=503,
                detail="Remote job listings are temporarily unavailable. Please try again later.",
            ) from error
        except (URLError, TimeoutError, OSError, json.JSONDecodeError, ValueError) as error:
            logging.getLogger(__name__).warning(
                "Remotive job search failed: exception_type=%s",
                _safe_exception_type(error),
            )
            raise HTTPException(
                status_code=503,
                detail="Remote job listings are temporarily unavailable. Please try again later.",
            ) from error

        if len(body) > REMOTIVE_MAX_RESPONSE_BYTES:
            raise HTTPException(
                status_code=502,
                detail="The remote job provider returned an invalid response.",
            )
        try:
            payload = json.loads(body)
        except (json.JSONDecodeError, UnicodeDecodeError) as error:
            raise HTTPException(
                status_code=502,
                detail="The remote job provider returned an invalid response.",
            ) from error

        if not isinstance(payload, dict) or not isinstance(payload.get("jobs"), list):
            raise HTTPException(
                status_code=502,
                detail="The remote job provider returned an invalid response.",
            )

        jobs = [
            job for job in (_normalize_remotive_job(item) for item in payload["jobs"])
            if job is not None
        ][:100]
        if payload["jobs"] and not jobs:
            raise HTTPException(
                status_code=502,
                detail="The remote job provider returned an invalid response.",
            )

        fetched_at = datetime.now(timezone.utc).isoformat()
        _job_cache.update(
            jobs=jobs,
            fetched_at=fetched_at,
            expires_at=time.monotonic() + REMOTIVE_CACHE_SECONDS,
        )
        return jobs, fetched_at, False


def _normalize_company_name(value):
    if not isinstance(value, str):
        return ""
    normalized = re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()
    normalized = re.sub(r"\bfront\s+end\b", "frontend", normalized)
    normalized = re.sub(r"\bback\s+end\b", "backend", normalized)
    normalized = re.sub(r"\bfull\s+stack\b", "fullstack", normalized)
    return normalized


def _normalize_jobicy_job(item):
    if not isinstance(item, dict):
        return None
    title = item.get("jobTitle")
    company = item.get("companyName")
    url = item.get("url")
    if not all(isinstance(value, str) and value.strip() for value in (title, company, url)):
        return None
    try:
        parsed_url = urlparse(url.strip())
    except ValueError:
        return None
    if parsed_url.scheme != "https" or (parsed_url.hostname or "").lower() not in {"jobicy.com", "www.jobicy.com"}:
        return None

    job_types = item.get("jobType")
    industries = item.get("jobIndustry")
    salary_min = item.get("salaryMin")
    salary_max = item.get("salaryMax")
    salary_currency = item.get("salaryCurrency")
    salary_period = item.get("salaryPeriod")
    salary = ""
    numeric_salary = [
        f"{value:,.0f}" for value in (salary_min, salary_max)
        if isinstance(value, (int, float)) and not isinstance(value, bool)
    ]
    if numeric_salary:
        amount = " - ".join(numeric_salary)
        currency = salary_currency.strip() if isinstance(salary_currency, str) else ""
        period = salary_period.strip() if isinstance(salary_period, str) else ""
        salary = " ".join(part for part in (currency, amount, period) if part)[:200]

    job_level = item.get("jobLevel")
    location = item.get("jobGeo")
    description = item.get("jobDescription") or item.get("jobExcerpt")
    provider_id = str(item.get("id", "")).strip()
    return {
        "id": f"jobicy:{provider_id[:100]}" if provider_id else "",
        "title": title.strip()[:200],
        "company": company.strip()[:200],
        "location": location.strip()[:300] if isinstance(location, str) else "",
        "employmentType": ", ".join(
            value.strip()[:100] for value in job_types[:10]
            if isinstance(value, str) and value.strip()
        ) if isinstance(job_types, list) else "",
        "experienceLevel": job_level.strip()[:100] if isinstance(job_level, str) else "",
        "workMode": "Remote",
        "salary": salary,
        "skills": [],
        "description": _plain_job_description(description),
        "publicationDate": item.get("pubDate", "")[:40] if isinstance(item.get("pubDate"), str) else "",
        "url": url.strip()[:2048],
        "category": ", ".join(
            value.strip()[:100] for value in industries[:10]
            if isinstance(value, str) and value.strip()
        ) if isinstance(industries, list) else "",
        "isRemote": True,
        "source": "Jobicy",
        "sourceType": "aggregator",
        "sourceLabel": "Jobicy remote job aggregator",
    }


def _get_jobicy_jobs(keyword=""):
    normalized_keyword = keyword.strip().casefold() if isinstance(keyword, str) else ""
    cache_key = normalized_keyword
    now = time.monotonic()
    cached_result = _jobicy_cache.get(cache_key)
    if cached_result and now < cached_result["expires_at"]:
        return cached_result["jobs"], cached_result["fetched_at"], True, cached_result["warnings"]

    with _jobicy_cache_lock:
        now = time.monotonic()
        cached_result = _jobicy_cache.get(cache_key)
        if cached_result and now < cached_result["expires_at"]:
            return cached_result["jobs"], cached_result["fetched_at"], True, cached_result["warnings"]

        jobs = []
        warnings = []
        cursor = ""
        seen_cursors = set()
        for page in range(JOBICY_MAX_PAGES):
            params = {"count": JOBICY_PAGE_SIZE}
            if normalized_keyword:
                params["tag"] = keyword.strip()
            if cursor:
                params["cursor"] = cursor
            url = f"{JOBICY_API_URL}?{urlencode(params)}"
            try:
                payload = _provider_json(url, "Jobicy", JOBICY_MAX_RESPONSE_BYTES)
            except (HTTPException, ValueError) as error:
                if page == 0:
                    raise
                warnings.append(f"Jobicy pagination stopped after a provider error: {error}")
                break
            if not isinstance(payload, dict) or not isinstance(payload.get("jobs"), list):
                if page == 0:
                    raise ValueError("Jobicy returned an invalid job-feed response.")
                warnings.append("Jobicy pagination stopped because a later response was invalid.")
                break

            page_jobs = [
                job for job in (_normalize_jobicy_job(item) for item in payload["jobs"])
                if job is not None
            ]
            if payload["jobs"] and not page_jobs:
                if page == 0:
                    raise ValueError("Jobicy returned no valid listings.")
                warnings.append("Jobicy pagination stopped because a later page had no valid listings.")
                break
            jobs.extend(page_jobs)
            next_cursor = payload.get("nextCursor")
            if not isinstance(next_cursor, str) or not next_cursor.strip():
                break
            cursor = next_cursor.strip()
            if cursor in seen_cursors:
                warnings.append("Jobicy pagination stopped because the provider repeated a cursor.")
                break
            seen_cursors.add(cursor)
            if page == JOBICY_MAX_PAGES - 1:
                warnings.append(
                    f"Jobicy retrieval was capped at {JOBICY_MAX_PAGES} cursor pages."
                )
                break

        if not jobs and warnings:
            raise ValueError(warnings[0])
        jobs = _deduplicate_provider_jobs(jobs)
        fetched_at = datetime.now(timezone.utc).isoformat()
        _jobicy_cache[cache_key] = {
            "jobs": jobs,
            "fetched_at": fetched_at,
            "expires_at": time.monotonic() + JOBICY_CACHE_SECONDS,
            "warnings": warnings,
        }
        return jobs, fetched_at, False, warnings


def _fetch_remotive_source(_keyword=""):
    return _get_remotive_jobs()


JOB_DISCOVERY_PROVIDERS = {
    "Remotive": lambda _keyword: _fetch_remotive_source(),
    "Jobicy": lambda keyword: _get_jobicy_jobs(keyword),
}


def _safe_https_url(value):
    if not isinstance(value, str) or not value.strip():
        return ""
    try:
        parsed = urlparse(value.strip())
    except ValueError:
        return ""
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        return ""
    return value.strip()[:2048]


def _get_company_board_configs():
    raw = os.environ.get("COMPANY_JOB_BOARDS_JSON", "").strip()
    if not raw:
        return []
    try:
        configured = json.loads(raw)
    except json.JSONDecodeError as error:
        logging.getLogger(__name__).error(
            "Company job board configuration is invalid JSON: exception_type=%s",
            _safe_exception_type(error),
        )
        return []
    if not isinstance(configured, dict):
        logging.getLogger(__name__).error("Company job board configuration must be a JSON object.")
        return []

    configs = []
    seen_companies = set()
    for requested_name, details in configured.items():
        if not isinstance(requested_name, str) or not requested_name.strip() or not isinstance(details, dict):
            continue
        normalized_name = _normalize_company_name(requested_name)
        if not normalized_name or normalized_name in seen_companies:
            continue
        boards = details.get("boards", {})
        if not isinstance(boards, dict):
            boards = {}
        valid_boards = {
            provider: board.strip()
            for provider in ("greenhouse", "lever", "ashby")
            for board in [boards.get(provider)]
            if isinstance(board, str) and re.fullmatch(r"[A-Za-z0-9_-]{1,120}", board.strip())
        }
        careers_url = _safe_https_url(details.get("careersUrl"))
        website = _safe_https_url(details.get("website"))
        config = {
            "key": requested_name,
            "company": str(details.get("officialName", requested_name)).strip()[:200],
            "normalizedName": normalized_name,
            "website": website,
            "careersUrl": careers_url,
            "description": details.get("description", "").strip()[:2000]
            if isinstance(details.get("description"), str) else "",
            "industry": details.get("industry", "").strip()[:200]
            if isinstance(details.get("industry"), str) else "",
            "headquarters": details.get("headquarters", "").strip()[:200]
            if isinstance(details.get("headquarters"), str) else "",
            "officeLocations": [
                location.strip()[:200]
                for location in details.get("officeLocations", [])[:30]
                if isinstance(location, str) and location.strip()
            ] if isinstance(details.get("officeLocations"), list) else [],
            "verifiedAt": details.get("verifiedAt", "").strip()[:40]
            if isinstance(details.get("verifiedAt"), str) else "",
            "boards": valid_boards,
        }
        configs.append(config)
        seen_companies.add(normalized_name)
    return configs


def _provider_json(url, source, max_response_bytes=REMOTIVE_MAX_RESPONSE_BYTES):
    request = URLRequest(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "CareerScout-AI/1.0 (job discovery)",
        },
    )
    try:
        with urlopen(request, timeout=COMPANY_BOARD_TIMEOUT_SECONDS) as response:
            body = response.read(max_response_bytes + 1)
    except (HTTPError, URLError, TimeoutError, OSError) as error:
        logging.getLogger(__name__).warning(
            "%s job source failed: exception_type=%s",
            source,
            _safe_exception_type(error),
        )
        raise ValueError(f"{source} is temporarily unavailable.") from error
    if len(body) > max_response_bytes:
        raise ValueError(f"{source} returned an oversized response.")
    try:
        return json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise ValueError(f"{source} returned invalid JSON.") from error


def _normalize_company_board_job(provider, item, company):
    if not isinstance(item, dict):
        return None

    if provider == "greenhouse":
        title = item.get("title")
        location_data = item.get("location")
        location = location_data.get("name", "") if isinstance(location_data, dict) else ""
        url = item.get("absolute_url")
        description = item.get("content")
        published = item.get("updated_at")
        department = item.get("departments")
        category = ", ".join(
            value.get("name", "").strip()
            for value in department
            if isinstance(value, dict) and isinstance(value.get("name"), str) and value.get("name").strip()
        ) if isinstance(department, list) else ""
        job_id = item.get("id")
        employment = ""
        work_mode = ""
        salary = ""
    elif provider == "lever":
        categories = item.get("categories") if isinstance(item.get("categories"), dict) else {}
        title = item.get("text")
        location = categories.get("location", "") if isinstance(categories.get("location"), str) else ""
        url = item.get("hostedUrl")
        description = item.get("descriptionPlain") or item.get("description")
        published = item.get("createdAt")
        category = categories.get("team", "") if isinstance(categories.get("team"), str) else ""
        job_id = item.get("id")
        employment = categories.get("commitment", "") if isinstance(categories.get("commitment"), str) else ""
        work_mode = item.get("workplaceType", "") if isinstance(item.get("workplaceType"), str) else ""
        salary = ""
    else:
        title = item.get("title")
        location = item.get("location", "") if isinstance(item.get("location"), str) else ""
        url = item.get("jobUrl")
        description = item.get("descriptionPlain") or item.get("description")
        published = item.get("publishedAt")
        category = item.get("department", "") if isinstance(item.get("department"), str) else ""
        job_id = item.get("id")
        employment = item.get("employmentType", "") if isinstance(item.get("employmentType"), str) else ""
        work_mode = item.get("workplaceType", "") if isinstance(item.get("workplaceType"), str) else ""
        compensation = item.get("compensation") if isinstance(item.get("compensation"), dict) else {}
        salary = compensation.get("compensationTierSummary", "") if isinstance(
            compensation.get("compensationTierSummary"), str
        ) else ""

    if not isinstance(title, str) or not title.strip() or not isinstance(url, str):
        return None
    try:
        parsed_url = urlparse(url.strip())
    except ValueError:
        return None
    allowed_hosts = {
        "greenhouse": {"boards.greenhouse.io", "job-boards.greenhouse.io"},
        "lever": {"jobs.lever.co", "jobs.eu.lever.co"},
        "ashby": {"jobs.ashbyhq.com"},
    }[provider]
    if parsed_url.scheme != "https" or (parsed_url.hostname or "").lower() not in allowed_hosts:
        return None

    def safe_text(value, length=200):
        return value.strip()[:length] if isinstance(value, str) else ""

    source = {"greenhouse": "Greenhouse", "lever": "Lever", "ashby": "Ashby"}[provider]
    work_mode = safe_text(work_mode, 50)
    normalized_mode = work_mode.casefold()
    is_remote = True if "remote" in normalized_mode else (
        False if normalized_mode in {"onsite", "on-site", "in person", "in-person"} else None
    )
    return {
        "id": f"{provider}:{str(job_id)[:100]}" if job_id is not None else "",
        "title": title.strip()[:200],
        "company": company["company"],
        "location": safe_text(location, 300),
        "employmentType": safe_text(employment, 100),
        "experienceLevel": "",
        "workMode": work_mode,
        "salary": safe_text(salary, 200),
        "skills": [],
        "description": _plain_job_description(description),
        "publicationDate": safe_text(published, 40),
        "url": url.strip()[:2048],
        "category": safe_text(category, 200),
        "isRemote": is_remote,
        "source": source,
        "sourceType": "official_company_board",
        "sourceLabel": f"Official {source} company board",
    }


def _fetch_company_board(provider, board, company):
    cache_key = f"{provider}:{board.casefold()}"
    now = time.monotonic()
    with _company_board_cache_lock:
        cached = _company_board_cache.get(cache_key)
        if cached and now < cached["expires_at"]:
            return cached["jobs"], cached["fetched_at"], True

    encoded_board = quote(board, safe="")
    if provider == "greenhouse":
        url = f"https://boards-api.greenhouse.io/v1/boards/{encoded_board}/jobs?content=true"
    elif provider == "lever":
        url = f"https://api.lever.co/v0/postings/{encoded_board}?mode=json"
    else:
        url = f"https://api.ashbyhq.com/posting-api/job-board/{encoded_board}?includeCompensation=true"
    payload = _provider_json(url, provider.title())
    if provider == "greenhouse":
        records = payload.get("jobs") if isinstance(payload, dict) else None
    elif provider == "lever":
        records = payload
    else:
        records = payload.get("jobs") if isinstance(payload, dict) else None
    if not isinstance(records, list):
        raise ValueError(f"{provider.title()} returned an invalid job-board response.")

    jobs = [
        job
        for job in (_normalize_company_board_job(provider, item, company) for item in records[:COMPANY_BOARD_MAX_RESULTS])
        if job is not None
    ]
    fetched_at = datetime.now(timezone.utc).isoformat()
    with _company_board_cache_lock:
        _company_board_cache[cache_key] = {
            "jobs": jobs,
            "fetched_at": fetched_at,
            "expires_at": time.monotonic() + COMPANY_BOARD_CACHE_SECONDS,
        }
    return jobs, fetched_at, False


def _fetch_board_config(config):
    jobs = []
    fetched_at = ""
    cached = True
    errors = []
    for provider, board in config["boards"].items():
        try:
            provider_jobs, provider_fetched_at, provider_cached = _fetch_company_board(provider, board, config)
            jobs.extend(provider_jobs)
            fetched_at = max(fetched_at, provider_fetched_at)
            cached = cached and provider_cached
        except (ValueError, HTTPException) as error:
            errors.append(str(error))
    return jobs, fetched_at, cached, errors


def _listing_identity(listing):
    parsed = urlparse(listing.get("url", ""))
    host = (parsed.hostname or "").lower()
    path = re.sub(r"/+", "/", parsed.path).rstrip("/").casefold()
    if host and path:
        return "url", host, path
    provider_id = str(listing.get("id", "")).strip().casefold()
    if provider_id:
        return "id", str(listing.get("source", "")).casefold(), provider_id
    return (
        _normalize_company_name(listing.get("company", "")),
        _normalize_company_name(listing.get("title", "")),
        _normalize_company_name(listing.get("location", "")),
    )


def _deduplicate_provider_jobs(jobs):
    unique = []
    seen = set()
    for job in jobs:
        url_identity = _listing_identity(job)
        id_identity = (
            "id",
            str(job.get("source", "")).casefold(),
            str(job.get("id", "")).strip().casefold(),
        ) if str(job.get("id", "")).strip() else None
        if url_identity in seen or (id_identity and id_identity in seen):
            continue
        seen.add(url_identity)
        if id_identity:
            seen.add(id_identity)
        unique.append(job)
    return unique


def _matches_job_text(listing, terms):
    text = _normalize_company_name(f"{listing.get('title', '')} {listing.get('description', '')}")
    return all(term in text for term in terms)


def _matches_any_role_term(listing, terms):
    if not terms:
        return True
    title = _normalize_company_name(listing.get("title", ""))
    return any(_normalize_company_name(term) in title for term in terms)


def _known_experience_level(listing):
    explicit = _normalize_company_name(listing.get("experienceLevel", ""))
    title = _normalize_company_name(listing.get("title", ""))
    employment = _normalize_company_name(listing.get("employmentType", ""))
    if re.search(r"\b(intern|internship)\b", f"{explicit} {employment} {title}"):
        return "internship"
    if explicit in {"fresher", "graduate", "new graduate", "entry level", "junior", "apprentice"}:
        return "entry level"
    if explicit in {"experienced", "senior", "mid level", "mid senior", "professional"}:
        return "experienced"
    if re.search(
        r"\b(fresher|graduate|new grad|graduate trainee|junior|associate|entry level|apprentice)\b",
        title,
    ):
        return "entry level"
    if re.search(r"\b(senior|principal|staff engineer|lead engineer|manager|experienced)\b", title):
        return "experienced"
    return ""


def _matches_experience_filter(listing, experience):
    selected = _normalize_company_name(experience)
    known = _known_experience_level(listing)
    if not selected or selected in {"any experience", "all opportunities"}:
        return True
    if selected in {"internship", "internships"}:
        return known in {"internship", ""}
    if selected in {"fresher", "freshers graduates", "graduate", "graduates", "entry level", "entry level jobs"}:
        return known in {"entry level", ""}
    if selected in {"experienced", "experienced jobs"}:
        return known in {"experienced", ""}
    return known in {"", selected}


def _classify_location_match(listing, requested_location):
    if not requested_location.strip():
        return ""
    location = _normalize_company_name(listing.get("location", ""))
    requested = _normalize_company_name(requested_location)
    location_terms = [term for term in requested.split() if term]
    if location_terms and all(term in location for term in location_terms):
        return "local"
    is_remote = listing.get("isRemote") is True
    if is_remote and re.search(
        r"\b(worldwide|anywhere|global|from anywhere|anywhere in the world)\b",
        location,
    ):
        return "remote-global"
    if is_remote and location in {"", "remote"}:
        return "remote-unspecified"
    return ""


def _filter_provider_jobs(jobs, *, query, role_terms, company, location, work_mode, employment, experience):
    query_terms = [_normalize_company_name(term) for term in query.split() if _normalize_company_name(term)]
    normalized_company = _normalize_company_name(company)
    location_terms = [_normalize_company_name(term) for term in location.split() if _normalize_company_name(term)]
    requested_mode = _normalize_company_name(work_mode)
    requested_employment = _normalize_company_name(employment)
    selected_experience = _normalize_company_name(experience)
    filtered = []
    for job in jobs:
        if query_terms and not _matches_job_text(job, query_terms):
            continue
        if role_terms and not _matches_any_role_term(job, role_terms):
            continue
        if normalized_company and normalized_company not in _normalize_company_name(job.get("company", "")):
            continue
        if location_terms and not _classify_location_match(job, location):
            continue
        known_mode = _normalize_company_name(job.get("workMode", ""))
        if requested_mode and known_mode and requested_mode not in known_mode:
            continue
        known_employment = _normalize_company_name(job.get("employmentType", ""))
        if requested_employment and known_employment and requested_employment not in known_employment:
            continue
        if selected_experience and not _matches_experience_filter(job, experience):
            continue
        filtered.append(job)
    return filtered


_VERIFIED_COMPANY_CAREERS = {
    "google": {
        "officialName": "Google",
        "website": "https://about.google/",
        "careersUrl": "https://www.google.com/about/careers/applications/",
    },
    "microsoft": {
        "officialName": "Microsoft",
        "website": "https://www.microsoft.com/",
        "careersUrl": "https://careers.microsoft.com/v2/global/en/home.html",
    },
    "amazon": {
        "officialName": "Amazon",
        "website": "https://www.amazon.com/",
        "careersUrl": "https://www.amazon.jobs/en/",
    },
    "infosys": {
        "officialName": "Infosys",
        "website": "https://www.infosys.com/",
        "careersUrl": "https://www.infosys.com/careers.html",
    },
    "tcs": {
        "officialName": "Tata Consultancy Services",
        "website": "https://www.tcs.com/",
        "careersUrl": "https://www.tcs.com/careers",
    },
}


def _registered_company_profile(requested_name):
    normalized_name = _normalize_company_name(requested_name)
    aliases = {
        "google llc": "google",
        "microsoft corporation": "microsoft",
        "amazon com": "amazon",
        "tata consultancy services": "tcs",
        "tata consultancy services limited": "tcs",
    }
    registry_key = aliases.get(normalized_name, normalized_name)
    registered = _VERIFIED_COMPANY_CAREERS.get(registry_key)
    if not registered:
        return None
    return {
        "name": requested_name.strip(),
        "officialName": registered["officialName"],
        "website": registered["website"],
        "description": "",
        "industry": "",
        "headquarters": "",
        "officeLocations": [],
        "careersUrl": registered["careersUrl"],
        "detailsSource": "Verified official careers-link registry",
        "verifiedAt": "",
    }


def _company_profile(config, requested_name):
    if not config:
        return {
            "name": requested_name.strip(),
            "officialName": "",
            "website": "",
            "description": "",
            "industry": "",
            "headquarters": "",
            "officeLocations": [],
            "careersUrl": "",
            "detailsSource": "",
            "verifiedAt": "",
        }
    registered = _registered_company_profile(requested_name) or {}
    return {
        "name": requested_name.strip(),
        "officialName": config["company"] or registered.get("officialName", ""),
        "website": config["website"] or registered.get("website", ""),
        "description": config["description"],
        "industry": config["industry"],
        "headquarters": config["headquarters"],
        "officeLocations": config["officeLocations"],
        "careersUrl": config["careersUrl"] or registered.get("careersUrl", ""),
        "detailsSource": "CareerScout administrator configuration" if config["description"] or config["industry"]
        or config["headquarters"] or config["officeLocations"] else registered.get("detailsSource", ""),
        "verifiedAt": config["verifiedAt"] or registered.get("verifiedAt", ""),
    }


_SAFE_EXCEPTION_TYPES = {
    "CertificateFetchError",
    "ConnectionError",
    "DefaultCredentialsError",
    "DeadlineExceededError",
    "ExpiredIdTokenError",
    "InvalidIdTokenError",
    "InvalidValue",
    "MalformedError",
    "RevokedIdTokenError",
    "TimeoutError",
    "TransportError",
    "TypeError",
    "UnavailableError",
    "ValueError",
}


def _safe_exception_type(error):
    if error is None:
        return "None"
    name = type(error).__name__
    if name in _SAFE_EXCEPTION_TYPES:
        return name
    if len(name) <= 64 and name.isascii() and name.isidentifier():
        return name
    return "OtherError"


def _exception_chain(error, max_types=6):
    chain = []
    pending = [error]
    seen = set()
    while pending and len(chain) < max_types:
        current = pending.pop(0)
        if not isinstance(current, BaseException) or id(current) in seen:
            continue
        seen.add(id(current))
        chain.append(current)
        pending.extend(
            related
            for related in (
                getattr(current, "cause", None),
                current.__cause__,
                current.__context__,
            )
            if isinstance(related, BaseException) and id(related) not in seen
        )
    return chain


def _safe_exception_chain(error):
    return ">".join(_safe_exception_type(item) for item in _exception_chain(error)) or "None"


def _verification_failure_category(error):
    if isinstance(error, (firebase_auth.UserDisabledError, firebase_auth.UserNotFoundError)):
        return "firebase-user-lookup-failure"
    if isinstance(error, firebase_auth.CertificateFetchError):
        return "certificate-fetch-failure"
    if isinstance(
        error,
        (
            google_auth_exceptions.TransportError,
            google_auth_exceptions.TimeoutError,
            TimeoutError,
            ConnectionError,
            socket.gaierror,
        ),
    ) or isinstance(error, (firebase_exceptions.UnavailableError, firebase_exceptions.DeadlineExceededError)):
        return "network-or-dns-failure"
    if isinstance(error, firebase_exceptions.ResourceExhaustedError):
        return "firebase-quota-or-rate-limit"
    if isinstance(error, firebase_exceptions.PermissionDeniedError):
        return "firebase-admin-permission-or-quota-failure"
    if isinstance(
        error,
        (
            google_auth_exceptions.DefaultCredentialsError,
            google_auth_exceptions.RefreshError,
            google_auth_exceptions.UserAccessTokenError,
            google_auth_exceptions.OAuthError,
        ),
    ):
        return "google-credentials-or-quota-failure"
    if isinstance(error, firebase_exceptions.FirebaseError):
        return "firebase-admin-service-failure"
    return "unexpected-verification-failure"


def _classify_token_verification_error(error):
    chain = _exception_chain(error)
    reason = " ".join(str(item) for item in chain).lower()

    if "token expired" in reason:
        return (
            "expired-token",
            "firebase-token-expired",
            "The Firebase sign-in token has expired.",
        )
    if "audience" in reason or '"aud"' in reason:
        return (
            "project-mismatch",
            "firebase-token-project-mismatch",
            "The Firebase sign-in token belongs to a different Firebase project.",
        )
    if "issuer" in reason or '"iss"' in reason:
        return (
            "issuer-mismatch",
            "firebase-token-issuer-mismatch",
            "The Firebase sign-in token issuer does not match this backend project.",
        )
    if "signature" in reason:
        return (
            "signature-invalid",
            "firebase-token-signature-invalid",
            "Firebase could not validate the sign-in token signature.",
        )
    if (
        any(
            isinstance(
                item,
                (google_auth_exceptions.MalformedError, google_auth_exceptions.InvalidType),
            )
            for item in chain
        )
        or any(
            marker in reason
            for marker in (
                "malformed",
                "not enough segments",
                "invalid header",
                "invalid payload",
                'no "kid" claim',
                "incorrect algorithm",
                'no "sub" claim',
                'empty string "sub"',
            )
        )
    ):
        return (
            "malformed-token",
            "firebase-token-invalid",
            "Firebase could not verify this sign-in token.",
        )
    if isinstance(error, firebase_auth.InvalidIdTokenError):
        return (
            "invalid-token",
            "firebase-token-invalid",
            "Firebase could not verify this sign-in token.",
        )
    return (
        "unknown-verification-failure",
        "firebase-token-invalid",
        "Firebase could not verify this sign-in token.",
    )


def get_firebase_admin_app():
    project_id = os.environ.get("FIREBASE_PROJECT_ID", "").strip()
    if not project_id:
        logging.getLogger(__name__).error(
            "Firebase Admin unavailable: category=admin-credentials"
        )
        raise HTTPException(
            status_code=503,
            detail={"code": "firebase-admin-not-configured", "message": "Firebase server authentication is not configured."},
        )

    try:
        admin_app = firebase_admin.get_app()
    except ValueError:
        try:
            admin_app = firebase_admin.initialize_app(options={"projectId": project_id})
        except Exception as error:
            category = _verification_failure_category(error)
            if category == "unexpected-verification-failure":
                category = "admin-initialization-failure"
            logging.getLogger(__name__).error(
                "Firebase Admin initialization failed: category=%s; exception_type=%s; exception_chain=%s",
                category,
                _safe_exception_type(error),
                _safe_exception_chain(error),
            )
            raise HTTPException(
                status_code=503,
                detail={"code": "firebase-admin-not-configured", "message": "Firebase server authentication is not configured."},
            ) from error

    if admin_app.project_id != project_id:
        logging.getLogger(__name__).error(
            "Firebase Admin project mismatch: category=admin-project-mismatch"
        )
        raise HTTPException(
            status_code=503,
            detail={
                "code": "firebase-project-mismatch",
                "message": "Firebase authentication is configured for a different project.",
            },
        )
    return admin_app


def require_firebase_user(
    request: FastAPIRequest,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    if credentials is None or credentials.scheme.lower() != "bearer":
        logging.getLogger(__name__).warning(
            "Firebase auth rejected request: category=missing-bearer"
        )
        raise HTTPException(
            status_code=401,
            detail={"code": "firebase-sign-in-required", "message": "A Firebase sign-in token is required."},
        )

    admin_app = get_firebase_admin_app()
    try:
        decoded_token = firebase_auth.verify_id_token(
            credentials.credentials,
            app=admin_app,
            check_revoked=False,
        )
    except firebase_auth.ExpiredIdTokenError as error:
        logging.getLogger(__name__).warning(
            "Firebase auth rejected request: category=expired-token; exception_type=%s; exception_chain=%s",
            _safe_exception_type(error),
            _safe_exception_chain(error),
        )
        raise HTTPException(
            status_code=401,
            detail={"code": "firebase-token-expired", "message": "The Firebase sign-in token has expired."},
        ) from error
    except firebase_auth.RevokedIdTokenError as error:
        logging.getLogger(__name__).warning(
            "Firebase auth rejected request: category=revoked-token; exception_type=%s; exception_chain=%s",
            _safe_exception_type(error),
            _safe_exception_chain(error),
        )
        raise HTTPException(
            status_code=401,
            detail={"code": "firebase-token-revoked", "message": "This Firebase sign-in is no longer valid."},
        ) from error
    except firebase_auth.InvalidIdTokenError as error:
        category, error_code, user_message = _classify_token_verification_error(error)
        logging.getLogger(__name__).warning(
            "Firebase auth rejected request: category=%s; exception_type=%s; exception_chain=%s",
            category,
            _safe_exception_type(error),
            _safe_exception_chain(error),
        )
        raise HTTPException(
            status_code=401,
            detail={"code": error_code, "message": user_message},
        ) from error
    except (
        google_auth_exceptions.MalformedError,
        google_auth_exceptions.InvalidValue,
        google_auth_exceptions.InvalidType,
    ) as error:
        category, error_code, user_message = _classify_token_verification_error(error)
        logging.getLogger(__name__).warning(
            "Firebase auth rejected request: category=%s; exception_type=%s; exception_chain=%s",
            category,
            _safe_exception_type(error),
            _safe_exception_chain(error),
        )
        raise HTTPException(
            status_code=401,
            detail={"code": error_code, "message": user_message},
        ) from error
    except DefaultCredentialsError as error:
        logging.getLogger(__name__).error(
            "Firebase token verification unavailable: category=google-credentials-or-quota-failure; exception_type=%s; exception_chain=%s",
            _safe_exception_type(error),
            _safe_exception_chain(error),
        )
        raise HTTPException(
            status_code=503,
            detail={
                "code": "firebase-admin-credentials-missing",
                "message": "Firebase server credentials are not configured. Set up Application Default Credentials for the backend and restart it.",
            },
        ) from error
    except firebase_auth.CertificateFetchError as error:
        logging.getLogger(__name__).error(
            "Firebase token verification unavailable: category=certificate-fetch-failure; exception_type=%s; exception_chain=%s",
            _safe_exception_type(error),
            _safe_exception_chain(error),
        )
        raise HTTPException(
            status_code=503,
            detail={"code": "firebase-verification-unavailable", "message": "Firebase token verification is temporarily unavailable."},
        ) from error
    except (
        google_auth_exceptions.TransportError,
        google_auth_exceptions.TimeoutError,
        TimeoutError,
        ConnectionError,
        socket.gaierror,
    ) as error:
        logging.getLogger(__name__).error(
            "Firebase token verification unavailable: category=network-or-dns-failure; exception_type=%s; exception_chain=%s",
            _safe_exception_type(error),
            _safe_exception_chain(error),
        )
        raise HTTPException(
            status_code=503,
            detail={"code": "firebase-verification-unavailable", "message": "Firebase token verification is temporarily unavailable."},
        ) from error
    except (ValueError, TypeError) as error:
        logging.getLogger(__name__).warning(
            "Firebase auth rejected request: category=malformed-token; exception_type=%s; exception_chain=%s",
            _safe_exception_type(error),
            _safe_exception_chain(error),
        )
        raise HTTPException(
            status_code=401,
            detail={"code": "firebase-token-invalid", "message": "Firebase could not verify this sign-in token."},
        ) from error
    except firebase_auth.UserDisabledError as error:
        logging.getLogger(__name__).warning(
            "Firebase auth rejected request: category=firebase-user-disabled; exception_type=%s; exception_chain=%s",
            _safe_exception_type(error),
            _safe_exception_chain(error),
        )
        raise HTTPException(
            status_code=401,
            detail={"code": "firebase-token-invalid", "message": "This Firebase account cannot access the requested resource."},
        ) from error
    except firebase_auth.UserNotFoundError as error:
        logging.getLogger(__name__).warning(
            "Firebase auth rejected request: category=firebase-user-not-found; exception_type=%s; exception_chain=%s",
            _safe_exception_type(error),
            _safe_exception_chain(error),
        )
        raise HTTPException(
            status_code=401,
            detail={"code": "firebase-token-invalid", "message": "Firebase could not verify this sign-in token."},
        ) from error
    except firebase_exceptions.ResourceExhaustedError as error:
        logging.getLogger(__name__).error(
            "Firebase token verification unavailable: category=firebase-quota-or-rate-limit; exception_type=%s; exception_chain=%s",
            _safe_exception_type(error),
            _safe_exception_chain(error),
        )
        raise HTTPException(
            status_code=503,
            detail={"code": "firebase-verification-unavailable", "message": "Firebase token verification is temporarily unavailable."},
        ) from error
    except firebase_exceptions.PermissionDeniedError as error:
        logging.getLogger(__name__).error(
            "Firebase token verification unavailable: category=firebase-admin-permission-or-quota-failure; exception_type=%s; exception_chain=%s",
            _safe_exception_type(error),
            _safe_exception_chain(error),
        )
        raise HTTPException(
            status_code=503,
            detail={"code": "firebase-verification-unavailable", "message": "Firebase token verification is temporarily unavailable."},
        ) from error
    except firebase_exceptions.FirebaseError as error:
        category = _verification_failure_category(error)
        logging.getLogger(__name__).error(
            "Firebase token verification failed: category=%s; exception_type=%s; exception_chain=%s",
            category,
            _safe_exception_type(error),
            _safe_exception_chain(error),
        )
        raise HTTPException(
            status_code=503,
            detail={"code": "firebase-verification-unavailable", "message": "Firebase token verification is temporarily unavailable."},
        ) from error
    except Exception as error:
        category = _verification_failure_category(error)
        logging.getLogger(__name__).error(
            "Firebase token verification failed: category=%s; exception_type=%s; exception_chain=%s",
            category,
            _safe_exception_type(error),
            _safe_exception_chain(error),
        )
        raise HTTPException(
            status_code=503,
            detail={"code": "firebase-verification-unavailable", "message": "Firebase token verification is temporarily unavailable."},
        ) from error

    user_id = decoded_token.get("uid")
    if not user_id:
        logging.getLogger(__name__).warning(
            "Firebase auth rejected request: category=invalid-token"
        )
        raise HTTPException(
            status_code=401,
            detail={"code": "firebase-token-invalid", "message": "Firebase could not verify this sign-in token."},
        )
    firebase_claims = decoded_token.get("firebase", {})
    if decoded_token.get("email_verified") is not True and firebase_claims.get("sign_in_provider") != "google.com":
        raise HTTPException(status_code=403, detail="Verify your email before requesting learning resources.")
    return user_id


@app.get("/")
def read_root():
    return {"message": "Welcome to the CareerScout AI API!"}


@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "CareerScout AI API is running."}


@app.get("/api/job-discovery")
def get_job_discovery(
    query: str | None = Query(default=None, max_length=100),
    category: str | None = Query(default=None, max_length=100),
    role_terms: list[str] | None = Query(default=None, alias="roleTerms", max_length=12),
    company: str | None = Query(default=None, max_length=120),
    location: str | None = Query(default=None, max_length=120),
    work_mode: str | None = Query(default=None, alias="workMode", max_length=30),
    employment_type: str | None = Query(default=None, alias="employmentType", max_length=50),
    experience: str | None = Query(default=None, max_length=50),
    mode: str = Query(default="jobs", pattern="^(jobs|company)$"),
    remote_only: bool = Query(default=False, alias="remoteOnly"),
    limit: int = Query(default=100, ge=1, le=JOB_DISCOVERY_MAX_RESULTS),
):
    selected_role_terms = []
    for term in role_terms or []:
        normalized_term = term.strip()
        if len(normalized_term) > 100:
            raise HTTPException(status_code=422, detail="Job role search terms must be 100 characters or fewer.")
        if normalized_term and _normalize_company_name(normalized_term) not in {
            _normalize_company_name(value) for value in selected_role_terms
        }:
            selected_role_terms.append(normalized_term)
    if len(selected_role_terms) > 12:
        raise HTTPException(status_code=422, detail="Choose one job role at a time.")

    requested_company = (company or "").strip()
    configured_companies = _get_company_board_configs()
    selected_company_config = next(
        (
            item for item in configured_companies
            if _normalize_company_name(item["key"]) == _normalize_company_name(requested_company)
            or _normalize_company_name(item["company"]) == _normalize_company_name(requested_company)
        ),
        None,
    ) if requested_company else None
    board_configs = configured_companies
    if mode == "company":
        board_configs = [selected_company_config] if selected_company_config else []
    truncated_board_list = len(board_configs) > COMPANY_BOARD_MAX_CONFIGS
    board_configs = board_configs[:COMPANY_BOARD_MAX_CONFIGS]

    provider_status = []
    provider_errors = []
    provider_jobs = []
    provider_fetched_at = []
    provider_cache_flags = []
    tasks = {}
    with ThreadPoolExecutor(max_workers=7) as executor:
        for provider_name, adapter in JOB_DISCOVERY_PROVIDERS.items():
            tasks[executor.submit(adapter, (query or "").strip())] = (provider_name, None)
        for config in board_configs:
            for provider in config["boards"]:
                label = {
                    "greenhouse": "Greenhouse",
                    "lever": "Lever",
                    "ashby": "Ashby",
                }[provider]
                tasks[executor.submit(
                    _fetch_company_board,
                    provider,
                    config["boards"][provider],
                    config,
                )] = (label, config)

        for future in as_completed(tasks):
            provider_name, config = tasks[future]
            try:
                result = future.result()
                jobs, fetched_at, cached = result[:3]
                warnings = result[3] if len(result) > 3 else []
                provider_jobs.extend(jobs)
                if fetched_at:
                    provider_fetched_at.append(fetched_at)
                provider_cache_flags.append(cached)
                provider_status.append({
                    "name": provider_name,
                    "status": "partial" if warnings else "ok" if jobs else "empty",
                    "listingCount": len(jobs),
                })
                provider_errors.extend(warnings)
            except Exception as error:
                if isinstance(error, HTTPException):
                    message = error.detail
                elif isinstance(error, ValueError):
                    message = str(error)
                else:
                    logging.getLogger(__name__).warning(
                        "%s job source failed: exception_type=%s",
                        provider_name,
                        _safe_exception_type(error),
                    )
                    message = f"{provider_name} job listings are temporarily unavailable."
                provider_status.append({"name": provider_name, "status": "error"})
                provider_errors.append(message)

    if truncated_board_list:
        provider_errors.append(
            f"Only the first {COMPANY_BOARD_MAX_CONFIGS} configured company boards were searched."
        )

    if not provider_status or all(item["status"] == "error" for item in provider_status):
        raise HTTPException(
            status_code=503,
            detail={
                "message": "Configured job sources are temporarily unavailable. Please retry.",
                "providerStatus": provider_status,
                "providerErrors": provider_errors,
            },
        )

    all_jobs = _deduplicate_provider_jobs(provider_jobs)
    filtered_jobs = _filter_provider_jobs(
        all_jobs,
        query=(query or "").strip(),
        role_terms=selected_role_terms,
        company=requested_company if mode == "company" else "",
        location=(location or "").strip(),
        work_mode=(work_mode or "").strip(),
        employment=(employment_type or "").strip(),
        experience=(experience or "").strip(),
    )
    if remote_only:
        filtered_jobs = [job for job in filtered_jobs if job.get("isRemote") is not False]
    filtered_jobs = [dict(job) for job in filtered_jobs]
    if location and location.strip():
        for job in filtered_jobs:
            job["locationMatch"] = _classify_location_match(job, location)
            job["experienceClassification"] = _known_experience_level(job) or "not stated"
    else:
        for job in filtered_jobs:
            job["experienceClassification"] = _known_experience_level(job) or "not stated"
    returned_jobs = filtered_jobs[:limit]
    grouped_provider_status = {}
    for status in provider_status:
        name = status["name"]
        if name not in grouped_provider_status:
            grouped_provider_status[name] = {
                "name": name,
                "status": status["status"],
                "listingCount": status.get("listingCount", 0),
            }
            continue
        summary = grouped_provider_status[name]
        summary["listingCount"] += status.get("listingCount", 0)
        if summary["status"] != status["status"]:
            summary["status"] = "partial"
    provider_status = list(grouped_provider_status.values())
    for status in provider_status:
        status["matchedCount"] = sum(
            1 for job in returned_jobs if job.get("source") == status["name"]
        )

    fetched_at = max(provider_fetched_at, default="")
    successful_sources = list(dict.fromkeys(
        item["name"] for item in provider_status
        if item["status"] in {"ok", "empty", "partial"}
    ))
    cached = bool(provider_cache_flags) and all(provider_cache_flags)
    company_matches = [
        item for item in configured_companies
        if _normalize_company_name(item["key"]) == _normalize_company_name(requested_company)
        or _normalize_company_name(item["company"]) == _normalize_company_name(requested_company)
    ] if requested_company else []
    company_config = company_matches[0] if company_matches else None
    registered_company_profile = (
        _registered_company_profile(requested_company) if mode == "company" else None
    )
    company_profile = (
        _company_profile(company_config, requested_company)
        if mode == "company" and company_config
        else registered_company_profile
        if mode == "company"
        else None
    )
    if mode == "company" and company_profile is None:
        company_profile = _company_profile(None, requested_company)
    if mode == "company":
        has_board = bool(company_config and company_config["boards"])
        company_state = "configured" if has_board else (
            "profile_configured" if company_config else
            "careers_link_available" if registered_company_profile else "not_configured"
        )
    else:
        company_state = ""

    return {
        "jobs": returned_jobs,
        "fetchedAt": fetched_at,
        "cached": cached,
        "source": ", ".join(successful_sources),
        "sources": successful_sources,
        "providerStatus": provider_status,
        "providerErrors": provider_errors,
        "partial": bool(provider_errors and successful_sources),
        "totalRetrieved": len(returned_jobs),
        "company": company_profile,
        "companyStatus": company_state,
        "configuredCompanyBoards": sorted(company_config["boards"].keys()) if company_config else [],
        "officialListings": sum(
            1 for job in filtered_jobs if job.get("sourceType") == "official_company_board"
        ),
        "aggregatorListings": sum(
            1 for job in filtered_jobs if job.get("sourceType") == "aggregator"
        ),
    }


@app.get("/api/learning-resources")
def get_learning_resources(
    skill: str = Query(min_length=1, max_length=120),
    language: str = Query(min_length=2, max_length=2),
    page_token: str | None = Query(default=None, alias="pageToken"),
    _user_id: str = Depends(require_firebase_user),
):
    language_code = language.strip().lower()
    language_name = YOUTUBE_LANGUAGES.get(language_code)
    if not language_name:
        raise HTTPException(status_code=422, detail="Unsupported learning language.")

    api_key = os.environ.get("YOUTUBE_API_KEY", "").strip()
    if not api_key:
        logging.getLogger(__name__).error(
            "YouTube learning resources unavailable: YOUTUBE_API_KEY is missing or empty in this backend process."
        )
        raise HTTPException(status_code=503, detail="YouTube learning resources are not configured.")

    query_parameters = urlencode({
        "key": api_key,
        "part": "snippet",
        "q": f"{skill.strip()} tutorial {language_name}",
        "type": "video",
        "maxResults": 10,
        "safeSearch": "moderate",
        "videoEmbeddable": "true",
        "relevanceLanguage": language_code,
        "regionCode": "IN",
        **({"pageToken": page_token} if page_token else {}),
    })
    request = URLRequest(
        f"https://www.googleapis.com/youtube/v3/search?{query_parameters}",
        headers={"Accept": "application/json"},
    )

    try:
        with urlopen(request, timeout=10) as response:
            payload = json.loads(response.read())
    except HTTPError as error:
        status_code = 429 if error.code == 429 else 502
        raise HTTPException(
            status_code=status_code,
            detail="YouTube learning resources could not be loaded. Check the YouTube API configuration and quota.",
        ) from error
    except (URLError, TimeoutError, json.JSONDecodeError) as error:
        raise HTTPException(
            status_code=502,
            detail="YouTube learning resources are temporarily unavailable.",
        ) from error

    videos = []
    for item in payload.get("items", [])[:10]:
        snippet = item.get("snippet", {})
        video_id = item.get("id", {}).get("videoId")
        if not video_id or not snippet.get("title") or not snippet.get("channelTitle"):
            continue
        thumbnails = snippet.get("thumbnails", {})
        thumbnail = (
            thumbnails.get("high", {}).get("url")
            or thumbnails.get("medium", {}).get("url")
            or thumbnails.get("default", {}).get("url")
        )
        videos.append({
            "videoId": video_id,
            "title": snippet["title"],
            "channelName": snippet["channelTitle"],
            "thumbnailUrl": thumbnail,
            "videoUrl": f"https://www.youtube.com/watch?v={quote(video_id, safe='')}",
        })

    next_page_token = payload.get("nextPageToken")
    return {
        "videos": videos,
        "nextPageToken": next_page_token if isinstance(next_page_token, str) and next_page_token else None,
    }
