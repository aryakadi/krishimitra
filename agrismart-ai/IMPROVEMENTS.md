# KrishiMitra / AgriSmart AI — Improvement Roadmap
> Branch: `feature/abhijit-enhancements`
> Repo: https://github.com/aryakadi/krishimitra.git
> Author: Abhijit Khole
> Date: 2026-04-20

---

## 🔒 Priority 1 — Security & Robustness (Fix First)

### 1.1 Add Rate Limiting to Backend
- [ ] Install `slowapi==0.1.9`
- [ ] Add `@limiter.limit("10/minute")` to all 5 routers
- [ ] Prevents Gemini API quota abuse from spam requests

### 1.2 Add Input Sanitization
- [ ] Add `max_length=1000` to `ChatRequest.message` in `schemas.py`
- [ ] Add `max_length=20` to `ChatRequest.history`
- [ ] Add `min_length=1` validation to all required string fields

### 1.3 Validate Environment Variables on Startup
- [ ] Raise `RuntimeError` in `config.py` if `GEMINI_API_KEY` is missing/empty
- [ ] Log a clear startup error instead of silently failing on first request

---

## 🚀 Priority 2 — High-Impact New Features

### 2.1 🌦️ Live Weather Integration
- [ ] Integrate **OpenWeatherMap API** (free tier: 1000 calls/day)
- [ ] New backend endpoint: `GET /api/v1/weather?city=Pune`
- [ ] Returns: `{ temperature, humidity, rainfall_7day, forecast }`
- [ ] Add **"Auto-fill from my location"** button on Crop Recommendation page
- [ ] Removes manual data entry — biggest UX friction point

### 2.2 📸 Crop Disease History / Gallery
- [ ] After detection, save result to browser `localStorage`
- [ ] Store: `{ date, disease_name, urgency_level, image_preview }`
- [ ] Add **"Past Diagnoses"** collapsible panel on Disease Detection page
- [ ] Allow farmers to refer back to old diagnoses

### 2.3 📊 Analytics Dashboard
- [ ] New page: `/analytics`
- [ ] New backend endpoint: `GET /api/v1/analytics/summary`
- [ ] Query Snowflake `FACT_*` tables for:
  - Most detected diseases this week
  - Most recommended crops by region
  - Usage counts per feature
- [ ] Visualize with **Recharts** (already installed in project)
- [ ] Makes use of Snowflake data that is currently being logged but never displayed

### 2.4 📄 PDF Report Generation
- [ ] Install `jspdf` and `jspdf-autotable`
- [ ] Add **"Download Report"** button on result cards (Crop, Yield, Disease)
- [ ] Generate formatted PDF with farmer inputs + AI results
- [ ] Farmers can print and take to the field

### 2.5 🗺️ Regional Crop Map
- [ ] Install `react-simple-maps`
- [ ] Add India map showing most recommended crops per state
- [ ] Data sourced from Snowflake `FACT_CROP_RECOMMENDATION`

### 2.6 🔔 WhatsApp / SMS Alerts
- [ ] Integrate **Twilio** or **MSG91**
- [ ] After disease detection, if urgency is `high` or `critical`:
  - Auto-send SMS with disease name + first treatment step
- [ ] Useful for farmers without smartphones who share a phone

---

## 🎨 Priority 3 — UX Improvements

### 3.1 Loading Skeletons
- [ ] Replace spinner/text with animated skeleton placeholder cards
- [ ] More professional than "Consulting Gemini AI..." text
- [ ] Implement for: Crop, Disease, Yield, Market pages

### 3.2 🎤 Voice Input for Chatbot
- [ ] Add microphone button next to chat input
- [ ] Use browser-native **Web Speech API** (no library needed)
- [ ] Set language: `hi-IN` for Hindi, `mr-IN` for Marathi, `en-US` for English
- [ ] Critical for semi-literate farmers

### 3.3 🌙 Dark Mode Toggle
- [ ] Add dark/light toggle button in Layout navbar
- [ ] Toggle `dark` class on `<html>` element
- [ ] Tailwind already supports `darkMode: 'class'`
- [ ] Store preference in `localStorage`

### 3.4 💾 Share Results
- [ ] Add "Share via WhatsApp" button on result cards
- [ ] Pre-formatted message with crop name, disease, yield range
- [ ] Add "Copy to Clipboard" button as well

### 3.5 📋 Farm Profile / Saved Inputs
- [ ] Let farmers save their profile: NPK values, region, soil type
- [ ] Store in `localStorage`
- [ ] Auto-fill forms with saved profile on page load
- [ ] "Load My Profile" button on Crop and Yield pages

---

## ⚙️ Priority 4 — Backend Reliability

### 4.1 Gemini Retry Logic
- [ ] Wrap all `model.generate_content()` calls in a retry function
- [ ] Use **exponential backoff**: 1s → 2s → 4s (3 retries)
- [ ] Prevents failures from transient Gemini network errors

### 4.2 Response Caching
- [ ] Install `cachetools==5.3.2`
- [ ] Cache identical crop recommendation requests for 1 hour
- [ ] Cache key: combination of all input parameters + language
- [ ] Saves Gemini API quota for repeated queries

### 4.3 Enhanced Health Check
- [ ] New endpoint: `GET /health/full`
- [ ] Tests connectivity to both Gemini and Snowflake
- [ ] Returns: `{ api: "healthy", gemini: true/false, snowflake: true/false }`

---

## 🏆 Priority 5 — Competition / Demo Features

| Feature | Why it Impresses |
|---|---|
| Farmer Login / Profile System | Shows user management thinking |
| Offline Mode (PWA) | Works without internet — huge for rural India |
| Camera Capture on Mobile | Direct camera → disease detection (no file upload) |
| Multi-image Disease Scan | Upload 3 leaf photos, get consensus diagnosis |
| Satellite Crop Monitoring (NASA NDVI API) | Show crop health from space — visually stunning |
| Real Mandi Price API (Agmarknet) | Live Indian market prices instead of AI estimates |
| Seasonal Planting Calendar | What to plant/harvest month by month for your region |
| Multilingual UI (not just responses) | Full Hindi/Marathi interface, not just AI replies |

---

## 📅 Recommended Implementation Order

| Week | Tasks |
|---|---|
| Week 1 | Rate limiting + Input validation + Retry logic |
| Week 2 | Weather API auto-fill + PDF report download |
| Week 3 | Voice input + Dark mode + Skeleton loaders |
| Week 4 | Analytics dashboard + Disease history |
| Week 5+ | WhatsApp alerts + Farmer profiles + PWA support |

---

## 🔧 Git Workflow

```bash
# You are on: feature/abhijit-enhancements
# Repo: https://github.com/aryakadi/krishimitra.git

# Save your work
git add .
git commit -m "feat: describe what you added"

# Push to GitHub
git push -u origin feature/abhijit-enhancements

# Switch branches
git checkout main
git checkout feature/abhijit-enhancements
```
