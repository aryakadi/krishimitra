import io
import json
import logging
import base64
import requests
from PIL import Image
import google.generativeai as genai
from app.core.config import settings

logger = logging.getLogger(__name__)

# --- Configure Google Gemini SDK ---
genai.configure(api_key=settings.GEMINI_API_KEY)

# Use the stable flash model
# We initialize inside the functions to be resilient to setting changes
def _get_gemini_model():
    return genai.GenerativeModel(settings.GEMINI_MODEL or 'gemini-1.5-flash')

# --- NVIDIA NIM Configuration ---
NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions"

def _get_language_instruction(lang_code: str) -> str:
    if lang_code == "hi":
        return "Respond in Hindi (हिंदी में जवाब दें)."
    elif lang_code == "mr":
        return "Respond in Marathi (मराठीत उत्तर द्या)."
    return "Respond in English."

def _parse_json_response(raw_text: str) -> dict:
    try:
        text = raw_text.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
            
        start_idx = text.find('{')
        end_idx = text.rfind('}')
        if start_idx == -1 or end_idx == -1:
            raise ValueError("No JSON object found")
        return json.loads(text[start_idx:end_idx+1])
    except Exception as e:
        logger.error(f"JSON Parsing Error: {e}")
        return {}

def _call_nvidia_nim(prompt: str, model: str = None, system_prompt: str = None, history: list = None) -> str:
    headers = {
        "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
        "Content-Type": "application/json"
    }
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": model or settings.NVIDIA_MODEL,
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": 4096
    }

    try:
        response = requests.post(NVIDIA_URL, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        return response.json()['choices'][0]['message']['content']
    except Exception as e:
        logger.error(f"NVIDIA API Error: {e}")
        raise

# --- CORE SERVICES ---

def detect_disease_from_image(image_bytes: bytes, language: str) -> dict:
    """Stable Version: Google Gemini Vision"""
    try:
        model = _get_gemini_model()
        img = Image.open(io.BytesIO(image_bytes))
        lang_inst = _get_language_instruction(language)
        
        prompt = f"""
        Analyze this plant leaf. You are an expert plant pathologist.
        {lang_inst}
        
        Output valid JSON ONLY:
        {{
          "disease_name": "Name",
          "confidence": "High/Medium/Low",
          "affected_parts": ["list"],
          "symptoms": ["list"],
          "causes": "Explanation",
          "treatment": ["step 1", "step 2"],
          "prevention": ["step 1"],
          "organic_remedy": "Details",
          "urgency_level": "low/medium/high/critical",
          "additional_info": ""
        }}
        """
        response = model.generate_content([prompt, img])
        result = _parse_json_response(response.text)
        
        # Ensure all fields are present
        defaults = {
            "disease_name": "Unknown",
            "confidence": "Low",
            "affected_parts": [],
            "symptoms": [],
            "causes": "N/A",
            "treatment": [],
            "prevention": [],
            "organic_remedy": "N/A",
            "urgency_level": "low",
            "additional_info": ""
        }
        for k, v in defaults.items():
            if k not in result: result[k] = v
        return result
    except Exception as e:
        logger.error(f"Disease Detection Failed: {e}")
        return {
            "disease_name": "Error analyzing image",
            "confidence": "N/A",
            "affected_parts": [],
            "symptoms": [],
            "causes": "Service Timeout",
            "treatment": ["Please check your internet or API quota."],
            "prevention": ["Try again in a few minutes."],
            "organic_remedy": "N/A",
            "urgency_level": "low",
            "additional_info": str(e)
        }

def get_crop_recommendation(n, p, k, ph, rainfall, temp, humidity, region, language) -> dict:
    prompt = f"Recommend top 3 crops for: N={n}, P={p}, K={k}, pH={ph}, Region={region}, Temp={temp}. {_get_language_instruction(language)}. Output JSON with 'recommendations' array, 'soil_health_summary', and 'additional_tips'."
    try:
        res_text = _call_nvidia_nim(prompt)
        result = _parse_json_response(res_text)
        result.setdefault("recommendations", [])
        result.setdefault("soil_health_summary", "Summary not available.")
        result.setdefault("additional_tips", "No additional tips.")
        return result
    except:
        return {"recommendations": [], "soil_health_summary": "Error", "additional_tips": "Check API"}

def predict_yield(crop_type, region, area_hectares, season, soil_type, irrigation, fertilizer_used, previous_yield, language) -> dict:
    prompt = f"Predict yield for {crop_type} in {region} ({area_hectares}ha). {_get_language_instruction(language)}. Output JSON with 'expected_yield_tonnes', 'min_yield_tonnes', 'max_yield_tonnes', 'yield_per_hectare', 'influencing_factors', 'improvement_tips', 'risk_factors', 'confidence_level'."
    try:
        res_text = _call_nvidia_nim(prompt)
        result = _parse_json_response(res_text)
        result.setdefault("crop", crop_type)
        result.setdefault("region", region)
        result.setdefault("min_yield_tonnes", 0.0)
        result.setdefault("max_yield_tonnes", 0.0)
        result.setdefault("expected_yield_tonnes", 0.0)
        # Force types and defaults for Pydantic compliance
        result["yield_per_hectare"] = str(result.get("yield_per_hectare", "N/A"))
        result.setdefault("influencing_factors", [])
        result.setdefault("improvement_tips", [])
        result.setdefault("risk_factors", [])
        result.setdefault("confidence_level", "Medium")
        
        return result
    except:
        return {
            "crop": crop_type, "region": region, "min_yield_tonnes": 0.0, "max_yield_tonnes": 0.0,
            "expected_yield_tonnes": 0.0, "yield_per_hectare": "N/A", "influencing_factors": [],
            "improvement_tips": [], "risk_factors": [], "confidence_level": "Error"
        }

def forecast_market_price(crop, location, quantity_quintals, current_price, language) -> dict:
    prompt = f"Market forecast for {crop} in {location}. {_get_language_instruction(language)}. Output JSON with 'current_price_range', 'predicted_trend', 'price_forecast' array, 'best_selling_window', 'storage_advice', 'market_demand', 'export_potential', 'price_factors'."
    try:
        res_text = _call_nvidia_nim(prompt)
        result = _parse_json_response(res_text)
        result.setdefault("crop", crop)
        result.setdefault("location", location)
        result.setdefault("current_price_range", "N/A")
        result.setdefault("predicted_trend", "Stable")
        result.setdefault("price_forecast", [])
        result.setdefault("best_selling_window", "N/A")
        result.setdefault("storage_advice", "N/A")
        result.setdefault("market_demand", "N/A")
        result.setdefault("export_potential", "N/A")
        result.setdefault("price_factors", [])
        return result
    except:
        return {
            "crop": crop, "location": location, "current_price_range": "N/A", "predicted_trend": "error",
            "price_forecast": [], "best_selling_window": "N/A", "storage_advice": "N/A",
            "market_demand": "N/A", "export_potential": "N/A", "price_factors": []
        }

def chat_with_agri_expert(message, history, language, context) -> dict:
    sys_prompt = f"You are AgriBot. {_get_language_instruction(language)}. Context: {context}. Response MUST be JSON: {{'reply': '...', 'suggestions': []}}"
    nim_history = [{"role": "assistant" if m['role'] == "assistant" else "user", "content": m['content']} for m in history[-5:]]
    try:
        res_text = _call_nvidia_nim(message, system_prompt=sys_prompt, history=nim_history)
        return _parse_json_response(res_text)
    except:
        return {"reply": "I'm having trouble connecting to AI. Please try again."}
