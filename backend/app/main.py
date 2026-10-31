from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.database import check_database_connection, settings


app = FastAPI(
    title="Subverse API",
    description="Subscription management API for the Subverse MVP.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in settings.cors_origins.split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(api_router)


@app.get("/", tags=["health"])
def root():
    return {"message": "Welcome to Subverse API", "status": "running"}


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "healthy"}


@app.get("/health/db", tags=["health"])
def database_health_check():
    try:
        check_database_connection()
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Database connection failed",
        ) from exc
    return {"status": "database connected"}
