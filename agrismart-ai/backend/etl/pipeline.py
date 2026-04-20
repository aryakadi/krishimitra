"""
AgriSmart AI — Modular ETL Pipeline
====================================
Implements a full Extract → Transform → Load workflow for ingesting
agricultural data into Snowflake fact and dimension tables.

Usage:
    from etl.pipeline import ETLPipeline
    pipeline = ETLPipeline(conn)
    pipeline.run("weather", raw_data)
    pipeline.run("prediction", raw_data)
    pipeline.run("market", raw_data)
"""

import json
import logging
from datetime import datetime
from typing import Any, Optional

logger = logging.getLogger(__name__)


# =============================================================================
# EXTRACTOR
# =============================================================================

class Extractor:
    """
    Extracts raw data from various sources:
    - User input dictionaries
    - OpenWeatherMap API response JSON
    - ML model output dictionaries
    """

    @staticmethod
    def from_user_input(data: dict) -> dict:
        """Extract and tag fields from a user form submission."""
        return {
            "_source": "user_input",
            "_extracted_at": datetime.utcnow().isoformat(),
            **data
        }

    @staticmethod
    def from_weather_api(api_response: dict) -> dict:
        """
        Extract relevant fields from OpenWeatherMap current weather response.
        Handles both /weather and /forecast endpoints.
        """
        try:
            main = api_response.get("main", {})
            wind = api_response.get("wind", {})
            weather_list = api_response.get("weather", [{}])
            rain = api_response.get("rain", {})

            return {
                "_source": "openweathermap",
                "_extracted_at": datetime.utcnow().isoformat(),
                "city_name":    api_response.get("name", ""),
                "temperature":  main.get("temp", 0.0),
                "feels_like":   main.get("feels_like", 0.0),
                "humidity":     main.get("humidity", 0.0),
                "pressure":     main.get("pressure", 0.0),
                "wind_speed":   wind.get("speed", 0.0),
                "rainfall_1h":  rain.get("1h", 0.0),
                "weather_desc": weather_list[0].get("description", "") if weather_list else "",
                "country":      api_response.get("sys", {}).get("country", "IN"),
                "lat":          api_response.get("coord", {}).get("lat", 0.0),
                "lon":          api_response.get("coord", {}).get("lon", 0.0),
            }
        except Exception as e:
            logger.error(f"Extractor.from_weather_api error: {e}")
            return {"_source": "openweathermap", "_error": str(e)}

    @staticmethod
    def from_ml_output(model_name: str, prediction_type: str, output: dict) -> dict:
        """Extract fields from an ML model's output dictionary."""
        return {
            "_source": f"ml_{model_name}",
            "_extracted_at": datetime.utcnow().isoformat(),
            "model_used": model_name,
            "prediction_type": prediction_type,
            **output
        }


# =============================================================================
# TRANSFORMER
# =============================================================================

