import json
import logging
import os
import socket
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, quote
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
bearer_scheme = HTTPBearer(auto_error=False)


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


@app.get("/api/learning-resources")
def get_learning_resources(
    skill: str = Query(min_length=1, max_length=120),
    _user_id: str = Depends(require_firebase_user),
):
    api_key = os.environ.get("YOUTUBE_API_KEY", "").strip()
    if not api_key:
        logging.getLogger(__name__).error(
            "YouTube learning resources unavailable: YOUTUBE_API_KEY is missing or empty in this backend process."
        )
        raise HTTPException(status_code=503, detail="YouTube learning resources are not configured.")

    query_parameters = urlencode({
        "key": api_key,
        "part": "snippet",
        "q": skill.strip(),
        "type": "video",
        "maxResults": 3,
        "safeSearch": "moderate",
        "videoEmbeddable": "true",
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
    for item in payload.get("items", []):
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

    return {"videos": videos}
