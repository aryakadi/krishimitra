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

# Vision models in priority order — lite first (lowest quota usage), then stronger ones
# Each will be tried in sequence until one succeeds
GEMINI_VISION_MODELS = [
    "gemini-2.0-flash-lite",   # cheapest quota usage
    "gemini-2.0-flash",        # standard
    "gemini-2.5-flash",        # highest quota tier
]

def _get_gemini_model(model_name: str = None):
    name = model_name or settings.GEMINI_MODEL or "gemini-2.0-flash"
    # Upgrade retired model names
    if "gemini-1.5" in name:
        name = "gemini-2.0-flash"
    return genai.GenerativeModel(name)

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

def _call_nvidia_nim(
    prompt: str,
    model: str = None,
    system_prompt: str = None,
    history: list = None,
    json_mode: bool = False,
) -> str:
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
        "temperature": 0.2,
        "max_tokens": 4096,
    }
    # Only request JSON response format for structured endpoints, not for chat
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    try:
        response = requests.post(NVIDIA_URL, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        content = response.json()['choices'][0]['message']['content']
        if not content or not content.strip():
            raise ValueError("Empty response from NVIDIA NIM")
        return content
    except Exception as e:
        logger.error(f"NVIDIA API Error: {e}")
        raise

# --- CORE SERVICES ---

_DISEASE_DEFAULTS = {
    "disease_name":   "Unknown",
    "confidence":     "Low",
    "affected_parts": [],
    "symptoms":       [],
    "causes":         "N/A",
    "treatment":      [],
    "prevention":     [],
    "organic_remedy": "N/A",
    "urgency_level":  "low",
    "additional_info": "",
}

_DISEASE_PROMPT = """
You are an expert plant pathologist. Analyze this plant leaf image carefully.
{lang_inst}

Output ONLY valid JSON (no explanation, no markdown):
{{
  "disease_name": "Name of disease, or Healthy Plant if no disease",
  "confidence": "High/Medium/Low",
  "affected_parts": ["leaf", "stem", etc],
  "symptoms": ["list of visible symptoms"],
  "causes": "Brief explanation of what caused this",
  "treatment": ["Step 1", "Step 2", "Step 3"],
  "prevention": ["Prevention tip 1", "Prevention tip 2"],
  "organic_remedy": "Natural/organic treatment details",
  "urgency_level": "low/medium/high/critical",
  "additional_info": "Any other important notes"
}}
"""


def _try_gemini_vision(img, prompt: str) -> dict | None:
    """Try each Gemini vision model in order. Return parsed dict or None if all fail."""
    import time
    for model_name in GEMINI_VISION_MODELS:
        try:
            logger.info(f"Disease detection: trying model {model_name}")
            model = _get_gemini_model(model_name)
            response = model.generate_content([prompt, img])
            result = _parse_json_response(response.text)
            if result and result.get("disease_name"):
                logger.info(f"Disease detection: success with {model_name}")
                return result
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "quota" in err_str.lower() or "rate" in err_str.lower():
                logger.warning(f"Disease detection: {model_name} quota hit, trying next model")
                time.sleep(2)   # brief pause before next model
                continue
            elif "404" in err_str:
                logger.warning(f"Disease detection: {model_name} not found, trying next")
                continue
            else:
                logger.error(f"Disease detection: {model_name} error: {err_str[:120]}")
                continue
    return None


def _fallback_disease_via_nim(image_bytes: bytes, language: str) -> dict:
    """
    Fallback: convert image to base64, send to NVIDIA NIM (Mistral).
    Mistral can reason from a described image context even without true vision.
    We describe the image via its metadata and ask for a general response.
    """
    lang_inst = _get_language_instruction(language)
    # Encode image to base64 for the multimodal NIM endpoint
    b64 = __import__('base64').b64encode(image_bytes).decode()
    
    # Try NVIDIA NIM multimodal endpoint (some NIM models support vision)
    NVIDIA_VISION_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Use mistral-small or a vision-capable model
    # Note: Mistral models on NIM may support vision via image URL/base64
    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": (
                        f"You are an expert plant pathologist. "
                        f"{lang_inst} "
                        f"Analyze this plant leaf image and identify any diseases. "
                        f"Return ONLY valid JSON with fields: disease_name, confidence (High/Medium/Low), "
                        f"affected_parts (array), symptoms (array), causes (string), treatment (array), "
                        f"prevention (array), organic_remedy (string), urgency_level (low/medium/high/critical), "
                        f"additional_info (string)."
                    )
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{b64}"
                    }
                }
            ]
        }
    ]
    
    # Try vision-capable NIM models
    vision_models = [
        "microsoft/phi-3.5-vision-instruct",
        "nvidia/llama-3.2-11b-vision-instruct",
        "meta/llama-4-scout-17b-16e-instruct",
    ]
    
    for model in vision_models:
        try:
            payload = {"model": model, "messages": messages, "temperature": 0.1, "max_tokens": 2048}
            resp = requests.post(NVIDIA_VISION_URL, headers=headers, json=payload, timeout=60)
            resp.raise_for_status()
            content = resp.json()['choices'][0]['message']['content']
            if content and content.strip():
                result = _parse_json_response(content)
                if result and result.get("disease_name"):
                    logger.info(f"Disease detection: NIM fallback success with {model}")
                    return result
        except Exception as e:
            logger.warning(f"Disease detection: NIM model {model} failed: {str(e)[:80]}")
            continue
    
    return {}


