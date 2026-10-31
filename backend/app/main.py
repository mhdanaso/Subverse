
from fastapi import FastAPI

app = FastAPI(
    title="Subverse API",
    description="Subscription Management System API",
    version="1.0.0",
)


@app.get("/")
def root():
    return {
        "message": "Welcome to Subverse API",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
