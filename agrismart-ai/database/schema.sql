-- Snowflake Database Setup for AgriSmart AI

-- Create Database, Schema, and Warehouse
CREATE DATABASE IF NOT EXISTS AGRISMART_DB;
USE DATABASE AGRISMART_DB;

CREATE SCHEMA IF NOT EXISTS AGRI_SCHEMA;
USE SCHEMA AGRI_SCHEMA;

CREATE WAREHOUSE IF NOT EXISTS AGRISMART_WH 
WITH WAREHOUSE_SIZE = 'XSMALL' 
AUTO_SUSPEND = 300 
AUTO_RESUME = TRUE 
INITIALLY_SUSPENDED = TRUE;

USE WAREHOUSE AGRISMART_WH;

-- ==========================================
-- DIMENSION TABLES
-- ==========================================

CREATE TABLE IF NOT EXISTS DIM_REGION (
    region_id INT AUTOINCREMENT PRIMARY KEY,
    region_name VARCHAR(100),
    state VARCHAR(50),
    climate_zone VARCHAR(50),
    avg_rainfall_mm FLOAT,
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS DIM_CROP (
    crop_id INT AUTOINCREMENT PRIMARY KEY,
    crop_name VARCHAR(100),
    crop_type VARCHAR(50),
    season VARCHAR(50),
    water_need VARCHAR(50),
    avg_yield_per_ha FLOAT,
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS DIM_SOIL (
    soil_id INT AUTOINCREMENT PRIMARY KEY,
    soil_type VARCHAR(50),
    texture VARCHAR(50),
    drainage VARCHAR(50),
    typical_ph_min FLOAT,
    typical_ph_max FLOAT,
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS DIM_WEATHER (
    weather_id INT AUTOINCREMENT PRIMARY KEY,
    season VARCHAR(50),
    avg_temp_c FLOAT,
    avg_rainfall_mm FLOAT,
    humidity_pct FLOAT,
    recorded_year INT,
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ==========================================
-- FACT TABLES
-- ==========================================

CREATE TABLE IF NOT EXISTS FACT_CROP_RECOMMENDATION (
    rec_id INT AUTOINCREMENT PRIMARY KEY,
    nitrogen FLOAT,
    phosphorus FLOAT,
    potassium FLOAT,
    ph_level FLOAT,
    rainfall_mm FLOAT,
    temperature_c FLOAT,
    region VARCHAR(100),
    top_recommended_crop VARCHAR(100),
    all_recommendations VARIANT,    -- JSON array
    language VARCHAR(5),
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS FACT_DISEASE_DETECTION (
    detection_id INT AUTOINCREMENT PRIMARY KEY,
    disease_name VARCHAR(200),
    confidence_level VARCHAR(50),
    urgency_level VARCHAR(50),
    language VARCHAR(5),
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS FACT_YIELD_PREDICTION (
    prediction_id INT AUTOINCREMENT PRIMARY KEY,
    crop_name VARCHAR(100),
    region VARCHAR(100),
    area_hectares FLOAT,
    season VARCHAR(50),
    min_yield FLOAT,
    max_yield FLOAT,
    expected_yield FLOAT,
    language VARCHAR(5),
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS FACT_PRICE_FORECAST (
    forecast_id INT AUTOINCREMENT PRIMARY KEY,
    crop_name VARCHAR(100),
    location VARCHAR(100),
    predicted_trend VARCHAR(50),
    price_forecast VARIANT,          -- JSON array
    language VARCHAR(5),
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS FACT_QUERY_LOGS (
    log_id INT AUTOINCREMENT PRIMARY KEY,
    endpoint VARCHAR(200),
    request_payload VARIANT,
    response_summary VARCHAR(500),
    language VARCHAR(5),
    region VARCHAR(100),
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ==========================================
-- SAMPLE DATA INSERTS
-- ==========================================

INSERT INTO DIM_REGION (region_name, state, climate_zone, avg_rainfall_mm)
VALUES 
    ('Vidarbha', 'Maharashtra', 'Semi-arid', 850),
    ('Marathwada', 'Maharashtra', 'Arid', 700),
    ('Punjab Plains', 'Punjab', 'Sub-tropical', 650),
    ('Cauvery Delta', 'Tamil Nadu', 'Tropical Wet', 1200),
    ('Gangetic Plains', 'Uttar Pradesh', 'Humid Sub-tropical', 1000);

INSERT INTO DIM_CROP (crop_name, crop_type, season, water_need, avg_yield_per_ha)
VALUES 
    ('Wheat', 'Cereal', 'Rabi', 'Medium', 3.5),
    ('Rice', 'Cereal', 'Kharif', 'High', 4.0),
    ('Cotton', 'Fiber', 'Kharif', 'Low', 1.5),
    ('Sugarcane', 'Cash', 'Annual', 'Very High', 80.0),
    ('Soybean', 'Oilseed', 'Kharif', 'Medium', 1.8),
    ('Maize', 'Cereal', 'Kharif', 'Medium', 3.0),
    ('Gram', 'Pulse', 'Rabi', 'Low', 1.2),
    ('Groundnut', 'Oilseed', 'Kharif', 'Low', 1.5),
    ('Mustard', 'Oilseed', 'Rabi', 'Low', 1.4),
    ('Jowar', 'Cereal', 'Kharif', 'Low', 1.1);

INSERT INTO DIM_SOIL (soil_type, texture, drainage, typical_ph_min, typical_ph_max)
VALUES 
    ('Black Soil', 'Clay', 'Poor', 7.2, 8.5),
    ('Alluvial Soil', 'Loamy', 'Good', 6.5, 8.4),
    ('Red Soil', 'Sandy', 'Well', 5.5, 7.5),
    ('Laterite', 'Clayey', 'Well', 4.5, 6.2);

INSERT INTO DIM_WEATHER (season, avg_temp_c, avg_rainfall_mm, humidity_pct, recorded_year)
VALUES 
    ('Kharif', 28.5, 800, 75.0, 2023),
    ('Rabi', 18.0, 50, 45.0, 2023),
    ('Zaid', 32.0, 20, 30.0, 2023),
    ('Kharif', 29.0, 750, 70.0, 2024);