class Transformer:
    """
    Cleans, normalises, and engineers features from extracted raw data.
    """

    MISSING_DEFAULTS = {
        "temperature": 25.0,
        "humidity": 60.0,
        "rainfall": 0.0,
        "wind_speed": 0.0,
        "nitrogen": 80.0,
        "phosphorus": 40.0,
        "potassium": 40.0,
        "ph_level": 7.0,
        "area_hectares": 1.0,
        "confidence_score": 0.5,
        "historical_price": 0.0,
        "predicted_price": 0.0,
    }

    @classmethod
    def clean_missing(cls, data: dict) -> dict:
        """
        Fill missing numeric fields with sensible defaults.
        Removes None values for string fields where possible.
        """
        cleaned = {}
        for key, value in data.items():
            if value is None or value == "":
                default = cls.MISSING_DEFAULTS.get(key)
                cleaned[key] = default if default is not None else value
            else:
                cleaned[key] = value
        return cleaned

    @staticmethod
    def normalize_units(data: dict) -> dict:
        """
        Normalise unit inconsistencies:
        - Temperature: if > 60, assume Fahrenheit → convert to Celsius
        - Area: if 'area_acres' key present → convert to hectares
        - Rainfall: ensure mm (not cm)
        """
        normalized = dict(data)

        # Temperature
        if "temperature" in normalized:
            temp = float(normalized["temperature"] or 0)
            if temp > 60:
                normalized["temperature"] = round((temp - 32) * 5 / 9, 2)

        # Area conversion
        if "area_acres" in normalized and "area_hectares" not in normalized:
            normalized["area_hectares"] = round(float(normalized.pop("area_acres", 0)) * 0.404686, 3)

        # Rainfall in cm → mm
        if "rainfall_cm" in normalized:
            normalized["rainfall"] = round(float(normalized.pop("rainfall_cm", 0)) * 10, 2)

        # Pressure: Pascal → hPa (if unreasonably large)
        if "pressure" in normalized and float(normalized.get("pressure", 0)) > 2000:
            normalized["pressure"] = round(float(normalized["pressure"]) / 100, 2)

        return normalized

    @staticmethod
    def feature_engineer(data: dict) -> dict:
        """
        Add derived features useful for analytics:
        - npk_ratio: total nutrient load
        - rainfall_category: Low/Medium/High/Very High
        - soil_fertility_score: composite 0-100
        - humidity_category
        """
        engineered = dict(data)

        # NPK ratio
        n = float(data.get("nitrogen", 0) or 0)
        p = float(data.get("phosphorus", 0) or 0)
        k = float(data.get("potassium", 0) or 0)
        engineered["npk_total"] = round(n + p + k, 2)
        engineered["npk_ratio"] = f"{int(n)}:{int(p)}:{int(k)}" if (n + p + k) > 0 else "N/A"

        # Rainfall category
        rain = float(data.get("rainfall", data.get("rainfall_mm", 0)) or 0)
        if rain < 300:
            engineered["rainfall_category"] = "Low"
        elif rain < 700:
            engineered["rainfall_category"] = "Medium"
        elif rain < 1200:
            engineered["rainfall_category"] = "High"
        else:
            engineered["rainfall_category"] = "Very High"

        # Soil fertility score (rough composite)
        ph = float(data.get("ph_level", 7.0) or 7.0)
        ph_score = max(0, 100 - abs(ph - 6.8) * 15)
        npk_score = min(100, (n + p + k) / 4)
        engineered["soil_fertility_score"] = round((ph_score + npk_score) / 2, 1)

        # Humidity category
        hum = float(data.get("humidity", 0) or 0)
        if hum < 30:
            engineered["humidity_category"] = "Low"
        elif hum < 60:
            engineered["humidity_category"] = "Moderate"
        elif hum < 80:
            engineered["humidity_category"] = "High"
        else:
            engineered["humidity_category"] = "Very High"

        return engineered

    @classmethod
    def transform(cls, data: dict) -> dict:
        """Full transformation pipeline: clean → normalize → engineer."""
        data = cls.clean_missing(data)
        data = cls.normalize_units(data)
        data = cls.feature_engineer(data)
        logger.debug(f"Transformed data keys: {list(data.keys())}")
        return data


# =============================================================================
# LOADER
# =============================================================================

