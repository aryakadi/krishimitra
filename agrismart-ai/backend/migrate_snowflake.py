"""
AgriSmart AI — Snowflake Privilege Fix + Migration
===================================================
First grants SYSADMIN full privileges on the schema,
then creates all missing tables and materialized views.
"""
import logging
from app.services.snowflake_service import get_snowflake_connection

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

# Step 1: Grant statements (run as SYSADMIN to grant to itself on the DB/schema)
GRANT_STATEMENTS = [
    "GRANT ALL PRIVILEGES ON DATABASE AGRISMART_DB TO ROLE SYSADMIN",
    "GRANT ALL PRIVILEGES ON SCHEMA AGRISMART_DB.AGRI_SCHEMA TO ROLE SYSADMIN",
    "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA AGRISMART_DB.AGRI_SCHEMA TO ROLE SYSADMIN",
    "GRANT ALL PRIVILEGES ON FUTURE TABLES IN SCHEMA AGRISMART_DB.AGRI_SCHEMA TO ROLE SYSADMIN",
]

# Step 2: Create missing tables + MVs
CREATE_STATEMENTS = [
    ("DIM_LOCATION", """
        CREATE TABLE IF NOT EXISTS AGRISMART_DB.AGRI_SCHEMA.DIM_LOCATION (
            location_id   INTEGER AUTOINCREMENT PRIMARY KEY,
            state         VARCHAR(100),
            district      VARCHAR(100),
            region        VARCHAR(100),
            climate_zone  VARCHAR(50),
            created_at    TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
        )
    """),
    ("DIM_TIME", """
        CREATE TABLE IF NOT EXISTS AGRISMART_DB.AGRI_SCHEMA.DIM_TIME (
            time_id      INTEGER AUTOINCREMENT PRIMARY KEY,
            full_date    DATE,
            day          INTEGER,
            month        INTEGER,
            year         INTEGER,
            quarter      INTEGER,
            week         INTEGER,
            season_label VARCHAR(20)
        )
    """),
    ("DIM_USER", """
        CREATE TABLE IF NOT EXISTS AGRISMART_DB.AGRI_SCHEMA.DIM_USER (
            user_id    INTEGER AUTOINCREMENT PRIMARY KEY,
            name       VARCHAR(200),
            language   VARCHAR(10) DEFAULT 'en',
            region     VARCHAR(100),
            created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
        )
    """),
    ("FACT_PREDICTIONS", """
        CREATE TABLE IF NOT EXISTS AGRISMART_DB.AGRI_SCHEMA.FACT_PREDICTIONS (
            prediction_id    INTEGER AUTOINCREMENT PRIMARY KEY,
            prediction_type  VARCHAR(30),
            predicted_value  VARCHAR(500),
            actual_value     VARCHAR(500),
            confidence_score FLOAT,
            model_used       VARCHAR(100),
            language         VARCHAR(10) DEFAULT 'en',
            region           VARCHAR(100),
            feedback_at      TIMESTAMP_NTZ,
            created_at       TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
        )
    """),
    ("FACT_WEATHER", """
        CREATE TABLE IF NOT EXISTS AGRISMART_DB.AGRI_SCHEMA.FACT_WEATHER (
            weather_id    INTEGER AUTOINCREMENT PRIMARY KEY,
            city          VARCHAR(100),
            temperature   FLOAT,
            feels_like    FLOAT,
            humidity      INTEGER,
            wind_speed    FLOAT,
            description   VARCHAR(200),
            rainfall_5day FLOAT,
            created_at    TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
        )
    """),
    ("FACT_MARKET", """
        CREATE TABLE IF NOT EXISTS AGRISMART_DB.AGRI_SCHEMA.FACT_MARKET (
            market_id        INTEGER AUTOINCREMENT PRIMARY KEY,
            crop_name        VARCHAR(100),
            location         VARCHAR(200),
            historical_price FLOAT,
            demand           VARCHAR(50),
            supply           VARCHAR(50),
            recorded_on      DATE,
            created_at       TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
        )
    """),
]

