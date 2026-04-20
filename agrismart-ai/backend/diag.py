"""Quick diagnostic — tests all 4 prediction features."""
import sys, json
sys.path.insert(0, '.')

from app.services.gemini_service import (
    get_crop_recommendation,
    detect_disease_from_image,
    predict_yield,
    forecast_market_price,
)

print("=" * 60)

# 1. Crop Recommendation
print("\n[1] CROP RECOMMENDATION")
try:
    r = get_crop_recommendation(90, 42, 43, 6.5, 202, 25, 65, "Maharashtra", "en")
    recs = r.get("recommendations", [])
    print(f"  OK — {len(recs)} recommendations, first: {recs[0].get('crop') if recs else 'none'}")
    print(f"  soil_health_summary: {str(r.get('soil_health_summary',''))[:80]}")
except Exception as e:
    print(f"  FAIL: {e}")

# 2. Yield Prediction
print("\n[2] YIELD PREDICTION")
try:
    r = predict_yield("Wheat", "Punjab", 5.0, "Rabi", "Loamy", "Drip", "Urea", 3.5, "en")
    print(f"  OK — expected={r.get('expected_yield_tonnes')} t, range={r.get('min_yield_tonnes')}-{r.get('max_yield_tonnes')}")
    print(f"  confidence: {r.get('confidence_level')}")
except Exception as e:
    print(f"  FAIL: {e}")

# 3. Market Price
print("\n[3] MARKET PRICE")
try:
    r = forecast_market_price("Wheat", "Pune", 10.0, 2200.0, "en")
    print(f"  OK — trend={r.get('predicted_trend')}, range={r.get('current_price_range')}")
    print(f"  forecast items: {len(r.get('price_forecast', []))}")
except Exception as e:
    print(f"  FAIL: {e}")

# 4. Disease Detection (using a tiny 1x1 green PNG)
print("\n[4] DISEASE DETECTION")
try:
    import base64
    tiny_png = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    )
    r = detect_disease_from_image(tiny_png, "en")
    print(f"  OK — disease={r.get('disease_name')}, confidence={r.get('confidence')}")
except Exception as e:
    print(f"  FAIL: {e}")

print("\n" + "=" * 60)
