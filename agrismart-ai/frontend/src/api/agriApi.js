import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  timeout: 30000,
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
