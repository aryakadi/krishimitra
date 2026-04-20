"""
AgriSmart AI — Yield Prediction (Random Forest + Explainable AI)
=================================================================
ACADEMIC TRAINING SCRIPT — Run offline, not imported by the live API.

Model: scikit-learn RandomForestRegressor
Features: temperature, rainfall, nitrogen, phosphorus, potassium, area_hectares
Target: yield_tonnes_per_ha
Explainability: SHAP (SHapley Additive exPlanations)

Run:
    python ml/yield_random_forest.py --train
    python ml/yield_random_forest.py --predict --temp 25 --rain 800 --n 80 --p 40 --k 40 --area 5
    python ml/yield_random_forest.py --demo
"""

import os
import sys
import json
import argparse
import logging
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

try:
    from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
    from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
    from sklearn.preprocessing import StandardScaler, LabelEncoder
    from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
    from sklearn.pipeline import Pipeline
    import joblib
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    logger.warning("scikit-learn not installed. Run: pip install scikit-learn joblib")

try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False
    logger.info("SHAP not installed (optional). Run: pip install shap")

MODEL_DIR  = Path("ml/models")
MODEL_PATH = MODEL_DIR / "yield_rf_model.joblib"
SCALER_PATH = MODEL_DIR / "yield_scaler.joblib"

FEATURE_COLS = ["temperature_c", "rainfall_mm", "nitrogen", "phosphorus", "potassium",
                "area_hectares", "ph_level", "humidity_pct", "irrigation_score"]
TARGET_COL   = "yield_tonnes_per_ha"


def generate_synthetic_dataset(n_samples: int = 3000) -> pd.DataFrame:
    """
    Generate realistic synthetic agricultural dataset.
    Based on known agronomy relationships between soil nutrients, climate, and yield.
    """
    np.random.seed(42)
    crops = {
        "Wheat":     {"base_yield": 3.5, "temp_opt": 18, "rain_opt": 500,  "n_need": 90},
        "Rice":      {"base_yield": 4.2, "temp_opt": 30, "rain_opt": 1200, "n_need": 100},
        "Maize":     {"base_yield": 3.0, "temp_opt": 25, "rain_opt": 700,  "n_need": 80},
        "Cotton":    {"base_yield": 1.5, "temp_opt": 28, "rain_opt": 700,  "n_need": 60},
        "Soybean":   {"base_yield": 1.8, "temp_opt": 26, "rain_opt": 600,  "n_need": 40},
        "Groundnut": {"base_yield": 1.5, "temp_opt": 28, "rain_opt": 500,  "n_need": 30},
        "Bajra":     {"base_yield": 1.0, "temp_opt": 32, "rain_opt": 400,  "n_need": 50},
        "Jowar":     {"base_yield": 1.1, "temp_opt": 30, "rain_opt": 450,  "n_need": 55},
    }

    records = []
    for _ in range(n_samples):
        crop_name = np.random.choice(list(crops.keys()))
        c = crops[crop_name]

        temp        = np.random.normal(c["temp_opt"], 5)
        rainfall    = np.random.normal(c["rain_opt"], 200)
        nitrogen    = np.random.normal(c["n_need"], 20)
        phosphorus  = np.random.normal(40, 15)
        potassium   = np.random.normal(40, 15)
        ph          = np.random.uniform(5.5, 8.0)
        humidity    = np.random.uniform(30, 90)
        area        = np.random.uniform(0.5, 20)
        irrigation  = np.random.uniform(0, 1)   # 0-1 score

        # Yield model: base * temp-factor * rain-factor * npk-factor + noise
        temp_factor  = max(0.4, 1 - abs(temp - c["temp_opt"]) / 30)
        rain_factor  = max(0.4, 1 - abs(rainfall - c["rain_opt"]) / 1000)
        npk_factor   = min(1.2, (nitrogen + phosphorus + potassium) / (c["n_need"] + 60))
        irr_boost    = 1 + irrigation * 0.3
        noise        = np.random.normal(0, 0.2)
        yield_val    = max(0.1, c["base_yield"] * temp_factor * rain_factor * npk_factor * irr_boost + noise)

        records.append({
            "crop_name":        crop_name,
            "temperature_c":    round(temp, 2),
            "rainfall_mm":      round(max(0, rainfall), 2),
            "nitrogen":         round(max(0, nitrogen), 2),
            "phosphorus":       round(max(0, phosphorus), 2),
            "potassium":        round(max(0, potassium), 2),
            "ph_level":         round(ph, 2),
            "humidity_pct":     round(humidity, 2),
            "area_hectares":    round(area, 2),
            "irrigation_score": round(irrigation, 3),
            TARGET_COL:         round(yield_val, 3),
        })

    df = pd.DataFrame(records)
    logger.info(f"Generated {len(df)} synthetic samples for {df['crop_name'].nunique()} crops")
    return df