# Step 3: Add missing columns to existing tables (all safe ALTER TABLE IF NOT EXISTS)
ALTER_STATEMENTS = [
    "ALTER TABLE FACT_CROP_RECOMMENDATION ADD COLUMN IF NOT EXISTS prediction_id    INTEGER",
    "ALTER TABLE FACT_CROP_RECOMMENDATION ADD COLUMN IF NOT EXISTS nitrogen          FLOAT",
    "ALTER TABLE FACT_CROP_RECOMMENDATION ADD COLUMN IF NOT EXISTS phosphorus        FLOAT",
    "ALTER TABLE FACT_CROP_RECOMMENDATION ADD COLUMN IF NOT EXISTS potassium         FLOAT",
    "ALTER TABLE FACT_CROP_RECOMMENDATION ADD COLUMN IF NOT EXISTS ph_level          FLOAT",
    "ALTER TABLE FACT_CROP_RECOMMENDATION ADD COLUMN IF NOT EXISTS rainfall_mm       FLOAT",
    "ALTER TABLE FACT_CROP_RECOMMENDATION ADD COLUMN IF NOT EXISTS temperature_c     FLOAT",
    "ALTER TABLE FACT_CROP_RECOMMENDATION ADD COLUMN IF NOT EXISTS region            VARCHAR(200)",
    "ALTER TABLE FACT_CROP_RECOMMENDATION ADD COLUMN IF NOT EXISTS top_recommended_crop VARCHAR(100)",
    "ALTER TABLE FACT_CROP_RECOMMENDATION ADD COLUMN IF NOT EXISTS all_recommendations VARIANT",
    "ALTER TABLE FACT_CROP_RECOMMENDATION ADD COLUMN IF NOT EXISTS language          VARCHAR(10)",
    "ALTER TABLE FACT_DISEASE_DETECTION   ADD COLUMN IF NOT EXISTS prediction_id     INTEGER",
    "ALTER TABLE FACT_DISEASE_DETECTION   ADD COLUMN IF NOT EXISTS disease_name      VARCHAR(200)",
    "ALTER TABLE FACT_DISEASE_DETECTION   ADD COLUMN IF NOT EXISTS confidence_level  VARCHAR(20)",
    "ALTER TABLE FACT_DISEASE_DETECTION   ADD COLUMN IF NOT EXISTS urgency_level     VARCHAR(20)",
    "ALTER TABLE FACT_DISEASE_DETECTION   ADD COLUMN IF NOT EXISTS language          VARCHAR(10)",
    "ALTER TABLE FACT_DISEASE_DETECTION   ADD COLUMN IF NOT EXISTS region            VARCHAR(200)",
    "ALTER TABLE FACT_YIELD_PREDICTION    ADD COLUMN IF NOT EXISTS prediction_id     INTEGER",
    "ALTER TABLE FACT_YIELD_PREDICTION    ADD COLUMN IF NOT EXISTS crop_name         VARCHAR(100)",
    "ALTER TABLE FACT_YIELD_PREDICTION    ADD COLUMN IF NOT EXISTS region            VARCHAR(200)",
    "ALTER TABLE FACT_YIELD_PREDICTION    ADD COLUMN IF NOT EXISTS area_hectares     FLOAT",
    "ALTER TABLE FACT_YIELD_PREDICTION    ADD COLUMN IF NOT EXISTS season            VARCHAR(20)",
    "ALTER TABLE FACT_YIELD_PREDICTION    ADD COLUMN IF NOT EXISTS min_yield         FLOAT",
    "ALTER TABLE FACT_YIELD_PREDICTION    ADD COLUMN IF NOT EXISTS max_yield         FLOAT",
    "ALTER TABLE FACT_YIELD_PREDICTION    ADD COLUMN IF NOT EXISTS expected_yield    FLOAT",
    "ALTER TABLE FACT_YIELD_PREDICTION    ADD COLUMN IF NOT EXISTS confidence_level  VARCHAR(20)",
    "ALTER TABLE FACT_YIELD_PREDICTION    ADD COLUMN IF NOT EXISTS language          VARCHAR(10)",
    "ALTER TABLE FACT_PRICE_FORECAST      ADD COLUMN IF NOT EXISTS prediction_id     INTEGER",
    "ALTER TABLE FACT_PRICE_FORECAST      ADD COLUMN IF NOT EXISTS crop_name         VARCHAR(100)",
    "ALTER TABLE FACT_PRICE_FORECAST      ADD COLUMN IF NOT EXISTS location          VARCHAR(200)",
    "ALTER TABLE FACT_PRICE_FORECAST      ADD COLUMN IF NOT EXISTS predicted_trend   VARCHAR(50)",
    "ALTER TABLE FACT_PRICE_FORECAST      ADD COLUMN IF NOT EXISTS price_forecast    VARIANT",
    "ALTER TABLE FACT_PRICE_FORECAST      ADD COLUMN IF NOT EXISTS language          VARCHAR(10)",
    "ALTER TABLE FACT_QUERY_LOGS          ADD COLUMN IF NOT EXISTS endpoint          VARCHAR(200)",
    "ALTER TABLE FACT_QUERY_LOGS          ADD COLUMN IF NOT EXISTS request_payload   VARIANT",
    "ALTER TABLE FACT_QUERY_LOGS          ADD COLUMN IF NOT EXISTS response_summary  VARCHAR(500)",
    "ALTER TABLE FACT_QUERY_LOGS          ADD COLUMN IF NOT EXISTS language          VARCHAR(10)",
    "ALTER TABLE FACT_QUERY_LOGS          ADD COLUMN IF NOT EXISTS region            VARCHAR(200)",
]

