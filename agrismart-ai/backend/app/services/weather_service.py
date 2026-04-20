import httpx
import logging

logger = logging.getLogger(__name__)

# OpenStreetMap's extremely detailed geocoding API (contains every small village)
GEO_URL = "https://nominatim.openstreetmap.org/search"
REVERSE_GEO_URL = "https://nominatim.openstreetmap.org/reverse"
# Open-Meteo weather API (works for any exact coordinates)
WEATHER_URL = "https://api.open-meteo.com/v1/forecast"

WEATHER_CODES = {
    0: ("Clear sky", "01d"),
    1: ("Mainly clear", "02d"),
    2: ("Partly cloudy", "03d"),
    3: ("Overcast", "04d"),
    45: ("Fog", "50d"),
    48: ("Depositing rime fog", "50d"),
    51: ("Light drizzle", "09d"),
    53: ("Moderate drizzle", "09d"),
    55: ("Dense drizzle", "09d"),
    61: ("Slight rain", "10d"),
    63: ("Moderate rain", "10d"),
    65: ("Heavy rain", "10d"),
    71: ("Slight snow", "13d"),
    73: ("Moderate snow", "13d"),
    75: ("Heavy snow", "13d"),
    95: ("Thunderstorm", "11d")
}

def _get_weather_info(code: int) -> tuple:
    return WEATHER_CODES.get(code, ("Unknown", "03d"))

def _fetch_weather(lat: float, lon: float, city: str = "Unknown", country: str = "") -> dict:
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
        "timezone": "auto"
    }

    with httpx.Client(timeout=10.0) as client:
        resp = client.get(WEATHER_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

        current = data["current"]
        daily = data["daily"]
        
        desc, icon = _get_weather_info(current["weather_code"])
        
        rainfall_total = sum(daily["precipitation_sum"][:5])
        
        daily_forecasts = []
        for i in range(5):
            d_desc, d_icon = _get_weather_info(daily["weather_code"][i])
            daily_forecasts.append({
                "date": daily["time"][i],
                "temp": round((daily["temperature_2m_max"][i] + daily["temperature_2m_min"][i]) / 2, 1),
                "humidity": current["relative_humidity_2m"],
                "description": d_desc,
                "icon": d_icon,
            })

        return {
            "city": city,
            "country": country,
            "temperature": current["temperature_2m"],
            "feels_like": current["apparent_temperature"],
            "humidity": current["relative_humidity_2m"],
            "rainfall_5day_mm": round(rainfall_total, 1),
            "weather_description": desc,
            "icon": icon,
            "wind_speed_kmh": current["wind_speed_10m"],
            "forecast": daily_forecasts,
        }

def get_weather_by_city(city: str) -> dict:
    # 1. Geocode the city using OpenStreetMap (Nominatim)
    # Requires a custom User-Agent to comply with their free usage policy
    headers = {"User-Agent": "AgriSmart-AI-App"}
    params = {"q": city, "format": "json", "limit": 1}
    
    with httpx.Client(timeout=10.0, headers=headers) as client:
        geo_resp = client.get(GEO_URL, params=params)
        geo_resp.raise_for_status()
        
        results = geo_resp.json()
        if not results:
            raise ValueError(f"Location '{city}' not found. Please try a nearby town or district.")
            
        location = results[0]
        lat = float(location["lat"])
        lon = float(location["lon"])
        
        # Extract a more detailed 2-part name (e.g., "Ralegan Siddhi, Ahmednagar")
        full_name = location.get("display_name", "")
        if full_name:
            parts = [p.strip() for p in full_name.split(",")]
            resolved_city = f"{parts[0]}, {parts[1]}" if len(parts) > 1 else parts[0]
            country = parts[-1] if len(parts) > 0 else "India"
        else:
            resolved_city = city
            country = "India"

    # 2. Fetch the weather using exact coordinates via Open-Meteo
    return _fetch_weather(lat, lon, resolved_city, country)

def get_weather_by_coords(lat: float, lon: float) -> dict:
    # 1. Reverse Geocode to get the actual city/village name
    headers = {"User-Agent": "AgriSmart-AI-App"}
    params = {"lat": lat, "lon": lon, "format": "json"}
    
    city_name = "Detected Location"
    country_name = ""
    
    try:
        with httpx.Client(timeout=5.0, headers=headers) as client:
            resp = client.get(REVERSE_GEO_URL, params=params)
            if resp.status_code == 200:
                data = resp.json()
                address = data.get("address", {})
                
                # Try to get the very specific local block
                local_level = (
                    address.get("village") or 
                    address.get("hamlet") or
                    address.get("neighbourhood") or
                    address.get("suburb") or
                    data.get("name")
                )
                
                # Try to get the broader city/town/district
                city_level = (
                    address.get("town") or 
                    address.get("city") or 
                    address.get("county") or 
                    address.get("state_district")
                )
                
                # Combine them beautifully (e.g. "Kasba Peth, Pune" or "Ralegan, Ahmednagar")
                if local_level and city_level and local_level != city_level:
                    city_name = f"{local_level}, {city_level}"
                elif city_level:
                    city_name = city_level
                elif local_level:
                    city_name = local_level
                else:
                    # Fallback to the first two parts of the full display name
                    city_name = ", ".join(data.get("display_name", "Detected Location").split(",")[:2])
                    
                country_name = address.get("country", "")
    except Exception as e:
        logger.warning(f"Reverse geocode failed: {e}")

    # 2. Fetch Weather
    return _fetch_weather(lat, lon, city_name, country_name)

def search_cities(query: str) -> list:
    """Returns a list of location suggestions from OpenStreetMap based on partial input."""
    headers = {"User-Agent": "AgriSmart-AI-App"}
    params = {"q": query, "format": "json", "limit": 5, "featuretype": "settlement"}
    
    try:
        with httpx.Client(timeout=5.0, headers=headers) as client:
            resp = client.get(GEO_URL, params=params)
            resp.raise_for_status()
            
            results = []
            for loc in resp.json():
                # Clean up the display name for UI
                display_name = loc.get("display_name", "")
                if display_name:
                    results.append({
                        "name": display_name,
                        "lat": float(loc["lat"]),
                        "lon": float(loc["lon"])
                    })
            return results
    except Exception as e:
        logger.warning(f"Error fetching city suggestions: {e}")
        return []

