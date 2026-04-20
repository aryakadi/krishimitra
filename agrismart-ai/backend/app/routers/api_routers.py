import base64
import logging
from typing import Optional
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Query
from fastapi.responses import Response
from app.models.schemas import (
    CropRecommendationRequest, CropRecommendationResponse,
    DiseaseDetectionResponse, YieldPredictionRequest, YieldPredictionResponse,
    MarketPriceRequest, MarketPriceResponse, ChatRequest, ChatResponse,
    FeedbackRequest, FeedbackResponse, ReportRequest,
)
from app.services import gemini_service, snowflake_service, weather_service
from app.services import report_service

logger = logging.getLogger(__name__)

# ─── Routers ──────────────────────────────────────────────────────────────────
crop_router      = APIRouter()
disease_router   = APIRouter()
yield_router     = APIRouter()
market_router    = APIRouter()
chat_router      = APIRouter()
weather_router   = APIRouter()
analytics_router = APIRouter()
feedback_router  = APIRouter()
report_router    = APIRouter()
dw_router        = APIRouter()    # Data Warehouse info router

# ─── Helpers ──────────────────────────────────────────────────────────────────
def handle_api_exception(e: Exception):
    error_msg = str(e)
    logger.error(f"API Error: {error_msg}")
    if "429" in error_msg or "quota" in error_msg.lower() or "Quota exceeded" in error_msg:
        raise HTTPException(
            status_code=429,
            detail="AI service rate limit exceeded. Please try again in a minute or check your API key."
        )
    raise HTTPException(status_code=500, detail=error_msg)


# =============================================================================
# CROP RECOMMENDATION
# =============================================================================
@crop_router.post("/crop-recommendation", response_model=CropRecommendationResponse)
async def get_crop_recommendation(req: CropRecommendationRequest):
    try:
        result = gemini_service.get_crop_recommendation(
            n=req.nitrogen, p=req.phosphorus, k=req.potassium,
            ph=req.ph, rainfall=req.rainfall, temp=req.temperature,
            humidity=req.humidity or 0.0, region=req.region or "Unknown",
            language=req.language.value
        )
        snowflake_service.log_crop_recommendation(
            n=req.nitrogen, p=req.phosphorus, k=req.potassium,
            ph=req.ph, rainfall=req.rainfall, temp=req.temperature,
            region=req.region or "Unknown",
            crops=result.get("recommendations", []),
            language=req.language.value
        )
        return CropRecommendationResponse(success=True, **result)
    except Exception as e:
        handle_api_exception(e)


# =============================================================================
# DISEASE DETECTION  (also aliased as /predict-disease)
# =============================================================================
async def _detect_disease_handler(file: UploadFile, language: str):
    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail="Invalid format. Supported: JPG, PNG, WebP")
    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max: 10MB")
    try:
        result = gemini_service.detect_disease_from_image(file_bytes, language)
        snowflake_service.log_disease_detection(
            disease_name=result.get("disease_name", "Unknown"),
            confidence=result.get("confidence", "Unknown"),
            urgency_level=result.get("urgency_level", "Unknown"),
            language=language,
        )
        return DiseaseDetectionResponse(success=True, **result)
    except Exception as e:
        handle_api_exception(e)

@disease_router.post("/disease-detection", response_model=DiseaseDetectionResponse)
async def detect_disease(file: UploadFile = File(...), language: str = Form("en")):
    return await _detect_disease_handler(file, language)

@disease_router.post("/predict-disease", response_model=DiseaseDetectionResponse)
async def predict_disease(file: UploadFile = File(...), language: str = Form("en")):
    """Alias endpoint — ADBMS spec compliant."""
    return await _detect_disease_handler(file, language)


