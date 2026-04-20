import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({ baseURL: API_BASE, timeout: 60000 });

// ─── Existing endpoints ───────────────────────────────────────────────────────
export const getCropRecommendation   = (data) => api.post('/crop-recommendation', data);
export const detectDisease           = (formData) => api.post('/disease-detection', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const predictYield            = (data) => api.post('/yield-prediction', data);
export const getPriceForecast        = (data) => api.post('/price-forecast', data);
export const sendChat                = (data) => api.post('/chat', data);
export const getWeather              = (params) => api.get('/weather', { params });
export const searchCities            = (q) => api.get('/weather/search', { params: { q } });

// ─── ADBMS-spec aliased endpoints ────────────────────────────────────────────
export const predictDisease          = (formData) => api.post('/predict-disease', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const predictYieldAdbms       = (data) => api.post('/predict-yield', data);
export const predictPrice            = (data) => api.post('/predict-price', data);

// ─── Analytics — Snowflake-powered ───────────────────────────────────────────
export const fetchAnalyticsSummary   = ()              => api.get('/analytics/summary');
export const fetchAnalytics          = ()              => api.get('/analytics');
export const fetchCropTrends         = ()              => api.get('/analytics/crop-trends');
export const fetchDiseaseTrends      = ()              => api.get('/analytics/disease-trends');
export const fetchYieldComparison    = ()              => api.get('/analytics/yield-comparison');
export const fetchPriceHistory       = (crop, loc='') => api.get('/analytics/price-history', { params: { crop, location: loc } });

// ─── Data Warehouse info ──────────────────────────────────────────────────────
export const fetchTableCounts        = ()              => api.get('/dw/table-counts');

// ─── Feedback Loop ────────────────────────────────────────────────────────────
export const submitFeedback          = (data)          => api.post('/feedback', data);
export const fetchFeedbackSummary    = ()              => api.get('/feedback/summary');

// ─── PDF Report ───────────────────────────────────────────────────────────────
export const generateReport = (data) => api.post('/report/generate', data);

// ─── Backward-compat aliases (used by existing page components) ───────────────
export const cropRecommendation      = (data) => getCropRecommendation(data).then(r => r.data);
export const diseaseDetection        = (formData) => detectDisease(formData).then(r => r.data);
export const yieldPrediction         = (data) => predictYield(data).then(r => r.data);
export const priceForecast           = (data) => getPriceForecast(data).then(r => r.data);
export const fetchWeather            = (city) => getWeather({ city }).then(r => r.data);
export const fetchWeatherByCoords    = (lat, lon) => getWeather({ lat, lon }).then(r => r.data);

// ─── Utility: download base64 PDF ────────────────────────────────────────────
export const downloadPdfReport = async (requestData) => {
  const res = await generateReport(requestData);
  const { pdf_base64, filename } = res.data;
  const bytes  = atob(pdf_base64);
  const buffer = new Uint8Array(bytes.length).map((_, i) => bytes.charCodeAt(i));
  const blob   = new Blob([buffer], { type: 'application/pdf' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href = url; a.download = filename || 'agrismart_report.pdf'; a.click();
  URL.revokeObjectURL(url);
};
