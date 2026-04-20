from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from typing import Optional
from app.models.schemas import (
    CropRecommendationRequest, CropRecommendationResponse,
    DiseaseDetectionResponse, YieldPredictionRequest, YieldPredictionResponse,
    MarketPriceRequest, MarketPriceResponse, ChatRequest, ChatResponse
)
from app.services import gemini_service, snowflake_service, weather_service

crop_router = APIRouter()
disease_router = APIRouter()
yield_router = APIRouter()
market_router = APIRouter()
chat_router = APIRouter()
weather_router = APIRouter()
analytics_router = APIRouter()

# --- Analytics Router ---
@analytics_router.get("/analytics/summary")
async def get_analytics_dash():
    try:
        data = snowflake_service.get_analytics_summary()
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Crop Router ---
@crop_router.post("/crop-recommendation", response_model=CropRecommendationResponse)
async def get_crop_recommendation(req: CropRecommendationRequest):
    try:
        result = gemini_service.get_crop_recommendation(
            n=req.nitrogen, p=req.phosphorus, k=req.potassium,
            ph=req.ph, rainfall=req.rainfall, temp=req.temperature,
            humidity=req.humidity or 0.0, region=req.region or "Unknown",
            language=req.language.value
        )
        
        # Log to DB (non-blocking)
        snowflake_service.log_crop_recommendation(
            n=req.nitrogen, p=req.phosphorus, k=req.potassium,
            ph=req.ph, rainfall=req.rainfall, temp=req.temperature,
            region=req.region or "Unknown", crops=result.get('recommendations', []),
            language=req.language.value
        )
        
        return CropRecommendationResponse(success=True, **result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Disease Router ---
@disease_router.post("/disease-detection", response_model=DiseaseDetectionResponse)
async def detect_disease(
    file: UploadFile = File(...),
    language: str = Form("en")
):
    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail="Invalid image format. Supported formats: JPG, PNG, WebP")
    
    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max size: 10MB")
    
    try:
        result = gemini_service.detect_disease_from_image(file_bytes, language)
        
        # Log to DB
        snowflake_service.log_disease_detection(
            disease_name=result.get("disease_name", "Unknown"),
            confidence=result.get("confidence", "Unknown"),
            urgency_level=result.get("urgency_level", "Unknown"),
            language=language
        )
        
        return DiseaseDetectionResponse(success=True, **result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Yield Router ---
@yield_router.post("/yield-prediction", response_model=YieldPredictionResponse)
async def predict_yield_val(req: YieldPredictionRequest):
    try:
        result = gemini_service.predict_yield(
            crop_type=req.crop_type, region=req.region, area_hectares=req.area_hectares,
            season=req.season.value, soil_type=req.soil_type, irrigation=req.irrigation,
            fertilizer_used=req.fertilizer_used or "Unknown",
            previous_yield=req.previous_yield or 0.0, language=req.language.value
        )
        
        # Log to DB (you can extend snowflake_service for yield, but we'll use log_query as a generic logger for now if preferred, or log it silently)
        snowflake_service.log_query(
            endpoint="/yield-prediction",
            request_payload=req.model_dump(mode='json'),
            response_summary=f"Predicted yield for {req.crop_type}: {result.get('expected_yield_tonnes')} tonnes",
            language=req.language.value,
            region=req.region
        )
        
        return YieldPredictionResponse(success=True, **result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Market Router ---
@market_router.post("/price-forecast", response_model=MarketPriceResponse)
async def price_forecast(req: MarketPriceRequest):
    try:
        result = gemini_service.forecast_market_price(
            crop=req.crop, location=req.location,
            quantity_quintals=req.quantity_quintals or 0.0,
            current_price=req.current_price or 0.0,
            language=req.language.value
        )
        
        snowflake_service.log_query(
            endpoint="/price-forecast",
            request_payload=req.model_dump(mode='json'),
            response_summary=f"Forecast for {req.crop} in {req.location}: trend is {result.get('predicted_trend')}",
            language=req.language.value,
            region=req.location
        )
        
        return MarketPriceResponse(success=True, **result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Chat Router ---
@chat_router.post("/chat", response_model=ChatResponse)
async def chat_bot(req: ChatRequest):
    try:
        history_dicts = [{"role": msg.role, "content": msg.content} for msg in req.history]
        result = gemini_service.chat_with_agri_expert(
            message=req.message,
            history=history_dicts,
            language=req.language.value,
            context=req.context or ""
        )
        
        snowflake_service.log_query(
            endpoint="/chat",
            request_payload={"message": req.message, "context": req.context},
            response_summary="Chatbot generated a reply",
            language=req.language.value,
            region="Unknown"
        )
        
        return ChatResponse(success=True, language=req.language, **result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Weather Router ---
@weather_router.get("/weather/search")
async def search_city(q: str):
    try:
        if not q or len(q) < 2:
            return {"success": True, "results": []}
        results = weather_service.search_cities(q)
        return {"success": True, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@weather_router.get("/weather")
async def get_weather(
    city: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
):
    try:
        if lat is not None and lon is not None:
            result = weather_service.get_weather_by_coords(lat, lon)
        elif city:
            result = weather_service.get_weather_by_city(city)
        else:
            raise HTTPException(
                status_code=400,
                detail="Provide a 'city' name or both 'lat' and 'lon' coordinates."
            )
        return {"success": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Weather fetch failed: {str(e)}")