# =============================================================================
# YIELD PREDICTION  (also aliased as /predict-yield)
# =============================================================================
async def _yield_handler(req: YieldPredictionRequest):
    result = gemini_service.predict_yield(
        crop_type=req.crop_type, region=req.region,
        area_hectares=req.area_hectares, season=req.season.value,
        soil_type=req.soil_type, irrigation=req.irrigation,
        fertilizer_used=req.fertilizer_used or "Unknown",
        previous_yield=req.previous_yield or 0.0,
        language=req.language.value
    )
    snowflake_service.log_yield_prediction(
        crop_name=req.crop_type, region=req.region,
        area=req.area_hectares, season=req.season.value,
        min_y=result.get("min_yield_tonnes", 0.0),
        max_y=result.get("max_yield_tonnes", 0.0),
        expected_y=result.get("expected_yield_tonnes", 0.0),
        confidence=result.get("confidence_level", "Medium"),
        language=req.language.value
    )
    return YieldPredictionResponse(success=True, **result)

@yield_router.post("/yield-prediction", response_model=YieldPredictionResponse)
async def predict_yield_val(req: YieldPredictionRequest):
    try:
        return await _yield_handler(req)
    except Exception as e:
        handle_api_exception(e)

@yield_router.post("/predict-yield", response_model=YieldPredictionResponse)
async def predict_yield_alias(req: YieldPredictionRequest):
    """Alias endpoint — ADBMS spec compliant."""
    try:
        return await _yield_handler(req)
    except Exception as e:
        handle_api_exception(e)


# =============================================================================
# MARKET PRICE  (also aliased as /predict-price)
# =============================================================================
async def _market_handler(req: MarketPriceRequest):
    import json
    result = gemini_service.forecast_market_price(
        crop=req.crop, location=req.location,
        quantity_quintals=req.quantity_quintals or 0.0,
        current_price=req.current_price or 0.0,
        language=req.language.value
    )
    snowflake_service.log_price_forecast(
        crop_name=req.crop, location=req.location,
        predicted_trend=result.get("predicted_trend", "stable"),
        price_forecast_json=json.dumps(result.get("price_forecast", [])),
        language=req.language.value
    )
    return MarketPriceResponse(success=True, **result)

@market_router.post("/price-forecast", response_model=MarketPriceResponse)
async def price_forecast(req: MarketPriceRequest):
    try:
        return await _market_handler(req)
    except Exception as e:
        handle_api_exception(e)

@market_router.post("/predict-price", response_model=MarketPriceResponse)
async def predict_price(req: MarketPriceRequest):
    """Alias endpoint — ADBMS spec compliant."""
    try:
        return await _market_handler(req)
    except Exception as e:
        handle_api_exception(e)


# =============================================================================
# CHATBOT
# =============================================================================
@chat_router.post("/chat", response_model=ChatResponse)
async def chat_bot(req: ChatRequest):
    try:
        history_dicts = [{"role": m.role, "content": m.content} for m in req.history]
        result = gemini_service.chat_with_agri_expert(
            message=req.message, history=history_dicts,
            language=req.language.value, context=req.context or ""
        )

        # Normalise — ensure reply is always a non-empty string and suggestions is always a list
        reply = result.get("reply") or "Sorry, I could not generate a response. Please try again."
        suggestions = result.get("suggestions", [])
        if not isinstance(suggestions, list):
            suggestions = []
        suggestions = [str(s) for s in suggestions if s][:5]

        snowflake_service.log_query(
            endpoint="/chat",
            request_payload={"message": req.message},
            response_summary="Chatbot reply generated",
            language=req.language.value,
            region="Unknown"
        )
        return ChatResponse(success=True, language=req.language, reply=reply, suggestions=suggestions)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# =============================================================================
