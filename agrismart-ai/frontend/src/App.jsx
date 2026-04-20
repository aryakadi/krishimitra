import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import CropRecommendation from './pages/CropRecommendation';
import DiseaseDetection from './pages/DiseaseDetection';
import YieldPrediction from './pages/YieldPrediction';
import MarketPrice from './pages/MarketPrice';
import Chatbot from './pages/Chatbot';
import Analytics from './pages/Analytics';

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="crop" element={<CropRecommendation />} />
          <Route path="disease" element={<DiseaseDetection />} />
          <Route path="yield" element={<YieldPrediction />} />
          <Route path="market" element={<MarketPrice />} />
          <Route path="chat" element={<Chatbot />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
