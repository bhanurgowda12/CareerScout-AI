import json
import logging
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, quote
from urllib.request import Request as URLRequest, urlopen

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import auth as firebase_auth
from fastapi import Depends, FastAPI, HTTPException, Query, Request as FastAPIRequest
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google.auth.exceptions import DefaultCredentialsError

load_dotenv(Path(__file__).with_name(".env"))
logging.getLogger(__name__).warning(
    "CareerScout backend loaded %s; FIREBASE_PROJECT_ID configured: %s; YOUTUBE_API_KEY configured: %s",
    Path(__file__).resolve(),
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


def get_firebase_admin_app():
    project_id = os.environ.get("FIREBASE_PROJECT_ID", "").strip()
    if not project_id:
        logging.getLogger(__name__).error("Firebase Admin unavailable: project_id_configured=False")
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
            logging.getLogger(__name__).error(
                "Firebase Admin initialization failed: project_id_configured=True; exception_type=%s",
                type(error).__name__,
            )
            raise HTTPException(
                status_code=503,
                detail={"code": "firebase-admin-not-configured", "message": "Firebase server authentication is not configured."},
            ) from error

    if admin_app.project_id != project_id:
        logging.getLogger(__name__).error(
            "Firebase Admin project mismatch: configured_project_matches_admin_app=False"
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
            "Firebase auth rejected request: category=missing-bearer; authorization_header_present=%s; bearer_token_extracted=False",
            bool(request.headers.get("authorization")),
        )
        raise HTTPException(
            status_code=401,
            detail={"code": "firebase-sign-in-required", "message": "A Firebase sign-in token is required."},
        )

    admin_app = get_firebase_admin_app()
    try:
        decoded_token = firebase_auth.verify_id_token(credentials.credentials, app=admin_app)
    except firebase_auth.ExpiredIdTokenError as error:
        logging.getLogger(__name__).warning(
            "Firebase auth rejected request: category=expired-token; authorization_header_present=True; bearer_token_extracted=True; admin_project_matches_expected=True"
        )
        raise HTTPException(
            status_code=401,
            detail={"code": "firebase-token-expired", "message": "The Firebase sign-in token has expired."},
        ) from error
    except firebase_auth.RevokedIdTokenError as error:
        logging.getLogger(__name__).warning(
            "Firebase auth rejected request: category=revoked-token; authorization_header_present=True; bearer_token_extracted=True; admin_project_matches_expected=True"
        )
        raise HTTPException(
            status_code=401,
            detail={"code": "firebase-token-revoked", "message": "This Firebase sign-in is no longer valid."},
        ) from error
    except firebase_auth.InvalidIdTokenError as error:
        verifier_message = str(error).lower()
        if "audience" in verifier_message or '"aud"' in verifier_message:
            category = "project-mismatch"
            error_code = "firebase-token-project-mismatch"
            user_message = "The Firebase sign-in token belongs to a different Firebase project."
        elif "issuer" in verifier_message or '"iss"' in verifier_message:
            category = "issuer-mismatch"
            error_code = "firebase-token-issuer-mismatch"
            user_message = "The Firebase sign-in token issuer does not match this backend project."
        elif "signature" in verifier_message:
            category = "signature-invalid"
            error_code = "firebase-token-signature-invalid"
            user_message = "Firebase could not validate the sign-in token signature."
        else:
            category = "invalid-token"
            error_code = "firebase-token-invalid"
            user_message = "Firebase could not verify this sign-in token."
        logging.getLogger(__name__).warning(
            "Firebase auth rejected request: category=%s; authorization_header_present=True; bearer_token_extracted=True; admin_project_matches_expected=True",
            category,
        )
        raise HTTPException(
            status_code=401,
            detail={"code": error_code, "message": user_message},
        ) from error
    except (ValueError, TypeError) as error:
        logging.getLogger(__name__).warning(
            "Firebase auth rejected request: category=malformed-token; authorization_header_present=True; bearer_token_extracted=True; admin_project_matches_expected=True"
        )
        raise HTTPException(
            status_code=401,
            detail={"code": "firebase-token-invalid", "message": "Firebase could not verify this sign-in token."},
        ) from error
    except firebase_auth.CertificateFetchError as error:
        logging.getLogger(__name__).error(
            "Firebase token verification unavailable: category=certificate-fetch; admin_project_matches_expected=True"
        )
        raise HTTPException(
            status_code=503,
            detail={"code": "firebase-verification-unavailable", "message": "Firebase token verification is temporarily unavailable."},
        ) from error
    except DefaultCredentialsError as error:
        logging.getLogger(__name__).error(
            "Firebase token verification unavailable: category=application-default-credentials-missing; admin_project_matches_expected=True"
        )
        raise HTTPException(
            status_code=503,
            detail={
                "code": "firebase-admin-credentials-missing",
                "message": "Firebase server credentials are not configured. Set up Application Default Credentials for the backend and restart it.",
            },
        ) from error
    except Exception as error:
        logging.getLogger(__name__).error(
            "Firebase token verification failed: category=unexpected-verifier-error; exception_type=%s; admin_project_matches_expected=True",
            type(error).__name__,
        )
        raise HTTPException(
            status_code=503,
            detail={"code": "firebase-verification-unavailable", "message": "Firebase token verification is temporarily unavailable."},
        ) from error

    user_id = decoded_token.get("uid")
    if not user_id:
        logging.getLogger(__name__).warning(
            "Firebase auth rejected request: category=missing-uid; authorization_header_present=True; bearer_token_extracted=True; admin_project_matches_expected=True"
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
