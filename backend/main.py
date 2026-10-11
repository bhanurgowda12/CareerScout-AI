import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, quote
from urllib.request import Request, urlopen

import firebase_admin
from firebase_admin import auth as firebase_auth
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

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
    project_id = os.environ.get("FIREBASE_PROJECT_ID")
    if not project_id:
        raise HTTPException(status_code=503, detail="Firebase server authentication is not configured.")

    try:
        return firebase_admin.get_app()
    except ValueError:
        try:
            return firebase_admin.initialize_app(options={"projectId": project_id})
        except Exception as error:
            raise HTTPException(
                status_code=503,
                detail="Firebase server authentication is not configured.",
            ) from error


def require_firebase_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="A Firebase sign-in token is required.")

    admin_app = get_firebase_admin_app()
    try:
        decoded_token = firebase_auth.verify_id_token(credentials.credentials, app=admin_app)
    except Exception as error:
        raise HTTPException(status_code=401, detail="The Firebase sign-in token is invalid or expired.") from error

    user_id = decoded_token.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="The Firebase sign-in token has no user identity.")
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
    api_key = os.environ.get("YOUTUBE_API_KEY")
    if not api_key:
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
    request = Request(
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
