# AgriSmart AI 🌾

**AgriSmart AI** is a premium, full-stack agricultural decision-support ecosystem. It leverages a cutting-edge **Hybrid AI Architecture** to empower farmers with real-time, data-driven insights localized in their native language (**English, Hindi, and Marathi**).

---

## 🚀 Key Improvements & New Features

### 1. Hybrid AI Model Strategy
We've transitioned to a dual-provider model to balance speed and visual precision:
*   **NVIDIA NIM (Mistral-Small-4)**: Powers the high-speed text reasoning for the **AI Chatbot**, **Crop Recommendations**, and **Market Forecasts**.
*   **Google Gemini 1.5 Flash**: Orchestrates complex **Vision Tasks** (Disease Detection) and serves as a high-fidelity fallback.

### 2. Multi-Language Localization
The entire platform is now available in:
*   **English** (Default)
*   **Hindi** (हिंदी)
*   **Marathi** (मराठी)
*   *Feature*: All AI responses, UI elements, and even PDF reports automatically adapt to the user's selected language.

### 3. Professional PDF Reporting
Farmers can now generate and download professional **Agricultural Reports** in PDF format for:
*   **Crop Advisor** results.
*   **Disease Diagnostics** (with uploaded leaf images).
*   **Yield Predictions** and **Market Price Insight** reports.

### 4. Real-Time Weather Intelligence
*   **OpenWeatherMap Integration**: Automatically fetches local Nitrogen (via soil analytics context), Temperature, and Humidity.
*   **NPK Auto-Fill**: Intelligently populates recommended soil data based on the farmer's live region.

### 5. Advanced Analytics Dashboard
*   **Snowflake Data Cloud**: Securely logs every AI interaction and agricultural query.
*   **Insights View**: A dedicated dashboard visualizing regional crop trends and high-frequency disease detection telemetry.

---

## 🛠️ Updated Tech Stack

| Component | Technology |
|---|---|
| **Frontend** | React (Vite), Tailwind CSS, Framer Motion, Lucide Icons, jsPDF |
| **Backend** | FastAPI (Python), NVIDIA NIM SDK, Google Generative AI SDK |
| **Data Lake** | Snowflake (Fact/Dimension Star Schema) |
| **External APIs** | OpenWeatherMap API |

---

## 📋 Prerequisites
- Python 3.11+
- Node.js 18+
- **API Keys**:
    - `GEMINI_API_KEY` (Google AI Studio)
    - `NVIDIA_API_KEY` (NVIDIA Build/NIM)
    - `OPENWEATHERMAP_API_KEY` (OpenWeatherMap)
- **Snowflake Account** (For telemetry logging)

---

## ⚙️ Local Setup

### 1. Backend Configuration
```bash
cd backend
python -m venv venv
# Activate venv
pip install -r requirements.txt
cp .env.example .env
```
Ensure your `.env` includes:
* `GEMINI_MODEL=gemini-1.5-flash-latest`
* `NVIDIA_MODEL=mistralai/mistral-small-4-119b-2603`
* Your Snowflake credentials and API keys.

### 2. Frontend Configuration
```bash
cd frontend
npm install
npm run dev
```

---

## 🧬 API Reference (Expanded)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/crop-recommendation` | Localized crop suggestions via NVIDIA NIM. |
| POST | `/api/v1/disease-detection`   | Vision-based leaf diagnosis via Gemini Flash. |
| POST | `/api/v1/yield-prediction`    | Harvest volume forecasting. |
| POST | `/api/v1/price-forecast`      | 3-Month Market Price Outlook. |
| GET  | `/api/v1/weather`             | Real-time regional climate data. |
| GET  | `/api/v1/analytics/summary`   | Real-time Snowflake telemetry. |

---

## 🌟 Visual Excellence
The UI has been updated with a **Premium Glassmorphism** design, supporting:
*   **Dark & Light Mode** switching.
*   **Responsive layouts** for on-field mobile usage.
*   **Micro-animations** for a smooth, high-end user experience.

---
*Built with ❤️ by ECE Students, PICT — Powered by Google Gemini & NVIDIA NIM.*
