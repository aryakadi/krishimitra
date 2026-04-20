-- =============================================================================
-- AgriSmart AI — Snowflake Data Warehouse Schema
-- Star Schema Design for ADBMS Final Year Evaluation
-- =============================================================================

-- Step 1: Database, Schema, Warehouse
CREATE DATABASE IF NOT EXISTS AGRISMART_DB;
USE DATABASE AGRISMART_DB;

CREATE SCHEMA IF NOT EXISTS AGRI_SCHEMA;
USE SCHEMA AGRI_SCHEMA;

CREATE WAREHOUSE IF NOT EXISTS AGRISMART_WH
    WITH WAREHOUSE_SIZE = 'XSMALL'
    AUTO_SUSPEND = 300
    AUTO_RESUME = TRUE
    INITIALLY_SUSPENDED = TRUE
    COMMENT = 'AgriSmart AI analytics warehouse';

USE WAREHOUSE AGRISMART_WH;

-- =============================================================================
-- DIMENSION TABLES (Star Schema)
-- =============================================================================

-- DIM_CROP: Crop master data
CREATE TABLE IF NOT EXISTS DIM_CROP (
    crop_id       INT AUTOINCREMENT PRIMARY KEY,
    crop_name     VARCHAR(100) NOT NULL,
    crop_type     VARCHAR(50),            -- Cereal, Oilseed, Pulse, Fiber, Cash
    season        VARCHAR(50),            -- Kharif, Rabi, Zaid, Annual
    water_need    VARCHAR(50),            -- Low, Medium, High, Very High
    avg_yield_per_ha FLOAT,
    created_at    TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- DIM_LOCATION: Geographic hierarchy
CREATE TABLE IF NOT EXISTS DIM_LOCATION (
    location_id   INT AUTOINCREMENT PRIMARY KEY,
    state         VARCHAR(100) NOT NULL,
    district      VARCHAR(100),
    region        VARCHAR(100),
    climate_zone  VARCHAR(50),            -- Arid, Semi-arid, Tropical Wet, etc.
    avg_rainfall_mm FLOAT,
    created_at    TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- DIM_SOIL: Soil properties
CREATE TABLE IF NOT EXISTS DIM_SOIL (
    soil_id           INT AUTOINCREMENT PRIMARY KEY,
    soil_type         VARCHAR(50) NOT NULL, -- Black, Alluvial, Red, Laterite
    texture           VARCHAR(50),
    drainage          VARCHAR(50),
    nitrogen_range    VARCHAR(30),          -- e.g. '40-80 kg/ha'
    phosphorus_range  VARCHAR(30),
    potassium_range   VARCHAR(30),
    typical_ph_min    FLOAT,
    typical_ph_max    FLOAT,
    created_at        TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- DIM_TIME: Date dimension for OLAP slicing
CREATE TABLE IF NOT EXISTS DIM_TIME (
    time_id       INT AUTOINCREMENT PRIMARY KEY,
    full_date     DATE NOT NULL,
    day           INT,
    month         INT,
    month_name    VARCHAR(15),
    year          INT,
    quarter       INT,
    season_label  VARCHAR(20)             -- Kharif/Rabi/Zaid
);

-- DIM_USER: User dimension for personalization analytics
CREATE TABLE IF NOT EXISTS DIM_USER (
    user_id       VARCHAR(100) DEFAULT UUID_STRING() PRIMARY KEY,
    name          VARCHAR(200),
    language      VARCHAR(5) DEFAULT 'en', -- en, hi, mr
    region        VARCHAR(100),
    created_at    TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- =============================================================================
-- FACT TABLES (Star Schema — Central fact tables)
-- =============================================================================

-- FACT_PREDICTIONS: Unified prediction log (disease / yield / price)
CREATE TABLE IF NOT EXISTS FACT_PREDICTIONS (
    prediction_id     INT AUTOINCREMENT PRIMARY KEY,
    user_id           VARCHAR(100),           -- FK to DIM_USER (soft)
    crop_id           INT,                    -- FK to DIM_CROP (soft)
    location_id       INT,                    -- FK to DIM_LOCATION (soft)
    time_id           INT,                    -- FK to DIM_TIME (soft)
    prediction_type   VARCHAR(50) NOT NULL,   -- 'disease' | 'yield' | 'price' | 'crop_rec'
    predicted_value   VARCHAR(500),           -- JSON string or value
    confidence_score  FLOAT,                  -- 0.0 – 1.0
    model_used        VARCHAR(100),           -- 'gemini-1.5-flash' | 'nvidia-nim' | 'rf_v1'
    actual_value      VARCHAR(500),           -- Filled later (feedback loop)
    feedback_at       TIMESTAMP_NTZ,
    language          VARCHAR(5) DEFAULT 'en',
    region            VARCHAR(100),
    created_at        TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- FACT_WEATHER: Weather observations
CREATE TABLE IF NOT EXISTS FACT_WEATHER (
    weather_id    INT AUTOINCREMENT PRIMARY KEY,
    location_id   INT,
    time_id       INT,
    temperature   FLOAT,                   -- Celsius
    humidity      FLOAT,                   -- %
    rainfall      FLOAT,                   -- mm
    wind_speed    FLOAT,                   -- km/h
    weather_desc  VARCHAR(200),
    city_name     VARCHAR(100),
    source        VARCHAR(50) DEFAULT 'OpenWeatherMap',
    timestamp     TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- FACT_MARKET: Historical & predicted market prices
CREATE TABLE IF NOT EXISTS FACT_MARKET (
    market_id         INT AUTOINCREMENT PRIMARY KEY,
    crop_id           INT,
    location_id       INT,
    time_id           INT,
    historical_price  FLOAT,               -- INR per quintal
    predicted_price   FLOAT,
    demand            VARCHAR(50),         -- Low/Medium/High
    supply            VARCHAR(50),
    trend             VARCHAR(20),         -- up/down/stable
    timestamp         TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- FACT_CROP_RECOMMENDATION: Detailed crop recommendations
CREATE TABLE IF NOT EXISTS FACT_CROP_RECOMMENDATION (
    rec_id                INT AUTOINCREMENT PRIMARY KEY,
    prediction_id         INT,             -- FK to FACT_PREDICTIONS
    nitrogen              FLOAT,
    phosphorus            FLOAT,
    potassium             FLOAT,
    ph_level              FLOAT,
    rainfall_mm           FLOAT,
    temperature_c         FLOAT,
    humidity_pct          FLOAT,
    region                VARCHAR(100),
    top_recommended_crop  VARCHAR(100),
    all_recommendations   VARIANT,         -- JSON array of crop options
    language              VARCHAR(5),
    created_at            TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- FACT_DISEASE_DETECTION: Disease detection results
CREATE TABLE IF NOT EXISTS FACT_DISEASE_DETECTION (
    detection_id      INT AUTOINCREMENT PRIMARY KEY,
    prediction_id     INT,                 -- FK to FACT_PREDICTIONS
    disease_name      VARCHAR(200),
    confidence_level  VARCHAR(50),
    urgency_level     VARCHAR(50),
    affected_parts    VARIANT,             -- JSON array
    treatment_steps   VARIANT,             -- JSON array
    region            VARCHAR(100),
    language          VARCHAR(5),
    created_at        TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- FACT_YIELD_PREDICTION: Yield prediction results
CREATE TABLE IF NOT EXISTS FACT_YIELD_PREDICTION (
    prediction_id_local  INT AUTOINCREMENT PRIMARY KEY,
    prediction_id        INT,              -- FK to FACT_PREDICTIONS
    crop_name            VARCHAR(100),
    region               VARCHAR(100),
    area_hectares        FLOAT,
    season               VARCHAR(50),
    soil_type            VARCHAR(50),
    min_yield            FLOAT,
    max_yield            FLOAT,
    expected_yield       FLOAT,
    confidence_level     VARCHAR(50),
    feature_importance   VARIANT,          -- JSON object (Explainable AI)
    language             VARCHAR(5),
    created_at           TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- FACT_PRICE_FORECAST: Market price forecast results
CREATE TABLE IF NOT EXISTS FACT_PRICE_FORECAST (
    forecast_id       INT AUTOINCREMENT PRIMARY KEY,
    prediction_id     INT,                 -- FK to FACT_PREDICTIONS
    crop_name         VARCHAR(100),
    location          VARCHAR(100),
    predicted_trend   VARCHAR(50),
    price_forecast    VARIANT,             -- JSON array of {month, price, trend}
    best_sell_window  VARCHAR(100),
    language          VARCHAR(5),
    created_at        TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- FACT_QUERY_LOGS: General API request logging
CREATE TABLE IF NOT EXISTS FACT_QUERY_LOGS (
    log_id            INT AUTOINCREMENT PRIMARY KEY,
    endpoint          VARCHAR(200),
    request_payload   VARIANT,
    response_summary  VARCHAR(500),
    language          VARCHAR(5),
    region            VARCHAR(100),
    response_ms       INT,                 -- Response time in ms
    created_at        TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- =============================================================================
-- MATERIALIZED VIEWS (Query Optimization for OLAP)
-- =============================================================================

-- MV_CROP_TRENDS: Aggregated crop recommendation trends by month/region
CREATE OR REPLACE MATERIALIZED VIEW MV_CROP_TRENDS AS
SELECT
    top_recommended_crop                                AS crop_name,
    region,
    DATE_TRUNC('month', created_at)                    AS month,
    COUNT(*)                                           AS recommendation_count,
    AVG(temperature_c)                                 AS avg_temperature,
    AVG(rainfall_mm)                                   AS avg_rainfall,
    AVG(nitrogen)                                      AS avg_nitrogen
FROM FACT_CROP_RECOMMENDATION
WHERE top_recommended_crop IS NOT NULL
  AND top_recommended_crop != 'None'
GROUP BY 1, 2, 3;

-- MV_DISEASE_FREQ: Disease frequency breakdown by region
CREATE OR REPLACE MATERIALIZED VIEW MV_DISEASE_FREQ AS
SELECT
    disease_name,
    region,
    DATE_TRUNC('month', created_at)                    AS month,
    COUNT(*)                                           AS detection_count,
    COUNT(CASE WHEN urgency_level = 'critical' THEN 1 END) AS critical_count,
    COUNT(CASE WHEN urgency_level = 'high'     THEN 1 END) AS high_count
FROM FACT_DISEASE_DETECTION
WHERE disease_name IS NOT NULL
GROUP BY 1, 2, 3;

-- MV_YIELD_COMPARISON: Yield statistics across crops and regions
CREATE OR REPLACE MATERIALIZED VIEW MV_YIELD_COMPARISON AS
SELECT
    crop_name,
    region,
    season,
    COUNT(*)                                           AS prediction_count,
    AVG(expected_yield)                                AS avg_yield,
    MIN(min_yield)                                     AS min_yield_recorded,
    MAX(max_yield)                                     AS max_yield_recorded,
    AVG(area_hectares)                                 AS avg_area
FROM FACT_YIELD_PREDICTION
WHERE crop_name IS NOT NULL
GROUP BY 1, 2, 3;

-- MV_MARKET_TRENDS: Market price trend by crop
CREATE OR REPLACE MATERIALIZED VIEW MV_MARKET_TRENDS AS
SELECT
    fc.crop_name,
    DATE_TRUNC('month', fp.created_at)                AS month,
    AVG(fm.historical_price)                          AS avg_price,
    MIN(fm.historical_price)                          AS min_price,
    MAX(fm.historical_price)                          AS max_price,
    COUNT(fp.forecast_id)                             AS forecast_count
FROM FACT_PRICE_FORECAST fp
LEFT JOIN FACT_MARKET fm ON fp.crop_name = (
    SELECT crop_name FROM DIM_CROP WHERE crop_id = fm.crop_id LIMIT 1
)
LEFT JOIN DIM_CROP fc ON fp.crop_name = fc.crop_name
GROUP BY 1, 2;

-- =============================================================================
-- STREAMS (Change Data Capture)
-- =============================================================================

-- Stream to capture new predictions as they arrive
CREATE OR REPLACE STREAM STR_PREDICTIONS ON TABLE FACT_PREDICTIONS
    COMMENT = 'CDC stream for new prediction records';

-- Stream on disease detections for real-time alerting
CREATE OR REPLACE STREAM STR_DISEASE ON TABLE FACT_DISEASE_DETECTION
    COMMENT = 'CDC stream for new disease detection events';

-- =============================================================================
-- TASKS (Scheduled Automation)
-- =============================================================================

-- Task to refresh materialized views hourly
CREATE OR REPLACE TASK TSK_REFRESH_MV
    WAREHOUSE = AGRISMART_WH
    SCHEDULE = '60 MINUTE'
    COMMENT = 'Refreshes all materialized views for analytics'
AS
BEGIN
    -- Refresh views (Snowflake MVs refresh automatically, this logs refresh)
    INSERT INTO FACT_QUERY_LOGS (endpoint, response_summary, region)
    SELECT '/system/mv-refresh', 'Scheduled MV refresh executed', 'SYSTEM';
END;

-- Task to populate DIM_TIME for current year (run once on setup)
CREATE OR REPLACE TASK TSK_POPULATE_DIM_TIME
    WAREHOUSE = AGRISMART_WH
    SCHEDULE = 'USING CRON 0 0 1 1 * Asia/Kolkata'
    COMMENT = 'Annually populates DIM_TIME for the coming year'
AS
INSERT INTO DIM_TIME (full_date, day, month, month_name, year, quarter, season_label)
SELECT
    DATEADD(day, seq4(), DATE_TRUNC('year', CURRENT_DATE()))             AS full_date,
    DAY(DATEADD(day, seq4(), DATE_TRUNC('year', CURRENT_DATE())))        AS day,
    MONTH(DATEADD(day, seq4(), DATE_TRUNC('year', CURRENT_DATE())))      AS month,
    MONTHNAME(DATEADD(day, seq4(), DATE_TRUNC('year', CURRENT_DATE())))  AS month_name,
    YEAR(DATEADD(day, seq4(), DATE_TRUNC('year', CURRENT_DATE())))       AS year,
    QUARTER(DATEADD(day, seq4(), DATE_TRUNC('year', CURRENT_DATE())))    AS quarter,
    CASE
        WHEN MONTH(DATEADD(day, seq4(), DATE_TRUNC('year', CURRENT_DATE()))) IN (6,7,8,9,10)  THEN 'Kharif'
        WHEN MONTH(DATEADD(day, seq4(), DATE_TRUNC('year', CURRENT_DATE()))) IN (11,12,1,2,3) THEN 'Rabi'
        ELSE 'Zaid'
    END                                                                   AS season_label
FROM TABLE(GENERATOR(ROWCOUNT => 365))
WHERE DATEADD(day, seq4(), DATE_TRUNC('year', CURRENT_DATE())) <= DATEADD(year, 1, DATE_TRUNC('year', CURRENT_DATE()));

-- Activate tasks
ALTER TASK TSK_REFRESH_MV RESUME;
ALTER TASK TSK_POPULATE_DIM_TIME RESUME;

-- =============================================================================
-- DIMENSION DATA SEED
-- =============================================================================

INSERT INTO DIM_LOCATION (state, district, region, climate_zone, avg_rainfall_mm) VALUES
    ('Maharashtra', 'Amravati',    'Vidarbha',        'Semi-arid',          850),
    ('Maharashtra', 'Aurangabad',  'Marathwada',      'Arid',               700),
    ('Punjab',      'Ludhiana',    'Punjab Plains',   'Sub-tropical',       650),
    ('Tamil Nadu',  'Thanjavur',   'Cauvery Delta',   'Tropical Wet',      1200),
    ('Uttar Pradesh','Lucknow',    'Gangetic Plains', 'Humid Sub-tropical',1000),
    ('Rajasthan',   'Jaipur',      'Thar Desert',     'Arid',               300),
    ('West Bengal', 'Murshidabad', 'Bengal Delta',    'Tropical Wet',      1500),
    ('Karnataka',   'Tumkur',      'Deccan Plateau',  'Semi-arid',          700),
    ('Madhya Pradesh','Indore',    'Malwa Plateau',   'Semi-arid',          900),
    ('Gujarat',     'Anand',       'Saurashtra',      'Semi-arid',          600);

INSERT INTO DIM_CROP (crop_name, crop_type, season, water_need, avg_yield_per_ha) VALUES
    ('Wheat',      'Cereal',   'Rabi',    'Medium',    3.5),
    ('Rice',       'Cereal',   'Kharif',  'High',      4.0),
    ('Cotton',     'Fiber',    'Kharif',  'Low',       1.5),
    ('Sugarcane',  'Cash',     'Annual',  'Very High', 80.0),
    ('Soybean',    'Oilseed',  'Kharif',  'Medium',    1.8),
    ('Maize',      'Cereal',   'Kharif',  'Medium',    3.0),
    ('Gram',       'Pulse',    'Rabi',    'Low',       1.2),
    ('Groundnut',  'Oilseed',  'Kharif',  'Low',       1.5),
    ('Mustard',    'Oilseed',  'Rabi',    'Low',       1.4),
    ('Jowar',      'Cereal',   'Kharif',  'Low',       1.1),
    ('Bajra',      'Cereal',   'Kharif',  'Low',       1.0),
    ('Turmeric',   'Spice',    'Kharif',  'High',      6.0),
    ('Onion',      'Vegetable','Rabi',    'Medium',    25.0),
    ('Tomato',     'Vegetable','Annual',  'High',      30.0),
    ('Potato',     'Vegetable','Rabi',    'Medium',    20.0);

INSERT INTO DIM_SOIL (soil_type, texture, drainage, nitrogen_range, phosphorus_range, potassium_range, typical_ph_min, typical_ph_max) VALUES
    ('Black Soil',   'Clay',        'Poor', '60-120 kg/ha', '20-40 kg/ha', '300-600 kg/ha', 7.2, 8.5),
    ('Alluvial Soil','Loamy',       'Good', '80-150 kg/ha', '30-60 kg/ha', '200-400 kg/ha', 6.5, 8.4),
    ('Red Soil',     'Sandy Loam',  'Well', '40-80 kg/ha',  '15-30 kg/ha', '150-300 kg/ha', 5.5, 7.5),
    ('Laterite',     'Clayey',      'Well', '20-60 kg/ha',  '10-25 kg/ha', '100-200 kg/ha', 4.5, 6.2),
    ('Sandy Soil',   'Sandy',       'Excellent','20-40 kg/ha','5-15 kg/ha','80-150 kg/ha',  5.0, 7.0),
    ('Loamy Soil',   'Loam',        'Good', '80-160 kg/ha', '25-50 kg/ha', '200-350 kg/ha', 6.0, 7.5);

INSERT INTO DIM_TIME (full_date, day, month, month_name, year, quarter, season_label) VALUES
    ('2024-01-01', 1, 1, 'January',   2024, 1, 'Rabi'),
    ('2024-02-01', 1, 2, 'February',  2024, 1, 'Rabi'),
    ('2024-03-01', 1, 3, 'March',     2024, 1, 'Rabi'),
    ('2024-04-01', 1, 4, 'April',     2024, 2, 'Zaid'),
    ('2024-05-01', 1, 5, 'May',       2024, 2, 'Zaid'),
    ('2024-06-01', 1, 6, 'June',      2024, 2, 'Kharif'),
    ('2024-07-01', 1, 7, 'July',      2024, 3, 'Kharif'),
    ('2024-08-01', 1, 8, 'August',    2024, 3, 'Kharif'),
    ('2024-09-01', 1, 9, 'September', 2024, 3, 'Kharif'),
    ('2024-10-01', 1,10, 'October',   2024, 4, 'Kharif'),
    ('2024-11-01', 1,11, 'November',  2024, 4, 'Rabi'),
    ('2024-12-01', 1,12, 'December',  2024, 4, 'Rabi'),
    ('2025-01-01', 1, 1, 'January',   2025, 1, 'Rabi'),
    ('2025-02-01', 1, 2, 'February',  2025, 1, 'Rabi'),
    ('2025-03-01', 1, 3, 'March',     2025, 1, 'Rabi'),
    ('2025-04-01', 1, 4, 'April',     2025, 2, 'Zaid'),
    ('2025-05-01', 1, 5, 'May',       2025, 2, 'Zaid'),
    ('2025-06-01', 1, 6, 'June',      2025, 2, 'Kharif'),
    ('2025-07-01', 1, 7, 'July',      2025, 3, 'Kharif'),
    ('2025-08-01', 1, 8, 'August',    2025, 3, 'Kharif'),
    ('2025-09-01', 1, 9, 'September', 2025, 3, 'Kharif'),
    ('2025-10-01', 1,10, 'October',   2025, 4, 'Kharif'),
    ('2025-11-01', 1,11, 'November',  2025, 4, 'Rabi'),
    ('2025-12-01', 1,12, 'December',  2025, 4, 'Rabi'),
    ('2026-01-01', 1, 1, 'January',   2026, 1, 'Rabi'),
    ('2026-02-01', 1, 2, 'February',  2026, 1, 'Rabi'),
    ('2026-03-01', 1, 3, 'March',     2026, 1, 'Rabi'),
    ('2026-04-01', 1, 4, 'April',     2026, 2, 'Zaid');

-- =============================================================================
-- SAMPLE FACT DATA (for analytics demonstration)
-- =============================================================================

INSERT INTO FACT_PREDICTIONS (prediction_type, predicted_value, confidence_score, model_used, language, region) VALUES
    ('crop_rec', 'Wheat',       0.92, 'nvidia-nim',       'en', 'Vidarbha'),
    ('crop_rec', 'Cotton',      0.88, 'nvidia-nim',       'hi', 'Marathwada'),
    ('disease',  'Leaf Blight', 0.85, 'gemini-1.5-flash', 'en', 'Punjab Plains'),
    ('yield',    '3.5',         0.78, 'nvidia-nim',       'mr', 'Cauvery Delta'),
    ('price',    '2400',        0.72, 'nvidia-nim',       'en', 'Gangetic Plains'),
    ('crop_rec', 'Rice',        0.90, 'nvidia-nim',       'hi', 'Bengal Delta'),
    ('disease',  'Powdery Mildew', 0.82, 'gemini-1.5-flash', 'en', 'Vidarbha'),
    ('disease',  'Rust',        0.91, 'gemini-1.5-flash', 'en', 'Punjab Plains'),
    ('crop_rec', 'Soybean',     0.87, 'nvidia-nim',       'mr', 'Vidarbha'),
    ('yield',    '4.2',         0.80, 'nvidia-nim',       'en', 'Gangetic Plains');

INSERT INTO FACT_CROP_RECOMMENDATION (nitrogen, phosphorus, potassium, ph_level, rainfall_mm, temperature_c, region, top_recommended_crop, language) VALUES
    (80, 40, 40, 6.5, 800, 25, 'Vidarbha',        'Wheat',     'en'),
    (60, 30, 30, 7.0, 700, 28, 'Marathwada',      'Cotton',    'hi'),
    (90, 50, 50, 6.8, 650, 22, 'Punjab Plains',   'Wheat',     'en'),
    (70, 35, 45, 6.2, 1200, 30,'Cauvery Delta',   'Rice',      'en'),
    (85, 45, 55, 7.2, 1000, 27,'Gangetic Plains', 'Wheat',     'hi'),
    (65, 28, 35, 6.9, 1500, 29,'Bengal Delta',    'Rice',      'en'),
    (75, 38, 42, 6.6, 700,  26,'Deccan Plateau',  'Soybean',   'mr'),
    (55, 25, 30, 7.1, 300,  32,'Thar Desert',     'Bajra',     'hi'),
    (80, 42, 48, 6.4, 900,  24,'Malwa Plateau',   'Soybean',   'en'),
    (70, 33, 40, 6.7, 600,  27,'Saurashtra',      'Groundnut', 'en');

INSERT INTO FACT_DISEASE_DETECTION (disease_name, confidence_level, urgency_level, region, language) VALUES
    ('Leaf Blight',      'High',   'high',     'Punjab Plains',   'en'),
    ('Powdery Mildew',   'Medium', 'medium',   'Vidarbha',        'en'),
    ('Rust',             'High',   'critical', 'Punjab Plains',   'hi'),
    ('Mosaic Virus',     'Low',    'low',      'Cauvery Delta',   'en'),
    ('Root Rot',         'Medium', 'high',     'Marathwada',      'mr'),
    ('Bacterial Wilt',   'High',   'critical', 'Bengal Delta',    'en'),
    ('Alternaria Blight','Medium', 'medium',   'Gangetic Plains', 'hi'),
    ('Downy Mildew',     'High',   'high',     'Deccan Plateau',  'en'),
    ('Yellow Mosaic',    'Low',    'low',      'Saurashtra',      'en'),
    ('Leaf Curl Virus',  'Medium', 'medium',   'Vidarbha',        'mr');

INSERT INTO FACT_YIELD_PREDICTION (crop_name, region, area_hectares, season, min_yield, max_yield, expected_yield, confidence_level, language) VALUES
    ('Wheat',    'Punjab Plains',   5.0, 'Rabi',    3.0, 4.5, 3.8, 'High',   'en'),
    ('Rice',     'Bengal Delta',    3.0, 'Kharif',  3.5, 5.0, 4.2, 'High',   'hi'),
    ('Cotton',   'Marathwada',      8.0, 'Kharif',  1.0, 2.0, 1.5, 'Medium', 'mr'),
    ('Soybean',  'Vidarbha',        4.0, 'Kharif',  1.4, 2.2, 1.8, 'Medium', 'en'),
    ('Wheat',    'Gangetic Plains', 6.0, 'Rabi',    3.0, 4.0, 3.5, 'High',   'hi'),
    ('Maize',    'Deccan Plateau',  2.5, 'Kharif',  2.5, 3.5, 3.0, 'Medium', 'en'),
    ('Groundnut','Saurashtra',      3.5, 'Kharif',  1.2, 1.8, 1.5, 'Medium', 'en'),
    ('Bajra',    'Thar Desert',     7.0, 'Kharif',  0.8, 1.3, 1.0, 'Low',    'hi'),
    ('Rice',     'Cauvery Delta',   4.0, 'Kharif',  3.8, 5.2, 4.5, 'High',   'en'),
    ('Mustard',  'Malwa Plateau',   3.0, 'Rabi',    1.1, 1.7, 1.4, 'Medium', 'en');

INSERT INTO FACT_MARKET (historical_price, predicted_price, demand, supply, trend) VALUES
    (2200, 2350, 'High',   'Medium', 'up'),
    (3200, 3100, 'Medium', 'High',   'down'),
    (5800, 6100, 'High',   'Low',    'up'),
    (3500, 3500, 'Medium', 'Medium', 'stable'),
    (4200, 4400, 'High',   'Low',    'up'),
    (1800, 1750, 'Low',    'High',   'down'),
    (2800, 2900, 'Medium', 'Medium', 'up'),
    (2100, 2150, 'Medium', 'Medium', 'stable'),
    (6500, 6800, 'High',   'Low',    'up'),
    (4800, 4600, 'Low',    'High',   'down');

-- =============================================================================
-- USEFUL OLAP QUERIES (for analytics endpoints)
-- =============================================================================

-- Query 1: Crop trend over time
-- SELECT crop_name, region, month, recommendation_count FROM MV_CROP_TRENDS ORDER BY month DESC;

-- Query 2: Disease frequency by region
-- SELECT disease_name, region, SUM(detection_count) as total, SUM(critical_count) as critical
-- FROM MV_DISEASE_FREQ GROUP BY 1, 2 ORDER BY total DESC;

-- Query 3: Yield comparison across locations
-- SELECT crop_name, region, AVG(avg_yield), MIN(min_yield_recorded), MAX(max_yield_recorded)
-- FROM MV_YIELD_COMPARISON GROUP BY 1, 2;

-- Query 4: Time Travel — view predictions from 7 days ago
-- SELECT * FROM FACT_PREDICTIONS AT(OFFSET => -60*60*24*7);

-- Query 5: Predicted vs Actual accuracy
-- SELECT prediction_type,
--        COUNT(*) as total,
--        COUNT(actual_value) as with_feedback,
--        AVG(TRY_TO_DOUBLE(actual_value)) as avg_actual
-- FROM FACT_PREDICTIONS WHERE actual_value IS NOT NULL
-- GROUP BY prediction_type;