# Step 4: Materialized Views (use ACCOUNTADMIN-compatible simple views if MVs fail)
MV_STATEMENTS = [
    ("MV_CROP_TRENDS", """
        CREATE OR REPLACE MATERIALIZED VIEW AGRISMART_DB.AGRI_SCHEMA.MV_CROP_TRENDS AS
        SELECT
            COALESCE(top_recommended_crop, 'Unknown') AS crop_name,
            COALESCE(region, 'Unknown')               AS region,
            DATE_TRUNC('month', COALESCE(created_at, CURRENT_TIMESTAMP())) AS month,
            COUNT(*)                                  AS recommendation_count,
            AVG(COALESCE(temperature_c, 25))          AS avg_temperature,
            AVG(COALESCE(rainfall_mm, 0))             AS avg_rainfall
        FROM AGRISMART_DB.AGRI_SCHEMA.FACT_CROP_RECOMMENDATION
        WHERE top_recommended_crop IS NOT NULL
        GROUP BY 1, 2, 3
    """),
    ("MV_DISEASE_FREQ", """
        CREATE OR REPLACE MATERIALIZED VIEW AGRISMART_DB.AGRI_SCHEMA.MV_DISEASE_FREQ AS
        SELECT
            COALESCE(disease_name, 'Unknown') AS disease_name,
            COALESCE(region, 'Unknown')       AS region,
            DATE_TRUNC('month', COALESCE(created_at, CURRENT_TIMESTAMP())) AS month,
            COUNT(*)                          AS detection_count,
            COUNT(CASE WHEN urgency_level = 'critical' THEN 1 END) AS critical_count
        FROM AGRISMART_DB.AGRI_SCHEMA.FACT_DISEASE_DETECTION
        GROUP BY 1, 2, 3
    """),
    ("MV_YIELD_COMPARISON", """
        CREATE OR REPLACE MATERIALIZED VIEW AGRISMART_DB.AGRI_SCHEMA.MV_YIELD_COMPARISON AS
        SELECT
            COALESCE(crop_name, 'Unknown') AS crop_name,
            COALESCE(region, 'Unknown')    AS region,
            COALESCE(season, 'Unknown')    AS season,
            AVG(COALESCE(expected_yield, 0)) AS avg_yield,
            MIN(COALESCE(min_yield, 0))      AS min_yield_recorded,
            MAX(COALESCE(max_yield, 0))      AS max_yield_recorded,
            COUNT(*)                         AS prediction_count
        FROM AGRISMART_DB.AGRI_SCHEMA.FACT_YIELD_PREDICTION
        GROUP BY 1, 2, 3
    """),
]