def train():
    """Train and evaluate RandomForest with hyperparameter tuning."""
    if not SKLEARN_AVAILABLE:
        print("ERROR: scikit-learn required. pip install scikit-learn joblib")
        sys.exit(1)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    df = generate_synthetic_dataset(3000)

    X = df[FEATURE_COLS]
    y = df[TARGET_COL]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    logger.info(f"Train: {len(X_train)}, Test: {len(X_test)}")

    # Pipeline: Scaler + RF
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("model",  RandomForestRegressor(
            n_estimators=200,
            max_depth=15,
            min_samples_leaf=3,
            max_features="sqrt",
            n_jobs=-1,
            random_state=42
        ))
    ])

    # Cross-validation
    cv_scores = cross_val_score(pipeline, X_train, y_train, cv=5, scoring="r2")
    logger.info(f"CV R² scores: {cv_scores.round(4)} | Mean: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    # Fit
    pipeline.fit(X_train, y_train)

    # Evaluate on test set
    y_pred = pipeline.predict(X_test)
    r2   = r2_score(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    mae  = mean_absolute_error(y_test, y_pred)

    logger.info(f"Test  R²: {r2:.4f}")
    logger.info(f"Test RMSE: {rmse:.4f} tonnes/ha")
    logger.info(f"Test  MAE: {mae:.4f} tonnes/ha")

    # Feature importance
    rf_model = pipeline.named_steps["model"]
    importance = dict(zip(FEATURE_COLS, rf_model.feature_importances_.round(4).tolist()))
    importance_sorted = dict(sorted(importance.items(), key=lambda x: x[1], reverse=True))
    logger.info(f"Feature Importance: {importance_sorted}")

    # SHAP Explainability
    shap_info = "SHAP not available (install shap)"
    if SHAP_AVAILABLE:
        try:
            explainer   = shap.TreeExplainer(rf_model)
            X_test_scaled = pipeline.named_steps["scaler"].transform(X_test[:100])
            shap_values = explainer.shap_values(X_test_scaled)
            mean_shap   = np.abs(shap_values).mean(axis=0).tolist()
            shap_info   = dict(zip(FEATURE_COLS, [round(v, 4) for v in mean_shap]))
            logger.info(f"SHAP mean |values|: {shap_info}")
        except Exception as e:
            shap_info = str(e)

    # Save model
    joblib.dump(pipeline, MODEL_PATH)
    logger.info(f"Model saved: {MODEL_PATH}")

    # Save report
    report = {
        "model": "RandomForestRegressor (scikit-learn)",
        "features": FEATURE_COLS,
        "target": TARGET_COL,
        "n_estimators": 200,
        "test_r2": round(float(r2), 4),
        "test_rmse": round(float(rmse), 4),
        "test_mae": round(float(mae), 4),
        "cv_r2_mean": round(float(cv_scores.mean()), 4),
        "cv_r2_std": round(float(cv_scores.std()), 4),
        "feature_importance": importance_sorted,
        "shap_mean_abs": shap_info,
        "trained_at": datetime.utcnow().isoformat(),
        "training_samples": len(X_train)
    }
    with open(MODEL_DIR / "yield_rf_report.json", "w") as f:
        json.dump(report, f, indent=2)
    print(json.dumps(report, indent=2))


def predict_yield(temp: float, rain: float, n: float, p: float, k: float,
                  area: float = 1.0, ph: float = 7.0, humidity: float = 60.0,
                  irrigation: float = 0.5) -> dict:
    """Predict yield for given agronomic parameters."""
    if not SKLEARN_AVAILABLE:
        # Demo fallback
        return {
            "predicted_yield_tonnes_per_ha": 3.2,
            "total_yield_tonnes": round(3.2 * area, 2),
            "confidence_interval_95": [2.1, 4.3],
            "note": "Demo output — scikit-learn not installed"
        }

    if not MODEL_PATH.exists():
        return {"error": f"Model not found at {MODEL_PATH}. Run --train first."}

    pipeline = joblib.load(MODEL_PATH)
    X = pd.DataFrame([{
        "temperature_c": temp, "rainfall_mm": rain,
        "nitrogen": n, "phosphorus": p, "potassium": k,
        "area_hectares": area, "ph_level": ph,
        "humidity_pct": humidity, "irrigation_score": irrigation
    }])
    y_pred = pipeline.predict(X)[0]

    # Estimate confidence interval from tree variance
    rf = pipeline.named_steps["model"]
    X_scaled = pipeline.named_steps["scaler"].transform(X)
    tree_preds = np.array([tree.predict(X_scaled)[0] for tree in rf.estimators_])
    ci_low  = float(np.percentile(tree_preds, 2.5))
    ci_high = float(np.percentile(tree_preds, 97.5))

    # Feature importance for this prediction
    importance = dict(zip(FEATURE_COLS, rf.feature_importances_.round(4).tolist()))

    return {
        "predicted_yield_tonnes_per_ha": round(float(y_pred), 3),
        "total_yield_tonnes":            round(float(y_pred) * area, 3),
        "confidence_interval_95":        [round(ci_low, 3), round(ci_high, 3)],
        "feature_importance":            importance,
        "model": "RandomForestRegressor"
    }


def demo_output():
    """Print demo output showing what the model produces."""
    result = {
        "model": "RandomForestRegressor (200 trees, max_depth=15)",
        "inputs": {
            "temperature_c": 25.0, "rainfall_mm": 800.0,
            "nitrogen": 80.0, "phosphorus": 40.0, "potassium": 40.0,
            "area_hectares": 5.0, "ph_level": 6.8, "humidity_pct": 65.0,
            "irrigation_score": 0.6
        },
        "predicted_yield_tonnes_per_ha": 3.48,
        "total_yield_tonnes": 17.4,
        "confidence_interval_95": [2.71, 4.25],
        "feature_importance": {
            "nitrogen":        0.1823,
            "rainfall_mm":     0.1764,
            "temperature_c":   0.1612,
            "potassium":       0.1205,
            "phosphorus":      0.1098,
            "irrigation_score":0.0987,
            "ph_level":        0.0821,
            "humidity_pct":    0.0432,
            "area_hectares":   0.0258,
        },
        "explainability": "Top driver: Nitrogen content (18.2% importance)",
        "training_metrics": {"R²": 0.9124, "RMSE": 0.31, "MAE": 0.24, "CV_R²_mean": 0.9087}
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AgriSmart Yield Prediction (Random Forest)")
    parser.add_argument("--train",       action="store_true", help="Train the model")
    parser.add_argument("--predict",     action="store_true", help="Run prediction")
    parser.add_argument("--demo",        action="store_true", help="Print demo output")
    parser.add_argument("--temp",        type=float, default=25.0,  help="Temperature (°C)")
    parser.add_argument("--rain",        type=float, default=800.0, help="Rainfall (mm)")
    parser.add_argument("--n",           type=float, default=80.0,  help="Nitrogen (kg/ha)")
    parser.add_argument("--p",           type=float, default=40.0,  help="Phosphorus (kg/ha)")
    parser.add_argument("--k",           type=float, default=40.0,  help="Potassium (kg/ha)")
    parser.add_argument("--area",        type=float, default=1.0,   help="Area (hectares)")
    parser.add_argument("--ph",          type=float, default=7.0,   help="Soil pH")
    parser.add_argument("--humidity",    type=float, default=60.0,  help="Humidity (%)")
    parser.add_argument("--irrigation",  type=float, default=0.5,   help="Irrigation score 0-1")
    args = parser.parse_args()

    if args.train:
        train()
    elif args.predict:
        result = predict_yield(
            temp=args.temp, rain=args.rain, n=args.n, p=args.p, k=args.k,
            area=args.area, ph=args.ph, humidity=args.humidity, irrigation=args.irrigation
        )
        print(json.dumps(result, indent=2))
    elif args.demo:
        demo_output()
    else:
        parser.print_help()
