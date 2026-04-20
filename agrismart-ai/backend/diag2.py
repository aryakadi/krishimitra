"""Quick diagnostic v2 - check market price and disease detection."""
import sys, json
sys.path.insert(0, '.')

from app.services.gemini_service import forecast_market_price, detect_disease_from_image
import base64

print("[3] MARKET PRICE - raw result:")
try:
    r = forecast_market_price("Wheat", "Pune", 10.0, 2200.0, "en")
    # Print without special chars
    print("  predicted_trend:", r.get("predicted_trend", "N/A"))
    print("  current_price_range:", r.get("current_price_range", "N/A").encode('ascii', 'replace').decode())
    print("  price_forecast count:", len(r.get("price_forecast", [])))
    print("  best_selling_window:", r.get("best_selling_window", "N/A"))
    pf = r.get("price_forecast", [])
    if pf:
        print("  first forecast item:", str(pf[0]).encode('ascii', 'replace').decode())
except Exception as e:
    print("  FAIL:", str(e)[:200])

print()
print("[4] DISEASE DETECTION with real tiny image:")
try:
    tiny_png = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    )
    r = detect_disease_from_image(tiny_png, "en")
    print("  disease_name:", r.get("disease_name"))
    print("  confidence:", r.get("confidence"))
    print("  additional_info (error):", str(r.get("additional_info", ""))[:200])
except Exception as e:
    print("  FAIL:", str(e)[:200])