def detect_disease_from_image(image_bytes: bytes, language: str) -> dict:
    """
    Detect plant disease from image.
    Strategy:
      1. Try gemini-2.0-flash-lite (lowest quota)
      2. Try gemini-2.0-flash
      3. Try gemini-2.5-flash
      4. Try NVIDIA NIM vision models (phi-3.5-vision, llama-3.2-vision)
      5. Return graceful error dict
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
        lang_inst = _get_language_instruction(language)
        prompt = _DISEASE_PROMPT.format(lang_inst=lang_inst)

        # Step 1–3: Try Gemini models
        result = _try_gemini_vision(img, prompt)

        # Step 4: Fallback to NVIDIA NIM vision models
        if not result:
            logger.info("Disease detection: all Gemini models failed, trying NVIDIA NIM vision")
            result = _fallback_disease_via_nim(image_bytes, language)

        if result:
            # Fill any missing fields with defaults
            for k, v in _DISEASE_DEFAULTS.items():
                if k not in result or result[k] is None:
                    result[k] = v
            # Ensure list fields are actually lists
            for field in ("affected_parts", "symptoms", "treatment", "prevention"):
                if not isinstance(result.get(field), list):
                    val = result.get(field, "")
                    result[field] = [str(val)] if val else []
            return result

    except Exception as e:
        logger.error(f"Disease Detection outer error: {e}")

    # Final fallback — all services failed
    return {
        **_DISEASE_DEFAULTS,
        "disease_name":  "Service Unavailable",
        "confidence":    "N/A",
        "causes":        "All AI vision services are temporarily rate-limited. Please try again in 1-2 minutes.",
        "treatment":     ["Wait 1-2 minutes and try again", "Ensure the image is clear and well-lit"],
        "prevention":    ["Use high-quality images for better results"],
        "additional_info": "Gemini free-tier quota hit. The system tried 3 Gemini models + NVIDIA NIM vision fallback.",
    }


def _to_float(val, default=0.0) -> float:
    """Safely coerce any value to float."""
    try:
        if isinstance(val, dict):
            # pick first numeric value
            for v in val.values():
                try: return float(v)
                except: pass
        return float(val)
    except:
        return default


def _to_list(val) -> list:
    """Safely coerce to list of strings."""
    if isinstance(val, list):
        return [str(x) for x in val]
    if isinstance(val, str):
        return [val]
    return []


def _normalise_crop_recommendations(recs) -> list:
    """Ensure each recommendation has the required fields as strings."""
    if not isinstance(recs, list):
        return []
    fixed = []
    for rec in recs:
        if not isinstance(rec, dict):
            continue
        fixed.append({
            "crop":              _to_str(rec.get("crop") or rec.get("name") or "Unknown"),
            "confidence":        _to_str(rec.get("confidence") or rec.get("suitability") or "Medium"),
            "reason":            _to_str(rec.get("reason") or rec.get("rationale") or "Suitable for conditions"),
            "ideal_season":      _to_str(rec.get("ideal_season") or rec.get("season") or "All seasons"),
            "water_requirement": _to_str(rec.get("water_requirement") or rec.get("water") or "Moderate"),
            "expected_yield":    _to_str(rec.get("expected_yield") or rec.get("yield") or "N/A"),
        })
    return fixed


def get_crop_recommendation(n, p, k, ph, rainfall, temp, humidity, region, language) -> dict:
    prompt = (
        f"You are an expert agricultural advisor. Recommend the top 3 crops for these conditions: "
        f"Nitrogen={n} kg/ha, Phosphorus={p} kg/ha, Potassium={k} kg/ha, pH={ph}, "
        f"Rainfall={rainfall} mm/year, Temperature={temp} deg C, Humidity={humidity}%, Region={region}. "
        f"{_get_language_instruction(language)}. "
        f"Return ONLY valid JSON with: "
        f"'recommendations' (array of 3 objects each with: 'crop' string, 'confidence' string High/Medium/Low, "
        f"'reason' string, 'ideal_season' string, 'water_requirement' string, 'expected_yield' string), "
        f"'soil_health_summary' (string), 'additional_tips' (string)."
    )
    try:
        res_text = _call_nvidia_nim(prompt)
        result = _parse_json_response(res_text)
        return {
            "recommendations":   _normalise_crop_recommendations(result.get("recommendations", [])),
            "soil_health_summary": _to_str(result.get("soil_health_summary", "Soil analysis complete.")),
            "additional_tips":   _to_str(result.get("additional_tips", "Follow recommended practices.")),
        }
    except Exception as e:
        logger.error(f"get_crop_recommendation error: {e}")
        return {"recommendations": [], "soil_health_summary": "Service temporarily unavailable.", "additional_tips": "Please try again."}

def predict_yield(crop_type, region, area_hectares, season, soil_type, irrigation, fertilizer_used, previous_yield, language) -> dict:
    prompt = (
        f"Predict crop yield for {crop_type} grown in {region}, India. "
        f"Farm area: {area_hectares} hectares, Season: {season}, Soil: {soil_type}, "
        f"Irrigation: {irrigation}, Fertilizer: {fertilizer_used}. "
        f"{_get_language_instruction(language)}. "
        f"Return ONLY valid JSON (all numeric values as numbers, not strings): "
        f"'expected_yield_tonnes' (number), 'min_yield_tonnes' (number), 'max_yield_tonnes' (number), "
        f"'yield_per_hectare' (string like '3.5 tonnes/ha'), 'crop' (string), 'region' (string), "
        f"'influencing_factors' (array of strings), 'improvement_tips' (array of strings), "
        f"'risk_factors' (array of strings), 'confidence_level' (string High/Medium/Low)."
    )
    try:
        res_text = _call_nvidia_nim(prompt)
        result = _parse_json_response(res_text)
        return {
            "crop":                  _to_str(result.get("crop", crop_type)),
            "region":                _to_str(result.get("region", region)),
            "min_yield_tonnes":      _to_float(result.get("min_yield_tonnes", 0.0)),
            "max_yield_tonnes":      _to_float(result.get("max_yield_tonnes", 0.0)),
            "expected_yield_tonnes": _to_float(result.get("expected_yield_tonnes", 0.0)),
            "yield_per_hectare":     _to_str(result.get("yield_per_hectare", "N/A")),
            "influencing_factors":   _to_list(result.get("influencing_factors", [])),
            "improvement_tips":      _to_list(result.get("improvement_tips", [])),
            "risk_factors":          _to_list(result.get("risk_factors", [])),
            "confidence_level":      _to_str(result.get("confidence_level", "Medium")),
        }
    except Exception as e:
        logger.error(f"predict_yield error: {e}")
        return {
            "crop": crop_type, "region": region,
            "min_yield_tonnes": 0.0, "max_yield_tonnes": 0.0, "expected_yield_tonnes": 0.0,
            "yield_per_hectare": "N/A", "influencing_factors": [],
            "improvement_tips": [], "risk_factors": [], "confidence_level": "Error",
        }

def _to_str(val) -> str:
    """Coerce any value (dict, list, None) to a string for Pydantic string fields."""
    if val is None:
        return "N/A"
    if isinstance(val, dict):
        # e.g. {"min": 2100, "max": 2400} -> "2100 - 2400"
        parts = [str(v) for v in val.values()]
        return " - ".join(parts) if parts else "N/A"
    if isinstance(val, list):
        return ", ".join(str(x) for x in val) if val else "N/A"
    return str(val)


def _normalise_price_forecast(raw) -> list:
    """Ensure price_forecast is a list of {month, predicted_price, trend} dicts."""
    if not isinstance(raw, list):
        return []
    fixed = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        fixed.append({
            "month":           _to_str(item.get("month") or item.get("period") or item.get("time") or "N/A"),
            "predicted_price": _to_str(item.get("predicted_price") or item.get("price") or item.get("value") or "N/A"),
            "trend":           _to_str(item.get("trend") or item.get("direction") or "stable"),
        })
    return fixed


def forecast_market_price(crop, location, quantity_quintals, current_price, language) -> dict:
    prompt = (
        f"Provide a 6-month market price forecast for {crop} in {location}, India. "
        f"{_get_language_instruction(language)}. "
        f"Return ONLY valid JSON with these exact string fields: "
        f"'current_price_range' (string like '2100-2500 INR/quintal'), "
        f"'predicted_trend' (string), "
        f"'price_forecast' (array of objects each with 'month' string, 'predicted_price' string, 'trend' string), "
        f"'best_selling_window' (string), 'storage_advice' (string), "
        f"'market_demand' (string), 'export_potential' (string), "
        f"'price_factors' (array of strings)."
    )
    try:
        res_text = _call_nvidia_nim(prompt)
        result = _parse_json_response(res_text)

        # Coerce all string fields — Mistral sometimes returns nested objects
        return {
            "crop":               crop,
            "location":          location,
            "current_price_range": _to_str(result.get("current_price_range", "N/A")),
            "predicted_trend":   _to_str(result.get("predicted_trend", "Stable")),
            "price_forecast":    _normalise_price_forecast(result.get("price_forecast", [])),
            "best_selling_window": _to_str(result.get("best_selling_window", "N/A")),
            "storage_advice":    _to_str(result.get("storage_advice", "N/A")),
            "market_demand":     _to_str(result.get("market_demand", "N/A")),
            "export_potential":  _to_str(result.get("export_potential", "N/A")),
            "price_factors":     [str(f) for f in result.get("price_factors", [])] if isinstance(result.get("price_factors"), list) else [],
        }
    except Exception as e:
        logger.error(f"forecast_market_price error: {e}")
        return {
            "crop": crop, "location": location,
            "current_price_range": "N/A", "predicted_trend": "Unavailable",
            "price_forecast": [], "best_selling_window": "N/A",
            "storage_advice": "N/A", "market_demand": "N/A",
            "export_potential": "N/A", "price_factors": [],
        }

def chat_with_agri_expert(message, history, language, context) -> dict:
    """
    Chat using NVIDIA NIM (Mistral). Returns plain-text reply with suggestions.
    Does NOT force JSON mode — Mistral often returns plain text for conversational prompts.
    """
    lang_inst = _get_language_instruction(language)
    sys_prompt = (
        f"You are AgriBot, a friendly and knowledgeable agricultural expert AI assistant. "
        f"{lang_inst} "
        f"Help farmers with crop advice, disease questions, weather planning, market prices, and general farming tips. "
        f"Be concise, practical, and encouraging. If asked unrelated questions, gently redirect to agriculture topics."
    )
    nim_history = [
        {"role": "assistant" if m['role'] == "assistant" else "user", "content": m['content']}
        for m in history[-6:]
    ]
    try:
        # Don't force JSON — let the model respond naturally in plain text
        res_text = _call_nvidia_nim(
            prompt=message,
            system_prompt=sys_prompt,
            history=nim_history,
            json_mode=False,
        )

        # Try to extract JSON if the model chose to return it
        if '{' in res_text and 'reply' in res_text:
            parsed = _parse_json_response(res_text)
            if parsed.get('reply'):
                suggestions = parsed.get('suggestions', [])
                if isinstance(suggestions, list):
                    suggestions = [str(s) for s in suggestions[:4]]
                else:
                    suggestions = []
                return {"reply": parsed['reply'], "suggestions": suggestions}

        # Otherwise treat the raw text as the reply and generate contextual suggestions
        reply_text = res_text.strip()
        suggestions = _generate_chat_suggestions(message, language)
        return {"reply": reply_text, "suggestions": suggestions}

    except Exception as e:
        logger.error(f"Chat failed: {e}")
        return {
            "reply": "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.",
            "suggestions": ["Try asking about crop recommendations", "Ask about disease symptoms", "Check market prices"]
        }


def _generate_chat_suggestions(message: str, language: str) -> list:
    """Return contextual follow-up suggestions based on message keywords."""
    msg_lower = message.lower()
    base = [
        "Tell me about crop rotation",
        "What fertilizers are best?",
        "How to improve soil health?",
        "What crops suit my region?",
    ]
    if any(w in msg_lower for w in ['disease', 'leaf', 'spot', 'blight', 'rot', 'wilt']):
        return ["How to treat Leaf Blight?", "Organic fungicide options", "When to spray pesticides?", "Upload a plant photo"]
    if any(w in msg_lower for w in ['price', 'market', 'sell', 'mandi', 'rate']):
        return ["Best time to sell wheat?", "MSP rates for Kharif crops", "How to store produce?", "Export market opportunities"]
    if any(w in msg_lower for w in ['rain', 'weather', 'monsoon', 'drought', 'flood']):
        return ["Drought-resistant crops", "Irrigation techniques", "Weather-based crop planning", "Rainwater harvesting"]
    if any(w in msg_lower for w in ['yield', 'production', 'harvest', 'growth']):
        return ["Improving yield with fertilizers", "Crop spacing tips", "Irrigation scheduling", "Hybrid vs local seeds"]
    return base
