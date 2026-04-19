import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Lightbulb, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { yieldPrediction } from '@/api/agriApi';
import { useLanguage } from '@/hooks/useLanguage';

export default function YieldPrediction() {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const [formData, setFormData] = useState({
    crop_type: '', region: '', area_hectares: '', season: 'Kharif',
    soil_type: 'Loamy', irrigation: 'Rainfed', fertilizer_used: '', previous_yield: ''
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
        ...formData,
        area_hectares: parseFloat(formData.area_hectares) || 1,
        previous_yield: formData.previous_yield ? parseFloat(formData.previous_yield) : undefined,
        language
      };
      const res = await yieldPrediction(payload);
      setResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl text-text-primary mb-2">📈 Yield Prediction</h1>
        <p className="text-text-secondary">Estimate your expected harvest volume based on local conditions.</p>
      </div>

      <Card className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input id="crop_type" label="Crop Type" required value={formData.crop_type} onChange={handleChange} placeholder="e.g. Wheat" />
            <Input id="region" label="Region / State" required value={formData.region} onChange={handleChange} placeholder="e.g. Punjab" />
            <Input id="area_hectares" label="Area (Hectares)" type="number" step="0.1" required value={formData.area_hectares} onChange={handleChange} />
            
            <div className="flex flex-col gap-1 w-full">
              <label htmlFor="season" className="text-sm font-medium text-text-primary">Season</label>
              <select 
                id="season" 
                className="px-3 py-2 border border-border-color rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                value={formData.season} onChange={handleChange}
              >
                <option value="Kharif">Kharif</option>
                <option value="Rabi">Rabi</option>
                <option value="Zaid">Zaid</option>
              </select>
            </div>

            <div className="flex flex-col gap-1 w-full">
              <label htmlFor="soil_type" className="text-sm font-medium text-text-primary">Soil Type</label>
              <select 
                id="soil_type" 
                className="px-3 py-2 border border-border-color rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                value={formData.soil_type} onChange={handleChange}
              >
                <option value="Loamy">Loamy</option>
                <option value="Sandy">Sandy</option>
                <option value="Clay">Clay</option>
                <option value="Black">Black Soil</option>
                <option value="Red">Red Soil</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="flex flex-col gap-1 w-full">
              <label htmlFor="irrigation" className="text-sm font-medium text-text-primary">Irrigation Method</label>
              <select 
                id="irrigation" 
                className="px-3 py-2 border border-border-color rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                value={formData.irrigation} onChange={handleChange}
              >
                <option value="Drip">Drip</option>
                <option value="Sprinkler">Sprinkler</option>
                <option value="Flood">Flood / Canal</option>
                <option value="Rainfed">Rainfed</option>
              </select>
            </div>

            <Input id="fertilizer_used" label="Fertilizers Used (Optional)" value={formData.fertilizer_used} onChange={handleChange} placeholder="e.g. Urea 50kg" />
            <Input id="previous_yield" label="Prev. Yield (Tonnes) (Optional)" type="number" step="0.1" value={formData.previous_yield} onChange={handleChange} />
          </div>
          
          <Button type="submit" className="w-full lg:w-auto px-10" loading={loading}>
            {loading ? "Calculating..." : "Predict Yield"}
          </Button>
        </form>
      </Card>

      {result && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="max-w-4xl mx-auto overflow-hidden text-center mb-6 py-10 bg-gradient-to-br from-green-50 to-emerald-100 border-green-200">
            <h2 className="text-lg text-green-800 font-medium mb-2 uppercase tracking-wide">Expected Total Harvest</h2>
            <div className="text-5xl md:text-6xl font-sora font-bold text-green-900 mb-4 drop-shadow-sm">
              {result.expected_yield_tonnes} <span className="text-2xl text-green-700">Tonnes</span>
            </div>
            <p className="text-green-800 mb-3 font-medium bg-white/50 inline-block px-4 py-1.5 rounded-full shadow-sm">
              Range: {result.min_yield_tonnes} – {result.max_yield_tonnes} tonnes | Yield per Ha: {result.yield_per_hectare}
            </p>
            <p className="text-sm text-green-700 opacity-80">AI Confidence Level: {result.confidence_level}</p>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card className="border-l-4 border-l-sky-500">
              <h4 className="font-semibold flex items-center gap-2 mb-3"><BarChart className="text-sky-500 w-5 h-5"/> Influencing Factors</h4>
              <ul className="list-disc pl-5 text-sm text-text-secondary space-y-1">
                {result.influencing_factors?.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <h4 className="font-semibold flex items-center gap-2 mb-3"><Lightbulb className="text-green-500 w-5 h-5"/> Improvement Tips</h4>
              <ul className="list-disc pl-5 text-sm text-text-secondary space-y-1">
                {result.improvement_tips?.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </Card>

            <Card className="border-l-4 border-l-red-400">
              <h4 className="font-semibold flex items-center gap-2 mb-3"><AlertTriangle className="text-red-400 w-5 h-5"/> Risk Factors</h4>
              <ul className="list-disc pl-5 text-sm text-text-secondary space-y-1">
                {result.risk_factors?.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </Card>
          </div>
        </motion.div>
      )}
    </div>
  );
}
