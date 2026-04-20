import json
import logging
import snowflake.connector
from app.core.config import settings

logger = logging.getLogger(__name__)

def get_snowflake_connection():
    try:
        if not settings.SNOWFLAKE_ACCOUNT or "your_" in settings.SNOWFLAKE_ACCOUNT:
            raise ValueError("Snowflake credentials not configured")
        
        conn = snowflake.connector.connect(
            user=settings.SNOWFLAKE_USER,
            password=settings.SNOWFLAKE_PASSWORD,
            account=settings.SNOWFLAKE_ACCOUNT,
            role=settings.SNOWFLAKE_ROLE,
            warehouse=settings.SNOWFLAKE_WAREHOUSE,
            database=settings.SNOWFLAKE_DATABASE,
            schema=settings.SNOWFLAKE_SCHEMA
        )
        return conn
    except Exception as e:
        logger.warning(f"Failed to connect to Snowflake: {str(e)}")
        return None

def log_crop_recommendation(n: float, p: float, k: float, ph: float, rainfall: float, temp: float, region: str, crops: list, language: str):
    try:
        conn = get_snowflake_connection()
        if not conn: return
        
        cursor = conn.cursor()
        top_crop = crops[0]['crop'] if crops else "None"
        all_recs_json = json.dumps(crops)
        
        query = """
            INSERT INTO FACT_CROP_RECOMMENDATION 
            (nitrogen, phosphorus, potassium, ph_level, rainfall_mm, temperature_c, region, top_recommended_crop, all_recommendations, language)
            SELECT %s, %s, %s, %s, %s, %s, %s, %s, PARSE_JSON(%s), %s
        """
        cursor.execute(query, (n, p, k, ph, rainfall, temp, region, top_crop, all_recs_json, language))
        cursor.close()
        conn.close()
    except Exception as e:
        logger.warning(f"Failed to log crop recommendation to Snowflake: {str(e)}")

def log_disease_detection(disease_name: str, confidence: str, urgency_level: str, language: str):
    try:
        conn = get_snowflake_connection()
        if not conn: return
        
        cursor = conn.cursor()
        query = """
            INSERT INTO FACT_DISEASE_DETECTION 
            (disease_name, confidence_level, urgency_level, language)
            VALUES (%s, %s, %s, %s)
        """
        cursor.execute(query, (disease_name, confidence, urgency_level, language))
        cursor.close()
        conn.close()
    except Exception as e:
        logger.warning(f"Failed to log disease detection to Snowflake: {str(e)}")

def log_query(endpoint: str, request_payload: dict, response_summary: str, language: str, region: str = "Unknown"):
    try:
        conn = get_snowflake_connection()
        if not conn: return
        
        cursor = conn.cursor()
        payload_json = json.dumps(request_payload)
        
        query = """
            INSERT INTO FACT_QUERY_LOGS 
            (endpoint, request_payload, response_summary, language, region)
            SELECT %s, PARSE_JSON(%s), %s, %s, %s
        """
        cursor.execute(query, (endpoint, payload_json, response_summary, language, region))
        cursor.close()
        conn.close()
    except Exception as e:
        logger.warning(f"Failed to log query to Snowflake: {str(e)}")

def get_regional_crop_stats(region: str) -> list:
    try:
        conn = get_snowflake_connection()
        if not conn: return []
        
        cursor = conn.cursor()
        query = """
            SELECT top_recommended_crop, count(*) as count
            FROM FACT_CROP_RECOMMENDATION
            WHERE region = %s
            GROUP BY top_recommended_crop
            ORDER BY count DESC
            LIMIT 5
        """
        cursor.execute(query, (region,))
        results = [{"crop": row[0], "count": row[1]} for row in cursor.fetchall()]
        cursor.close()
        conn.close()
        return results
    except Exception as e:
        logger.warning(f"Failed to fetch regional crop stats: {str(e)}")
        return []

def get_analytics_summary() -> dict:
    try:
        conn = get_snowflake_connection()
        if not conn: 
            return {"error": "Snowflake not connected"}
        
        cursor = conn.cursor()
        
        # 1. Most detected diseases this week
        cursor.execute("""
            SELECT disease_name, count(*) as count
            FROM FACT_DISEASE_DETECTION
            WHERE created_at >= CURRENT_DATE() - 7
            GROUP BY disease_name
            ORDER BY count DESC
            LIMIT 5
        """)
        diseases = [{"name": row[0], "count": row[1]} for row in cursor.fetchall()]
        
        # 2. Most recommended crops across all regions
        cursor.execute("""
            SELECT top_recommended_crop, count(*) as count
            FROM FACT_CROP_RECOMMENDATION
            WHERE top_recommended_crop != 'None' AND top_recommended_crop IS NOT NULL
            GROUP BY top_recommended_crop
            ORDER BY count DESC
            LIMIT 5
        """)
        crops = [{"crop": row[0], "count": row[1]} for row in cursor.fetchall()]
        
        # 3. Usage counts per feature
        # Get counts from specific fact tables
        cursor.execute("SELECT count(*) FROM FACT_CROP_RECOMMENDATION")
        crop_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT count(*) FROM FACT_DISEASE_DETECTION")
        disease_count = cursor.fetchone()[0]
        
        # Get counts from general query logs
        cursor.execute("""
            SELECT endpoint, count(*) as count
            FROM FACT_QUERY_LOGS
            GROUP BY endpoint
        """)
        query_logs = cursor.fetchall()
        
        usage = [
            {"feature": "Crop Rec", "uses": crop_count},
            {"feature": "Disease Detect", "uses": disease_count}
        ]
        
        for endpoint, count in query_logs:
            feat_name = endpoint.replace("/api/v1/", "").replace("/", " ").title()
            # If endpoint starts with / (like /yield-prediction), clean it up
            if endpoint.startswith("/"):
                feat_name = endpoint[1:].replace("-", " ").title()
            usage.append({"feature": feat_name, "uses": count})
            
        cursor.close()
        conn.close()
        
        return {
            "top_diseases": diseases,
            "top_crops": crops,
            "feature_usage": sorted(usage, key=lambda x: x["uses"], reverse=True)
        }
    except Exception as e:
        logger.error(f"Failed to fetch analytics summary: {str(e)}")
        return {
            "top_diseases": [],
            "top_crops": [],
            "feature_usage": []
        }