# WEATHER
# =============================================================================
@weather_router.get("/weather/search")
async def search_city(q: str):
    try:
        if not q or len(q) < 2:
            return {"success": True, "results": []}
        return {"success": True, "results": weather_service.search_cities(q)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@weather_router.get("/weather")
async def get_weather(
    city: Optional[str] = None,
    lat:  Optional[float] = None,
    lon:  Optional[float] = None,
):
    try:
        if lat is not None and lon is not None:
            result = weather_service.get_weather_by_coords(lat, lon)
        elif city:
            result = weather_service.get_weather_by_city(city)
        else:
            raise HTTPException(status_code=400, detail="Provide 'city' or 'lat'+'lon'.")
        return {"success": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Weather fetch failed: {str(e)}")


# =============================================================================
# ANALYTICS (Snowflake-powered)
# =============================================================================
@analytics_router.get("/analytics/summary")
async def get_analytics_summary():
    """Full analytics summary — queries Snowflake MVs."""
    try:
        data = snowflake_service.get_analytics_summary()
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@analytics_router.get("/analytics")
async def get_analytics():
    """ADBMS spec endpoint — alias for /analytics/summary."""
    try:
        data = snowflake_service.get_analytics_summary()
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@analytics_router.get("/analytics/crop-trends")
async def get_crop_trends():
    """Crop recommendation trend over time — from MV_CROP_TRENDS."""
    try:
        data = snowflake_service.get_crop_trends()
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@analytics_router.get("/analytics/disease-trends")
async def get_disease_trends():
    """Disease frequency by region — from MV_DISEASE_FREQ."""
    try:
        data = snowflake_service.get_disease_trends()
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@analytics_router.get("/analytics/yield-comparison")
async def get_yield_comparison():
    """Yield comparison across locations — from MV_YIELD_COMPARISON."""
    try:
        data = snowflake_service.get_yield_comparison()
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@analytics_router.get("/analytics/price-history")
async def get_price_history(
    crop: str = Query("wheat", description="Crop name"),
    location: str = Query("", description="Market location (optional)"),
):
    """Historical price data for a crop."""
    try:
        data = snowflake_service.get_price_history(crop, location)
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# DATA WAREHOUSE INFO
# =============================================================================
@dw_router.get("/dw/table-counts")
async def get_table_counts():
    """Return row counts for all Snowflake tables — used by Data Warehouse page."""
    try:
        data = snowflake_service.get_table_counts()
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# FEEDBACK LOOP
# =============================================================================
@feedback_router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(req: FeedbackRequest):
    """Submit the actual outcome for a previous prediction (feedback loop)."""
    try:
        success = snowflake_service.update_actual_result(req.prediction_id, req.actual_value)
        snowflake_service.log_query(
            endpoint="/feedback",
            request_payload={"prediction_id": req.prediction_id, "actual_value": req.actual_value},
            response_summary=f"Feedback submitted for prediction {req.prediction_id}",
            language="en",
            region="Unknown"
        )
        return FeedbackResponse(
            success=True,
            message=f"Feedback recorded for prediction #{req.prediction_id}. Thank you!"
            if success else
            "Feedback stored locally (Snowflake not connected)."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@feedback_router.get("/feedback/summary")
async def get_feedback_summary():
    """Get predicted vs actual accuracy summary."""
    try:
        data = snowflake_service.get_feedback_summary()
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# PDF REPORT
# =============================================================================
@report_router.post("/report/generate")
async def generate_report(req: ReportRequest):
    """Generate a PDF analytics report and return as base64-encoded bytes."""
    try:
        summary        = snowflake_service.get_analytics_summary()
        yield_comp     = snowflake_service.get_yield_comparison() if req.include_yield_comparison else None
        feedback_summ  = snowflake_service.get_feedback_summary() if req.include_feedback else None

        pdf_bytes = report_service.generate_report(
            user_name=req.user_name,
            prediction_results=req.prediction_results,
            include_crop_trends=req.include_crop_trends,
            include_disease_trends=req.include_disease_trends,
            include_yield_comparison=req.include_yield_comparison,
            include_feedback=req.include_feedback,
            analytics_summary=summary,
            yield_comparison=yield_comp,
            feedback_summary=feedback_summ,
        )
        pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")
        return {"success": True, "pdf_base64": pdf_b64, "filename": "agrismart_report.pdf"}
    except Exception as e:
        logger.error(f"Report generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ─── Type hint for Optional ───────────────────────────────────────────────────
from typing import Optional