# Fallback: regular VIEWs if MV creation fails (no enterprise feature needed)
VIEW_FALLBACKS = [
    ("VW_CROP_TRENDS", """
        CREATE OR REPLACE VIEW AGRISMART_DB.AGRI_SCHEMA.MV_CROP_TRENDS AS
        SELECT
            COALESCE(top_recommended_crop, 'Unknown') AS crop_name,
            COALESCE(region, 'Unknown')               AS region,
            DATE_TRUNC('month', COALESCE(created_at, CURRENT_TIMESTAMP())) AS month,
            COUNT(*)                                  AS recommendation_count,
            AVG(COALESCE(temperature_c, 25))          AS avg_temperature,
            AVG(COALESCE(rainfall_mm, 0))             AS avg_rainfall
        FROM AGRISMART_DB.AGRI_SCHEMA.FACT_CROP_RECOMMENDATION
        WHERE top_recommended_crop IS NOT NULL
        GROUP BY 1, 2, 3
    """),
    ("VW_DISEASE_FREQ", """
        CREATE OR REPLACE VIEW AGRISMART_DB.AGRI_SCHEMA.MV_DISEASE_FREQ AS
        SELECT
            COALESCE(disease_name, 'Unknown')  AS disease_name,
            COALESCE(region, 'Unknown')        AS region,
            DATE_TRUNC('month', COALESCE(created_at, CURRENT_TIMESTAMP())) AS month,
            COUNT(*)                           AS detection_count,
            COUNT(CASE WHEN urgency_level = 'critical' THEN 1 END) AS critical_count
        FROM AGRISMART_DB.AGRI_SCHEMA.FACT_DISEASE_DETECTION
        GROUP BY 1, 2, 3
    """),
    ("VW_YIELD_COMPARISON", """
        CREATE OR REPLACE VIEW AGRISMART_DB.AGRI_SCHEMA.MV_YIELD_COMPARISON AS
        SELECT
            COALESCE(crop_name, 'Unknown')   AS crop_name,
            COALESCE(region, 'Unknown')      AS region,
            COALESCE(season, 'Unknown')      AS season,
            AVG(COALESCE(expected_yield, 0)) AS avg_yield,
            MIN(COALESCE(min_yield, 0))      AS min_yield_recorded,
            MAX(COALESCE(max_yield, 0))      AS max_yield_recorded,
            COUNT(*)                         AS prediction_count
        FROM AGRISMART_DB.AGRI_SCHEMA.FACT_YIELD_PREDICTION
        GROUP BY 1, 2, 3
    """),
]


def run(conn, sql, label=""):
    try:
        conn.cursor().execute(sql.strip())
        log.info(f"  OK   {label}")
        return True
    except Exception as e:
        err = str(e)
        if "already exists" in err.lower() or "ambiguous" in err.lower():
            log.info(f"  SKIP {label}  (already exists)")
            return True
        log.warning(f"  FAIL {label}: {err[:100]}")
        return False


def run_migration():
    conn = get_snowflake_connection()
    if not conn:
        print("Cannot connect to Snowflake. Check .env credentials.")
        return

    print("\n--- Step 1: Granting privileges ---")
    for sql in GRANT_STATEMENTS:
        run(conn, sql, sql[:60])

    print("\n--- Step 2: Creating missing tables ---")
    ok = 0
    for name, sql in CREATE_STATEMENTS:
        if run(conn, sql, name):
            ok += 1
    print(f"   {ok}/{len(CREATE_STATEMENTS)} tables created")

    print("\n--- Step 3: Adding missing columns ---")
    ok = 0
    for sql in ALTER_STATEMENTS:
        if run(conn, sql, sql.split("ADD COLUMN")[1].strip()[:50] if "ADD COLUMN" in sql else sql[:50]):
            ok += 1
    print(f"   {ok}/{len(ALTER_STATEMENTS)} columns added")

    print("\n--- Step 4: Creating Materialized Views (fall back to regular Views if needed) ---")
    for name, mv_sql in MV_STATEMENTS:
        success = run(conn, mv_sql, name + " (MATERIALIZED VIEW)")
        if not success:
            # Try regular VIEW with same name so queries still work
            for fb_name, vw_sql in VIEW_FALLBACKS:
                if fb_name.replace("VW_", "MV_") in name or name in fb_name:
                    run(conn, vw_sql, name + " (VIEW fallback)")
                    break

    # Verify what now exists
    print("\n--- Verification ---")
    cur = conn.cursor()
    cur.execute("SELECT TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'AGRI_SCHEMA' ORDER BY TABLE_TYPE, TABLE_NAME")
    rows = cur.fetchall()
    for r in rows:
        print(f"   {r[1]:30s} {r[0]}")

    conn.close()
    print("\nDone. Refresh the Analytics page - it should show Snowflake Live.")


if __name__ == "__main__":
    run_migration()
