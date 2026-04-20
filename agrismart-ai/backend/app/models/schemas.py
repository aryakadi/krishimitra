from enum import Enum
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field

class Language(str, Enum):
    en = "en"
    hi = "hi"
    mr = "mr"

class Season(str, Enum):
    Kharif = "Kharif"
    Rabi   = "Rabi"
    Zaid   = "Zaid"

# --- Crop Recommendation ---
class CropRecommendationRequest(BaseModel):
    nitrogen:    float = Field(..., ge=0, le=200)
    phosphorus:  float
    potassium:   float
    ph:          float = Field(..., ge=0, le=14)
    rainfall:    float
    temperature: float
    humidity:    Optional[float] = None
    region:      Optional[str]  = None
    language:    Language = Language.en

class CropOption(BaseModel):
    crop:             str
    confidence:       str
    reason:           str
    ideal_season:     str
    water_requirement:str
    expected_yield:   str

class CropRecommendationResponse(BaseModel):
    success:              bool
    recommendations:      List[CropOption]
    soil_health_summary:  str
    additional_tips:      str

# --- Disease Detection ---
class DiseaseDetectionResponse(BaseModel):
    success:         bool
    disease_name:    str
    confidence:      str
    affected_parts:  List[str]
    symptoms:        List[str]
    causes:          str
    treatment:       List[str]
    prevention:      List[str]
    organic_remedy:  str
    urgency_level:   str
    additional_info: str

# --- Yield Prediction ---
class YieldPredictionRequest(BaseModel):
    crop_type:       str
    region:          str
    area_hectares:   float
    season:          Season
    soil_type:       str
    irrigation:      str
    fertilizer_used: Optional[str]   = None
    previous_yield:  Optional[float] = None
    language:        Language = Language.en

class YieldPredictionResponse(BaseModel):
    success:              bool
    crop:                 str
    region:               str
    min_yield_tonnes:     float
    max_yield_tonnes:     float
    expected_yield_tonnes:float
    yield_per_hectare:    str
    influencing_factors:  List[str]
    improvement_tips:     List[str]
    risk_factors:         List[str]
    confidence_level:     str

# --- Market Price ---
class MarketPriceRequest(BaseModel):
    crop:               str
    location:           str
    quantity_quintals:  Optional[float] = None
    current_price:      Optional[float] = None
    language:           Language = Language.en

class PriceTrendPoint(BaseModel):
    month:           str
    predicted_price: str
    trend:           str  # up, down, stable

class MarketPriceResponse(BaseModel):
    success:              bool
    crop:                 str
    location:             str
    current_price_range:  str
    predicted_trend:      str
    price_forecast:       List[PriceTrendPoint]
    best_selling_window:  str
    market_demand:        str
    export_potential:     str
    storage_advice:       str
    price_factors:        List[str]

# --- Chatbot ---
class ChatMessage(BaseModel):
    role:    str  # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    message:  str
    history:  List[ChatMessage] = []
    language: Language = Language.en
    context:  Optional[str] = None

class ChatResponse(BaseModel):
    success:     bool
    reply:       str
    language:    Language
    suggestions: List[str]

# --- Feedback Loop ---
class FeedbackRequest(BaseModel):
    prediction_id: int
    actual_value:  str
    notes:         Optional[str] = None

class FeedbackResponse(BaseModel):
    success: bool
    message: str

# --- Analytics ---
class AnalyticsSummaryResponse(BaseModel):
    success:             bool
    snowflake_connected: bool
    top_diseases:        List[Dict[str, Any]]
    top_crops:           List[Dict[str, Any]]
    feature_usage:       List[Dict[str, Any]]
    total_predictions:   int
    accuracy_pct:        float

# --- Report Generation ---
class ReportRequest(BaseModel):
    user_name:              str = "AgriSmart User"
    prediction_results:     Optional[Dict[str, Any]] = None
    include_crop_trends:    bool = True
    include_disease_trends: bool = True
    include_yield_comparison: bool = True
    include_feedback:       bool = True
