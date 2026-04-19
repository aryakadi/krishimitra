import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { cropRecommendation } from '@/api/agriApi';
import { useLanguage } from '@/hooks/useLanguage';

export default function CropRecommendation() {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  const [formData, setFormData] = useState({
    nitrogen: '', phosphorus: '', potassium: '', 
    ph: '', rainfall: '', temperature: '', 
    humidity: '', region: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const payload = {
        nitrogen: parseFloat(formData.nitrogen) || 0,
        phosphorus: parseFloat(formData.phosphorus) || 0,
        potassium: parseFloat(formData.potassium) || 0,
        ph: parseFloat(formData.ph) || 7,
        rainfall: parseFloat(formData.rainfall) || 0,
        temperature: parseFloat(formData.temperature) || 25,
        humidity: parseFloat(formData.humidity) || 0,
        region: formData.region,
        language
      };
      const res = await cropRecommendation(payload);
      setResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (conf) => {
    const c = conf?.toLowerCase() || '';
    if (c.includes('high')) return 'success';
    if (c.includes('medium')) return 'warning';
    return 'neutral';
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl text-text-primary mb-2">🌱 Crop Advisor</h1>
        <p className="text-text-secondary">Enter your soil and climate parameters for customized AI recommendations.</p>
      </div>

      <Card className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input id="nitrogen" label="Nitrogen (kg/ha)" type="number" step="0.1" required value={formData.nitrogen} onChange={handleChange} />
            <Input id="phosphorus" label="Phosphorus (kg/ha)" type="number" step="0.1" required value={formData.phosphorus} onChange={handleChange} />
            <Input id="potassium" label="Potassium (kg/ha)" type="number" step="0.1" required value={formData.potassium} onChange={handleChange} />
            <Input id="ph" label="Soil pH" type="number" step="0.1" min="0" max="14" required value={formData.ph} onChange={handleChange} />
            <Input id="rainfall" label="Rainfall (mm)" type="number" step="0.1" required value={formData.rainfall} onChange={handleChange} />
            <Input id="temperature" label="Temperature (°C)" type="number" step="0.1" required value={formData.temperature} onChange={handleChange} />
            <Input id="humidity" label="Humidity (%)" type="number" step="0.1" value={formData.humidity} onChange={handleChange} />
            <Input id="region" label="Region / State" type="text" value={formData.region} onChange={handleChange} placeholder="e.g. Maharashtra" />
          </div>
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
            {loading ? "Consulting Gemini AI..." : "Get Crop Recommendations"}
          </Button>
        </form>
      </Card>

      {result && (
        <motion.div 
          className="mt-8 space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ staggerChildren: 0.2 }}
        >
          <div className="bg-green-50 p-4 rounded-md border border-green-200">
            <h3 className="font-semibold text-green-900 mb-2">Soil Health Summary</h3>
            <p className="text-green-800 text-sm">{result.soil_health_summary}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {result.recommendations?.map((rec, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15 }}
                className="relative"
              >
                {i === 0 && (
                  <div className="absolute -top-3 inset-x-0 mx-auto w-max px-3 py-1 bg-green-700 text-white text-xs font-bold rounded-full z-10 shadow-sm border-2 border-white">
                    ⭐ Best Match
                  </div>
                )}
                <Card className={`h-full flex flex-col ${i === 0 ? 'border-2 border-green-500 shadow-md' : ''}`}>
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-text-primary capitalize">{rec.crop}</h3>
                    <Badge variant={getConfidenceColor(rec.confidence)}>{rec.confidence}</Badge>
                  </div>
                  <p className="text-sm text-text-secondary mb-4 flex-grow">{rec.reason}</p>
                  
                  <div className="space-y-2 mt-auto text-sm border-t border-border-color pt-4">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Season:</span>
                      <span className="font-medium text-text-primary">{rec.ideal_season}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Water:</span>
                      <span className="font-medium text-text-primary">{rec.water_requirement}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Expected Yield:</span>
                      <span className="font-medium text-green-700">{rec.expected_yield}</span>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {result.additional_tips && (
            <div className="bg-amber-50 p-4 rounded-md border border-amber-200">
              <h3 className="font-semibold text-amber-900 mb-2">Additional Expert Tips</h3>
              <p className="text-amber-800 text-sm">{result.additional_tips}</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
