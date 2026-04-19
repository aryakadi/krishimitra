# AgriSmart AI 🌾

A full-stack, AI-powered agricultural decision support web application built to empower farmers with data-driven insights. AgriSmart AI leverages Google Gemini's advanced multimodal capabilities to deliver multilingual crop recommendations, disease diagnosis, yield predictions, market insights, and an interactive farming assistant.

## Tech Stack

| Component | Technology |
|---|---|
| **Frontend** | React, Vite, Tailwind CSS, Recharts, Framer Motion, Lucide React, Axios |
| **Backend** | FastAPI (Python), Uvicorn, Pydantic |
| **Database** | Snowflake (Star Schema architecture) |
| **AI Integration** | Google Gemini API (gemini-1.5-flash for text & vision) |

## Prerequisites
- Python 3.11+
- Node.js 18+
- Active Snowflake Account
- Google Gemini API Key

## Local Setup

### 1. Database Initialization
Copy the data definition from `database/schema.sql` and run it in a Snowflake worksheet to create the necessary databases, schemas, warehouses, dimension tables, and fact tables.

### 2. Backend Setup
Navigate to the backend directory and set up the Python environment:

```bash
cd backend
python -m venv venv
# On Windows: venv\\Scripts\\activate
# On Mac/Linux: source venv/bin/activate

pip install -r requirements.txt
```

Set up your environment variables:
```bash
cp .env.example .env
```
Fill in `.env` with your actual Snowflake credentials and Gemini API Key.

Start the FastAPI development server:
```bash
uvicorn app.main:app --reload --port 8000
```
API Documentation will be available at: http://localhost:8000/docs

### 3. Frontend Setup
Navigate to the frontend directory:

```bash
cd frontend
npm install
cp .env.example .env.local
```

Start the Vite development server:
```bash
npm run dev
```
The application will safely run on http://localhost:5173

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/crop-recommendation` | Crop suggestions derived from NPK, pH, and climate data. |
| POST | `/api/v1/disease-detection`   | Diagnoses leaf diseases using Gemini Vision. |
| POST | `/api/v1/yield-prediction`    | Predicts expected harvest yield range and provides insights. |
| POST | `/api/v1/price-forecast`      | Short-term market price outlook for crops. |
| POST | `/api/v1/chat`                | Multilingual interactive farming assistant. |

## Sample API Request (Crop Recommendation)

```bash
curl -X POST "http://localhost:8000/api/v1/crop-recommendation" \
     -H "Content-Type: application/json" \
     -d '{
           "nitrogen": 120,
           "phosphorus": 60,
           "potassium": 40,
           "ph": 6.8,
           "rainfall": 800,
           "temperature": 28,
           "humidity": 75,
           "region": "Maharashtra",
           "language": "en"
         }'
```

## Environment Variables
Ensure the following variables are established in your deployments.

| Variable | Location | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | Backend | Authentic Google Generative AI access. |
| `SNOWFLAKE_ACCOUNT` | Backend | Target Snowflake account identifier. |
| `SNOWFLAKE_USER` | Backend | Database username. |
| `SNOWFLAKE_PASSWORD` | Backend | Database password. |
| `VITE_API_BASE_URL` | Frontend | Defines the internal route to FastAPI endpoint. |

## Deployment Guide

### 1. Deploying Frontend to Vercel
Vercel provides the easiest way to deploy Vite React applications.

1. Create a GitHub repository and push your entire source code.
2. Log in to [Vercel](https://vercel.com/) and click **Add New Panel > Project**.
3. Import your GitHub repository.
4. Configure the Build settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend` (Important! Select the frontend folder)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. **Environment Variables**:
   - Add `VITE_API_BASE_URL` and set its value to your deployed Render backend URL (e.g., `https://agrismart-backend.onrender.com/api/v1`).
6. Click **Deploy**. Vercel will build and assign you a live HTTPS domain.

### 2. Deploying Backend to Render
Render natively supports Python web services.

1. Ensure your `.gitignore` doesn't ignore `requirements.txt` and push to GitHub.
2. Log in to [Render](https://render.com/) and click **New > Web Service**.
3. Connect your GitHub repository.
4. Configure the Web Service:
   - **Root Directory**: `backend` (Important! Select the backend folder)
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. **Environment Variables** (Click "Advanced"):
   - Add `GEMINI_API_KEY`, `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_USER`, `SNOWFLAKE_PASSWORD`, etc. from your local `.env`.
   - Add `ALLOWED_ORIGINS` and set it to your new Vercel domain, e.g., `["https://agrismart-ai.vercel.app"]`
6. Click **Create Web Service**. Render will install dependencies and start your FastAPI server securely.

---
**Note:** All DB logging logic is implemented non-blockingly. If Snowflake credentials are omitted or incorrect in production, core Gemini generation will gracefully fallback.