class Loader:
    """
    Loads transformed data into Snowflake fact tables.
    Each method handles one target table.
    """

    def __init__(self, conn):
        self.conn = conn

    def _execute(self, query: str, params: tuple):
        """Execute a parameterised query, logging errors without raising."""
        try:
            cursor = self.conn.cursor()
            cursor.execute(query, params)
            cursor.close()
            return True
        except Exception as e:
            logger.error(f"Loader._execute error: {e}\nQuery: {query[:200]}")
            return False

    def load_weather(self, data: dict, city: str = "", location_id: Optional[int] = None) -> bool:
        """Load weather observation into FACT_WEATHER."""
        query = """
            INSERT INTO FACT_WEATHER
                (location_id, temperature, humidity, rainfall, wind_speed, weather_desc, city_name)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        params = (
            location_id,
            data.get("temperature", 25.0),
            data.get("humidity", 60.0),
            data.get("rainfall", data.get("rainfall_1h", 0.0)),
            data.get("wind_speed", 0.0),
            data.get("weather_desc", ""),
            city or data.get("city_name", ""),
        )
        return self._execute(query, params)

    def load_prediction(
        self,
        prediction_type: str,
        predicted_value: Any,
        confidence_score: float,
        model_used: str,
        language: str = "en",
        region: str = "Unknown",
        crop_id: Optional[int] = None,
        location_id: Optional[int] = None,
        user_id: Optional[str] = None,
    ) -> Optional[int]:
        """Load a prediction record into FACT_PREDICTIONS and return its ID."""
        try:
            cursor = self.conn.cursor()
            query = """
                INSERT INTO FACT_PREDICTIONS
                    (prediction_type, predicted_value, confidence_score, model_used,
                     language, region, crop_id, location_id, user_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            value_str = (
                json.dumps(predicted_value)
                if isinstance(predicted_value, (dict, list))
                else str(predicted_value)
            )
            cursor.execute(query, (
                prediction_type, value_str, confidence_score, model_used,
                language, region, crop_id, location_id, user_id
            ))
            # Fetch the auto-generated ID
            cursor.execute("SELECT MAX(prediction_id) FROM FACT_PREDICTIONS")
            row = cursor.fetchone()
            cursor.close()
            return row[0] if row else None
        except Exception as e:
            logger.error(f"Loader.load_prediction error: {e}")
            return None

    def load_market(
        self,
        historical_price: float,
        predicted_price: float,
        demand: str,
        supply: str,
        trend: str,
        crop_id: Optional[int] = None,
        location_id: Optional[int] = None,
    ) -> bool:
        """Load market price record into FACT_MARKET."""
        query = """
            INSERT INTO FACT_MARKET
                (crop_id, location_id, historical_price, predicted_price, demand, supply, trend)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        return self._execute(query, (
            crop_id, location_id, historical_price, predicted_price, demand, supply, trend
        ))

    def update_actual_result(self, prediction_id: int, actual_value: str) -> bool:
        """Update a prediction with the actual observed value (feedback loop)."""
        query = """
            UPDATE FACT_PREDICTIONS
            SET actual_value = %s, feedback_at = CURRENT_TIMESTAMP()
            WHERE prediction_id = %s
        """
        return self._execute(query, (actual_value, prediction_id))


# =============================================================================
# PIPELINE ORCHESTRATOR
# =============================================================================

class ETLPipeline:
    """
    High-level orchestrator that chains Extractor → Transformer → Loader.

    Usage:
        conn = get_snowflake_connection()
        pipeline = ETLPipeline(conn)
        pipeline.run_weather(api_response, city="Nagpur")
        pipeline.run_prediction("crop_rec", result_dict, confidence=0.9, model="nvidia-nim")
    """

    def __init__(self, conn=None):
        self.conn = conn
        self.loader = Loader(conn) if conn else None
        self.transformer = Transformer()

    def _no_conn(self, operation: str):
        logger.warning(f"ETLPipeline: Snowflake not connected, skipping {operation}")

    def run_weather(self, api_response: dict, city: str = "", location_id: Optional[int] = None) -> bool:
        """Full ETL for a weather API response."""
        if not self.conn:
            self._no_conn("weather load")
            return False
        raw = Extractor.from_weather_api(api_response)
        transformed = Transformer.transform(raw)
        return self.loader.load_weather(transformed, city=city, location_id=location_id)

    def run_prediction(
        self,
        prediction_type: str,
        model_output: dict,
        predicted_value: Any,
        confidence_score: float = 0.75,
        model_used: str = "unknown",
        language: str = "en",
        region: str = "Unknown",
    ) -> Optional[int]:
        """Full ETL for an ML/AI prediction result."""
        if not self.conn:
            self._no_conn("prediction load")
            return None
        raw = Extractor.from_ml_output(model_used, prediction_type, model_output)
        transformed = Transformer.transform(raw)
        return self.loader.load_prediction(
            prediction_type=prediction_type,
            predicted_value=predicted_value,
            confidence_score=confidence_score,
            model_used=model_used,
            language=language,
            region=region,
        )

    def run_market(
        self,
        price_data: dict,
        historical_price: float = 0.0,
        predicted_price: float = 0.0,
        demand: str = "Medium",
        supply: str = "Medium",
        trend: str = "stable",
    ) -> bool:
        """Full ETL for a market price record."""
        if not self.conn:
            self._no_conn("market load")
            return False
        raw = Extractor.from_user_input(price_data)
        transformed = Transformer.transform(raw)
        return self.loader.load_market(
            historical_price=historical_price,
            predicted_price=predicted_price,
            demand=demand,
            supply=supply,
            trend=trend,
        )

    def run_feedback(self, prediction_id: int, actual_value: str) -> bool:
        """Update a prediction's actual outcome for feedback loop."""
        if not self.conn or not self.loader:
            self._no_conn("feedback update")
            return False
        return self.loader.update_actual_result(prediction_id, actual_value)
