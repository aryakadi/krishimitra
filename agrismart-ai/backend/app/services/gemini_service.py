import io
import json
import logging
from PIL import Image
import google.generativeai as genai
from app.core.config import settings

logger = logging.getLogger(__name__)

genai.configure(api_key=settings.GEMINI_API_KEY)
model = genai.GenerativeModel(settings.GEMINI_MODEL)
vision_model = genai.GenerativeModel(settings.GEMINI_MODEL) # Gemini-1.5 supports both text and vision natively in same model, but we keep the structure

def _get_language_instruction(lang_code: str) -> str:
    if lang_code == "hi":
        return "Respond in Hindi (हिंदी में जवाब दें). Use simple Hindi."
    elif lang_code == "mr":
        return "Respond in Marathi (मराठीत उत्तर द्या). Use simple Marathi."
    return "Respond in English."

def _parse_json_response(raw_text: str) -> dict:
    try:
        text = raw_text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        return json.loads(text.strip())
    except Exception as e:
        logger.error(f"JSON Parsing Error: {e}")
        logger.error(f"Raw Text: {raw_text}")
        raise ValueError("Failed to parse Gemini response as JSON")

def get_crop_recommendation(n: float, p: float, k: float, ph: float, rainfall: float, temp: float, humidity: float, region: str, language: str) -> dict:
    lang_inst = _get_language_instruction(language)
    prompt = f"""
    You are an expert agricultural scientist with 30 years India experience.
    {lang_inst}
    
    Given the following soil and climate conditions:
    - Nitrogen: {n} kg/ha
    - Phosphorus: {p} kg/ha
    - Potassium: {k} kg/ha
    - pH Level: {ph}
    - Rainfall: {rainfall} mm
    - Temperature: {temp} °C
    - Humidity: {humidity}%
    - Region: {region}
    
    Task: Recommend the TOP 3 crops considering nutrient fit, pH, rainfall, temperature, and region.
    
    Output JSON ONLY in this exact format, with no markdown fences, no other text:
    {{
      "recommendations": [
        {{
          "crop": "",
          "confidence": "High/Medium/Low",
          "reason": "2-3 sentences",
          "ideal_season": "",
          "water_requirement": "",
          "expected_yield": ""
        }}
      ],
      "soil_health_summary": "",
      "additional_tips": ""
    }}
    """
    response = model.generate_content(prompt)
    return _parse_json_response(response.text)

def detect_disease_from_image(image_bytes: bytes, language: str) -> dict:
    lang_inst = _get_language_instruction(language)
    img = Image.open(io.BytesIO(image_bytes))
    
    prompt = f"""
    You are a plant pathologist specializing in crop disease diagnosis.
    {lang_inst}
    
    Look at this plant leaf image and diagnose the disease. 
    
    Output JSON ONLY in this exact format, with no markdown fences, no other text:
    {{
      "disease_name": "",
      "confidence": "",
      "affected_parts": [],
      "symptoms": [],
      "causes": "",
      "treatment": [],
      "prevention": [],
      "organic_remedy": "",
      "urgency_level": "low/medium/high/critical",
      "additional_info": ""
    }}
    """
    response = vision_model.generate_content([prompt, img])
    return _parse_json_response(response.text)

def predict_yield(crop_type: str, region: str, area_hectares: float, season: str, soil_type: str, irrigation: str, fertilizer_used: str, previous_yield: float, language: str) -> dict:
    lang_inst = _get_language_instruction(language)
    
    prompt = f"""
    You are an agricultural yield prediction expert, familiar with Indian farming conditions.
    {lang_inst}
    
    Given these conditions:
    - Crop: {crop_type}
    - Region: {region}
    - Area: {area_hectares} hectares
    - Season: {season}
    - Soil Type: {soil_type}
    - Irrigation: {irrigation}
    - Fertilizer: {fertilizer_used}
    - Previous Yield: {previous_yield} tonnes/ha
    
    Consider regional averages, irrigation impact, seasonal suitability, and soil type to estimate the expected yield.
    
    Output JSON ONLY in this exact format, with no markdown fences, no other text:
    {{
      "crop": "",
      "region": "",
      "min_yield_tonnes": 0.0,
      "max_yield_tonnes": 0.0,
      "expected_yield_tonnes": 0.0,
      "yield_per_hectare": "",
      "influencing_factors": [],
      "improvement_tips": [],
      "risk_factors": [],
      "confidence_level": "High/Medium/Low"
    }}
    """
    response = model.generate_content(prompt)
    return _parse_json_response(response.text)

def forecast_market_price(crop: str, location: str, quantity_quintals: float, current_price: float, language: str) -> dict:
    lang_inst = _get_language_instruction(language)
    
    prompt = f"""
    You are an agricultural market analyst, an Indian APMC/e-NAM expert.
    {lang_inst}
    
    Provide a market price forecast for:
    - Crop: {crop}
    - Location: {location}
    - Quantity: {quantity_quintals} quintals
    - Current Price: ₹{current_price} per quintal
    
    Consider seasonal supply-demand, MSP, export demand, and weather impact. Output a 3-month forecast.
    
    Output JSON ONLY in this exact format, with no markdown fences, no other text:
    {{
      "crop": "",
      "location": "",
      "current_price_range": "₹XXXX - ₹YYYY per quintal",
      "predicted_trend": "increasing/decreasing/stable",
      "price_forecast": [
        {{"month": "Next Month", "predicted_price": "₹XXXX - ₹YYYY", "trend": "up/down/stable"}},
        {{"month": "Month + 2", "predicted_price": "₹XXXX - ₹YYYY", "trend": "up/down/stable"}},
        {{"month": "Month + 3", "predicted_price": "₹XXXX - ₹YYYY", "trend": "up/down/stable"}}
      ],
      "best_selling_window": "",
      "market_demand": "",
      "export_potential": "",
      "storage_advice": "",
      "price_factors": []
    }}
    """
    response = model.generate_content(prompt)
    return _parse_json_response(response.text)

def chat_with_agri_expert(message: str, history: list, language: str, context: str) -> dict:
    lang_inst = _get_language_instruction(language)
    
    sys_prompt = f"""
    You are AgriBot — an expert agricultural assistant for Indian farmers.
    Knowledge base: Indian crops, NPK/fertilizers, pest/disease, govt schemes (PM-KISAN, PMFBY, e-NAM, Kisan Credit Card), market prices, organic farming, irrigation methods.
    Rules: Use simple language, avoid technical jargon if possible. Be warm, encouraging, and provide concise 3-5 sentence replies.
    {lang_inst}
    
    Conversation Context/Current Page context (if any): {context}
    
    Your response MUST be ONLY valid JSON in this exact format:
    {{
      "reply": "your message here",
      "suggestions": ["question 1", "question 2", "question 3"]
    }}
    """
    
    formatted_history = []
    for msg in history[-10:]:
        role = "model" if msg['role'] == "assistant" else "user"
        formatted_history.append({"role": role, "parts": [msg['content']]})
    
    # We can use start_chat passing the history
    chat = model.start_chat(history=formatted_history)
    response = chat.send_message(f"{sys_prompt}\nUser Request: {message}")
    
    return _parse_json_response(response.text)
