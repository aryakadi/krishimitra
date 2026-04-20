from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.core.config import settings
from app.routers.api_routers import (
    crop_router, disease_router, yield_router, market_router,
    chat_router, weather_router, analytics_router,
    feedback_router, report_router, dw_router,
)

app = FastAPI(
    title="AgriSmart AI — Data Warehouse Intelligence System",
    description=(
        "Full-stack ADBMS platform for intelligent agriculture. "
        "Powered by Snowflake Star Schema, ETL pipelines, and ML-driven predictions. "
        "Endpoints: crop-recommendation, disease-detection, yield-prediction, "
        "market-price, analytics, feedback, PDF reports."
    ),
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
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

# Router registration
prefix = "/api/v1"
app.include_router(crop_router,      prefix=prefix, tags=["Crop Recommendation"])
app.include_router(disease_router,   prefix=prefix, tags=["Disease Detection"])
app.include_router(yield_router,     prefix=prefix, tags=["Yield Prediction"])
app.include_router(market_router,    prefix=prefix, tags=["Market Price"])
app.include_router(chat_router,      prefix=prefix, tags=["Chatbot"])
app.include_router(weather_router,   prefix=prefix, tags=["Weather"])
app.include_router(analytics_router, prefix=prefix, tags=["Analytics (Snowflake)"])
app.include_router(feedback_router,  prefix=prefix, tags=["Feedback Loop"])
app.include_router(report_router,    prefix=prefix, tags=["PDF Reports"])
app.include_router(dw_router,        prefix=prefix, tags=["Data Warehouse"])

@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Welcome to AgriSmart AI Data Warehouse System",
        "version": "2.0.0",
        "docs": "/docs",
        "architecture": "Snowflake Star Schema + FastAPI + React",
        "new_endpoints": [
            "/api/v1/predict-disease",
            "/api/v1/predict-yield",
            "/api/v1/predict-price",
            "/api/v1/analytics",
            "/api/v1/analytics/crop-trends",
            "/api/v1/analytics/disease-trends",
            "/api/v1/analytics/yield-comparison",
            "/api/v1/analytics/price-history",
            "/api/v1/feedback",
            "/api/v1/feedback/summary",
            "/api/v1/report/generate",
            "/api/v1/dw/table-counts",
        ]
    }

@app.get("/health", tags=["Root"])
async def health_check():
    return {"status": "healthy", "version": "2.0.0"}
