"""
AgriSmart AI — Disease Detection CNN (MobileNetV2 Transfer Learning)
======================================================================
ACADEMIC TRAINING SCRIPT — Run offline, not imported by the live API.

Dataset: PlantVillage (38 disease classes)
Architecture: MobileNetV2 (ImageNet pre-trained) + custom classifier head
Task: Multi-class image classification for plant disease detection

Setup:
    pip install -r requirements_ml.txt
    # Download PlantVillage from Kaggle:
    kaggle datasets download -d abdallahalidev/plantvillage-dataset
    unzip plantvillage-dataset.zip -d ./data/plantvillage

Run:
    python ml/disease_cnn.py --train
    python ml/disease_cnn.py --predict data/sample_leaf.jpg
"""

import os
import sys
import json
import argparse
import logging
import numpy as np
from pathlib import Path
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ─── Check TensorFlow availability ──────────────────────────────────────────
try:
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers
    from tensorflow.keras.applications import MobileNetV2
    from tensorflow.keras.preprocessing.image import ImageDataGenerator
    TF_AVAILABLE = True
    logger.info(f"TensorFlow {tf.__version__} loaded.")
except ImportError:
    TF_AVAILABLE = False
    logger.warning("TensorFlow not installed. Run: pip install tensorflow")

# ─── Constants ───────────────────────────────────────────────────────────────
IMG_SIZE   = (224, 224)    # MobileNetV2 input size
BATCH_SIZE = 32
EPOCHS     = 15
DATA_DIR   = Path("data/plantvillage/color")
MODEL_DIR  = Path("ml/models")
MODEL_PATH = MODEL_DIR / "disease_cnn_mobilenet.h5"

# Known PlantVillage classes (subset sample)
DISEASE_CLASSES = [
    "Apple___Apple_scab", "Apple___Black_rot", "Apple___Cedar_apple_rust", "Apple___healthy",
    "Corn___Cercospora_leaf_spot", "Corn___Common_rust", "Corn___Northern_Leaf_Blight", "Corn___healthy",
    "Grape___Black_rot", "Grape___Esca", "Grape___Leaf_blight", "Grape___healthy",
    "Potato___Early_blight", "Potato___Late_blight", "Potato___healthy",
    "Rice___Brown_spot", "Rice___Hispa", "Rice___Leaf_blast", "Rice___healthy",
    "Tomato___Bacterial_spot", "Tomato___Early_blight", "Tomato___Late_blight",
    "Tomato___Leaf_Mold", "Tomato___Septoria_leaf_spot", "Tomato___healthy",
    "Wheat___Brown_rust", "Wheat___Yellow_rust", "Wheat___Septoria", "Wheat___healthy",
]


def build_model(num_classes: int) -> "keras.Model":
    """
    Build MobileNetV2-based transfer learning model.
    - Freeze base layers (pre-trained ImageNet weights)
    - Add custom classifier head with dropout for regularisation
    """
    base_model = MobileNetV2(
        input_shape=(*IMG_SIZE, 3),
        include_top=False,
        weights="imagenet"
    )
    # Freeze all base layers initially
    base_model.trainable = False

    inputs  = keras.Input(shape=(*IMG_SIZE, 3))
    x       = base_model(inputs, training=False)
    x       = layers.GlobalAveragePooling2D()(x)
    x       = layers.Dense(256, activation="relu")(x)
    x       = layers.Dropout(0.3)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)

    model = keras.Model(inputs, outputs, name="AgriSmart_DiseaseDetector")
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-3),
        loss="categorical_crossentropy",
        metrics=["accuracy"]
    )
    logger.info(f"Model built: {model.count_params():,} parameters, {num_classes} classes")
    return model


def get_data_generators(data_dir: Path):
    """Create train/validation/test data generators with augmentation."""
    train_datagen = ImageDataGenerator(
        rescale=1.0 / 255,
        rotation_range=25,
        width_shift_range=0.15,
        height_shift_range=0.15,
        shear_range=0.1,
        zoom_range=0.15,
        horizontal_flip=True,
        vertical_flip=False,
        brightness_range=[0.8, 1.2],
        validation_split=0.2,
    )
    val_datagen = ImageDataGenerator(rescale=1.0 / 255, validation_split=0.2)

    train_gen = train_datagen.flow_from_directory(
        data_dir, target_size=IMG_SIZE, batch_size=BATCH_SIZE,
        class_mode="categorical", subset="training", seed=42
    )
    val_gen = val_datagen.flow_from_directory(
        data_dir, target_size=IMG_SIZE, batch_size=BATCH_SIZE,
        class_mode="categorical", subset="validation", seed=42
    )
    return train_gen, val_gen


def fine_tune(model: "keras.Model", base_model_name: str = "mobilenetv2"):
    """
    Phase 2: Unfreeze top layers of base model for fine-tuning.
    Reduces LR to avoid destroying pre-trained weights.
    """
    base_model = model.get_layer(base_model_name)
    base_model.trainable = True
    # Only fine-tune top 30 layers
    for layer in base_model.layers[:-30]:
        layer.trainable = False

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-5),
        loss="categorical_crossentropy",
        metrics=["accuracy"]
    )
    logger.info("Fine-tuning: top 30 layers of MobileNetV2 unfrozen")
    return model


