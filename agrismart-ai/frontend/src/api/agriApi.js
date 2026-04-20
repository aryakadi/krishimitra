import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  timeout: 60000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.detail || error.message || 'An error occurred';
    toast.error(message);
    return Promise.reject(error);
  }
);

export const cropRecommendation = async (payload) => {
  const { data } = await api.post('/crop-recommendation', payload);
  return data;
};

export const diseaseDetection = async (formData) => {
  const { data } = await api.post('/disease-detection', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const yieldPrediction = async (payload) => {
  const { data } = await api.post('/yield-prediction', payload);
  return data;
};

export const priceForecast = async (payload) => {
  const { data } = await api.post('/price-forecast', payload);
  return data;
};

export const sendChat = async (payload) => {
  const { data } = await api.post('/chat', payload);
  return data;
};

export const searchCities = async (query) => {
  const { data } = await api.get(`/weather/search?q=${encodeURIComponent(query)}`);
  return data.results || [];
};

export const fetchWeather = async (city) => {
  const { data } = await api.get(`/weather?city=${encodeURIComponent(city)}`);
  return data;
};

export const fetchWeatherByCoords = async (lat, lon) => {
  const { data } = await api.get(`/weather?lat=${lat}&lon=${lon}`);
  return data;
};

export const fetchAnalyticsSummary = async () => {
  const { data } = await api.get('/analytics/summary');
  return data;
};
