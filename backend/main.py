from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="CareerScout AI API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_methods=["GET"],
)


@app.get("/")
def read_root():
    return {"message": "Welcome to the CareerScout AI API!"}


@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "CareerScout AI API is running."}