def train():
    """Full training pipeline: phase 1 (frozen) + phase 2 (fine-tune)."""
    if not TF_AVAILABLE:
        print("ERROR: TensorFlow required for training. pip install tensorflow")
        sys.exit(1)

    if not DATA_DIR.exists():
        print(f"ERROR: Data directory not found: {DATA_DIR}")
        print("Download PlantVillage: kaggle datasets download -d abdallahalidev/plantvillage-dataset")
        sys.exit(1)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    train_gen, val_gen = get_data_generators(DATA_DIR)
    num_classes = len(train_gen.class_indices)
    logger.info(f"Dataset: {train_gen.n} training images, {val_gen.n} validation images, {num_classes} classes")

    # Save class mapping
    class_map = {v: k for k, v in train_gen.class_indices.items()}
    with open(MODEL_DIR / "class_map.json", "w") as f:
        json.dump(class_map, f, indent=2)
    logger.info(f"Class map saved to {MODEL_DIR}/class_map.json")

    model = build_model(num_classes)

    # Callbacks
    callbacks = [
        keras.callbacks.ModelCheckpoint(str(MODEL_PATH), save_best_only=True, monitor="val_accuracy"),
        keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True),
        keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=3, min_lr=1e-7),
    ]

    # Phase 1: Train head only
    logger.info("Phase 1: Training classifier head (base frozen)...")
    history1 = model.fit(
        train_gen, validation_data=val_gen,
        epochs=10, callbacks=callbacks,
        workers=4, use_multiprocessing=True
    )

    # Phase 2: Fine-tune
    model = fine_tune(model)
    logger.info("Phase 2: Fine-tuning top layers...")
    history2 = model.fit(
        train_gen, validation_data=val_gen,
        epochs=EPOCHS, callbacks=callbacks,
        workers=4, use_multiprocessing=True
    )

    # Evaluate
    val_loss, val_acc = model.evaluate(val_gen)
    logger.info(f"Final → Val Accuracy: {val_acc:.4f}, Val Loss: {val_loss:.4f}")

    # Save training report
    report = {
        "model": "MobileNetV2 Transfer Learning",
        "num_classes": num_classes,
        "val_accuracy": float(val_acc),
        "val_loss": float(val_loss),
        "epochs_trained": len(history1.history["loss"]) + len(history2.history["loss"]),
        "total_params": int(model.count_params()),
        "trained_at": datetime.utcnow().isoformat(),
        "class_map": class_map
    }
    with open(MODEL_DIR / "training_report.json", "w") as f:
        json.dump(report, f, indent=2)
    logger.info(f"Training complete. Model saved to {MODEL_PATH}")


def predict(image_path: str, top_k: int = 3):
    """
    Predict disease from a single image file.
    Returns top-k predictions with confidence scores.
    """
    if not TF_AVAILABLE:
        # Demo output when TF not installed
        print(json.dumps({
            "predictions": [
                {"class": "Tomato___Late_blight", "confidence": 0.87, "human_label": "Tomato Late Blight"},
                {"class": "Tomato___Early_blight", "confidence": 0.09, "human_label": "Tomato Early Blight"},
                {"class": "Tomato___healthy", "confidence": 0.04, "human_label": "Tomato Healthy"},
            ],
            "note": "Demo output — TensorFlow not installed"
        }, indent=2))
        return

    if not MODEL_PATH.exists():
        print(f"ERROR: Model not found at {MODEL_PATH}. Run --train first.")
        sys.exit(1)

    class_map_path = MODEL_DIR / "class_map.json"
    with open(class_map_path) as f:
        class_map = json.load(f)

    model = keras.models.load_model(str(MODEL_PATH))

    # Preprocess image
    img = keras.utils.load_img(image_path, target_size=IMG_SIZE)
    arr = keras.utils.img_to_array(img) / 255.0
    arr = np.expand_dims(arr, axis=0)

    probs = model.predict(arr, verbose=0)[0]
    top_indices = probs.argsort()[-top_k:][::-1]

    results = [
        {
            "class": class_map[str(i)],
            "confidence": float(probs[i]),
            "human_label": class_map[str(i)].replace("___", " — ").replace("_", " ")
        }
        for i in top_indices
    ]
    print(json.dumps({"predictions": results}, indent=2))


def demo_output():
    """Print synthetic demo output showing what the model would produce."""
    output = {
        "model": "MobileNetV2 Transfer Learning (AgriSmart v1)",
        "input": "demo_leaf.jpg",
        "predictions": [
            {"rank": 1, "disease": "Rice Leaf Blast",         "confidence": 0.8732, "urgency": "high"},
            {"rank": 2, "disease": "Rice Brown Spot",         "confidence": 0.0891, "urgency": "medium"},
            {"rank": 3, "disease": "Rice Healthy",            "confidence": 0.0377, "urgency": "low"},
        ],
        "feature_maps": "Available in saved model for GradCAM visualization",
        "model_path": str(MODEL_PATH),
        "training_data": "PlantVillage Dataset (54,306 images, 38 classes)",
        "val_accuracy": "94.7%",
        "note": "Actual results depend on trained weights"
    }
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AgriSmart Disease CNN (MobileNetV2)")
    parser.add_argument("--train",   action="store_true", help="Train the CNN model")
    parser.add_argument("--predict", type=str,            help="Path to image for prediction")
    parser.add_argument("--demo",    action="store_true", help="Print demo output (no TF needed)")
    parser.add_argument("--topk",    type=int, default=3, help="Number of top predictions to return")
    args = parser.parse_args()

    if args.train:
        train()
    elif args.predict:
        predict(args.predict, top_k=args.topk)
    elif args.demo:
        demo_output()
    else:
        parser.print_help()
