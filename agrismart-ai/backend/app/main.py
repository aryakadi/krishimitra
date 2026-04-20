from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.core.config import settings
from app.routers.api_routers import (
    crop_router, disease_router, yield_router, market_router, chat_router
)

app = FastAPI(
    title="AgriSmart AI Backend",
    description="Backend API for AgriSmart AI featuring agricultural decision support.",
    version="1.0.0"
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Routers
prefix = "/api/v1"
app.include_router(crop_router, prefix=prefix, tags=["Crop Recommendation"])
app.include_router(disease_router, prefix=prefix, tags=["Disease Detection"])
app.include_router(yield_router, prefix=prefix, tags=["Yield Prediction"])
app.include_router(market_router, prefix=prefix, tags=["Market Price"])
app.include_router(chat_router, prefix=prefix, tags=["Chatbot"])

@app.get("/")
async def root():
    return {"message": "Welcome to AgriSmart AI API", "docs": "/docs"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}


