import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Package, Factory } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PriceChart } from '@/components/charts/PriceChart';
import { priceForecast } from '@/api/agriApi';
import { useLanguage } from '@/hooks/useLanguage';

export default function MarketPrice() {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const [formData, setFormData] = useState({
    crop: '', location: '', quantity_quintals: '', current_price: ''
  });

  const handleChange = (e) => setFormData({ ...formData, [e.target.id]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const payload = {
        crop: formData.crop,
        location: formData.location,
        quantity_quintals: formData.quantity_quintals ? parseFloat(formData.quantity_quintals) : undefined,
        current_price: formData.current_price ? parseFloat(formData.current_price) : undefined,
        language
      };
      const res = await priceForecast(payload);
      setResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getTrendColor = (trend) => {
    const t = trend?.toLowerCase() || '';
    if (t.includes('increas') || t.includes('up')) return 'success';
    if (t.includes('decreas') || t.includes('down')) return 'danger';
    return 'warning';
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl text-text-primary mb-2">💰 Market Price Insights</h1>
        <p className="text-text-secondary">Analyze APMC data and AI forecasts to time your market sales perfectly.</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">
          <Input id="crop" label="Crop Name" required value={formData.crop} onChange={handleChange} placeholder="e.g. Soybean" className="flex-1" />
          <Input id="location" label="Market Location (City/APMC)" required value={formData.location} onChange={handleChange} placeholder="e.g. Latur" className="flex-1" />
          <Input id="quantity_quintals" label="Quantity (Quintals)" type="number" step="0.1" value={formData.quantity_quintals} onChange={handleChange} placeholder="Optional" className="w-full md:w-32" />
          <Input id="current_price" label="Current Price (₹)" type="number" step="1" value={formData.current_price} onChange={handleChange} placeholder="Optional" className="w-full md:w-32" />
          <Button type="submit" loading={loading} className="w-full md:w-auto px-6 whitespace-nowrap">
            {loading ? "Forecasting..." : "Get Forecast"}
          </Button>
        </form>
      </Card>

      {result && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
          <Card className="mb-6">
            <div className="flex flex-wrap items-center justify-between mb-2">
              <div>
                <h2 className="text-lg text-text-secondary mb-1">Current Estimations for {result.crop} in {result.location}</h2>
                <div className="text-3xl md:text-4xl font-sora font-bold text-text-primary">
                  {result.current_price_range}
                </div>
              </div>
              <div className="text-right mt-4 md:mt-0">
                <p className="text-sm font-medium mb-1">Predicted Trend</p>
                <Badge variant={getTrendColor(result.predicted_trend)} className="text-sm px-3 py-1 uppercase font-bold">
                  {result.predicted_trend}
                </Badge>
              </div>
            </div>
            
            <PriceChart data={result.price_forecast} />
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card className="bg-gradient-to-br from-white to-green-50 border-green-100 flex flex-col items-center text-center p-6">
              <Calendar className="w-10 h-10 text-green-600 mb-4" />
              <h4 className="font-semibold text-text-primary mb-2">Best Selling Window</h4>
              <p className="text-sm text-text-secondary">{result.best_selling_window}</p>
            </Card>

            <Card className="bg-gradient-to-br from-white to-sky-50 border-sky-100 flex flex-col items-center text-center p-6">
              <Package className="w-10 h-10 text-sky-600 mb-4" />
              <h4 className="font-semibold text-text-primary mb-2">Market Demand</h4>
              <p className="text-sm text-text-secondary">{result.market_demand}</p>
            </Card>

            <Card className="bg-gradient-to-br from-white to-amber-50 border-amber-100 flex flex-col items-center text-center p-6">
              <Factory className="w-10 h-10 text-amber-600 mb-4" />
              <h4 className="font-semibold text-text-primary mb-2">Storage / Export Advice</h4>
              <p className="text-sm text-text-secondary">{result.storage_advice} {result.export_potential}</p>
            </Card>
          </div>

          <div>
            <h4 className="font-medium text-text-secondary mb-3">Key Price Factors</h4>
            <div className="flex flex-wrap gap-2">
              {result.price_factors?.map((factor, i) => (
                <span key={i} className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full border border-gray-200">
                  {factor}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
