import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, CloudRain, Thermometer, Wind, Droplets,
  Search, Cloud, Info, CheckCircle, X, FileText
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cropRecommendation, fetchWeather, fetchWeatherByCoords, searchCities } from '@/api/agriApi';
import { useLanguage } from '@/hooks/useLanguage';
import { generateAgriReport } from '@/utils/reportUtils';
import toast from 'react-hot-toast';

// Fields that can be auto-filled from weather + still edited by user
const WEATHER_FILLABLE = ['temperature', 'humidity', 'rainfall', 'region'];

export default function CropRecommendation() {
  const { language, t } = useLanguage();

  const fieldMeta = {
    temperature: { label: t('temperature'),  type: 'number', step: '0.1', required: true  },
    humidity:    { label: t('humidity'),       type: 'number', step: '0.1', required: false },
    rainfall:    { label: t('rainfall'),      type: 'number', step: '0.1', required: true  },
    region:      { label: t('region'),     type: 'text',   placeholder: 'e.g. Maharashtra', required: false },
  };

  // ── Form state ──────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    nitrogen: '', phosphorus: '', potassium: '',
    ph: '', rainfall: '', temperature: '', humidity: '', region: '',
  });
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);

  const handleDownloadReport = () => {
    if (!result) return;
    
    generateAgriReport({
      title: t('cropAdvisor') + ' ' + (t('report') || 'Report'),
      subtitle: `${t('tagline')}`,
      language,
      farmerInputs: {
        'Nitrogen (N)': formData.nitrogen,
        'Phosphorus (P)': formData.phosphorus,
        'Potassium (K)': formData.potassium,
        'pH Level': formData.ph,
        'Temperature': `${formData.temperature}°C`,
        'Humidity': `${formData.humidity}%`,
        'Rainfall': `${formData.rainfall} mm`
      },
      aiResults: result.recommendations.map(rec => ({
        crop: rec.crop,
        reason: `${rec.reason} | Water: ${rec.water_requirement} | Season: ${rec.ideal_season}`,
        confidence: rec.confidence
      }))
    });
    toast.success('Report downloaded successfully!');
  };

  // ── Weather widget state ─────────────────────────────────────────────────────
  const [weatherCity,    setWeatherCity]    = useState('');
  const [weatherData,    setWeatherData]    = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [geoLoading,     setGeoLoading]     = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState([]);

  // Auto-suggest states
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchingCities, setIsSearchingCities] = useState(false);
  const searchRef = useRef(null);

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (weatherCity.trim().length >= 3 && showSuggestions) {
        setIsSearchingCities(true);
        try {
          const res = await searchCities(weatherCity);
          setSuggestions(res);
        } catch (e) {
          console.error(e);
        } finally {
          setIsSearchingCities(false);
        }
      } else {
        setSuggestions([]);
      }
    }, 400); // 400ms debounce
    return () => clearTimeout(timer);
  }, [weatherCity, showSuggestions]);

  // Click outside to close suggestions
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Weather handlers ─────────────────────────────────────────────────────────
  const handleWeatherSearch = async () => {
    if (!weatherCity.trim()) { toast.error('Please enter a city name'); return; }
    setWeatherLoading(true);
    try {
      const data = await fetchWeather(weatherCity.trim());
      setWeatherData(data);
      toast.success(`Weather fetched for ${data.city}, ${data.country}`);
    } catch (_) {
      // Error toast handled by Axios interceptor
    } finally {
      setWeatherLoading(false);
    }
  };

  const handleSuggestionClick = async (suggestion) => {
    setWeatherCity(suggestion.name);
    setShowSuggestions(false);
    setSuggestions([]);
    
    setWeatherLoading(true);
    try {
      const data = await fetchWeatherByCoords(suggestion.lat, suggestion.lon);
      setWeatherData(data);
      const parts = suggestion.name.split(',').map(s => s.trim());
      const detailedName = parts.length > 1 ? `${parts[0]}, ${parts[1]}` : parts[0];
      
      setWeatherCity(detailedName);
      toast.success(`Weather fetched for ${detailedName}`);
    } catch (_) {
      // Error handled by interceptor
    } finally {
      setWeatherLoading(false);
    }
  };

  const handleGeoLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude, longitude } }) => {
        try {
          const data = await fetchWeatherByCoords(latitude, longitude);
          setWeatherData(data);
          setWeatherCity(data.city);
          toast.success(`Location detected: ${data.city}, ${data.country}`);
        } catch (_) {
          // handled by interceptor
        } finally {
          setGeoLoading(false);
        }
      },
      () => {
        setGeoLoading(false);
        toast.error('Location access denied. Please enter city name manually.');
      }
    );
  };

  const applyWeatherToForm = () => {
    if (!weatherData) return;
    setFormData(prev => ({
      ...prev,
      temperature: String(weatherData.temperature),
      humidity:    String(weatherData.humidity),
      rainfall:    String(weatherData.rainfall_5day_mm),
      region:      prev.region || weatherData.city,
    }));
    setAutoFilledFields(WEATHER_FILLABLE);
    toast.success('Weather applied! Edit any field as needed.');
  };

  const clearWeather = () => {
    setWeatherData(null);
    setWeatherCity('');
    setAutoFilledFields([]);
  };

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
    if (autoFilledFields.includes(e.target.id)) {
      setAutoFilledFields(prev => prev.filter(f => f !== e.target.id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const payload = {
        nitrogen:    parseFloat(formData.nitrogen)    || 0,
        phosphorus:  parseFloat(formData.phosphorus)  || 0,
        potassium:   parseFloat(formData.potassium)   || 0,
        ph:          parseFloat(formData.ph)          || 7,
        rainfall:    parseFloat(formData.rainfall)    || 0,
        temperature: parseFloat(formData.temperature) || 25,
        humidity:    parseFloat(formData.humidity)    || 0,
        region:      formData.region,
        language,
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
    if (c.includes('high'))   return 'success';
    if (c.includes('medium')) return 'warning';
    return 'neutral';
  };

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h1 className="text-3xl text-text-primary mb-2">🌱 {t('cropAdvisor')}</h1>
        <p className="text-text-secondary">
          {t('tagline')}
        </p>
      </div>

      <Card className="border-sky-200 bg-gradient-to-br from-sky-50 to-indigo-50">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-sky-100 text-sky-600">
            <CloudRain className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sky-900 text-base">
              {t('weatherTitle')}
            </h3>
            <p className="text-xs text-sky-600">
              {t('weatherSub')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[220px]" ref={searchRef}>
            <input
              type="text"
              value={weatherCity}
              onChange={(e) => {
                setWeatherCity(e.target.value);
                setShowSuggestions(true);
              }}
              onClick={() => setShowSuggestions(true)}
              onKeyDown={(e) => e.key === 'Enter' && handleWeatherSearch()}
              placeholder={t('searchCity')}
              className="w-full border border-sky-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 bg-white shadow-sm"
            />
            <AnimatePresence>
              {showSuggestions && (weatherCity.length >= 3) && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                  className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-sky-200 rounded-lg shadow-xl overflow-hidden"
                >
                  {isSearchingCities ? (
                    <div className="px-4 py-3 text-sm text-sky-600 flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
                      {t('loading')}
                    </div>
                  ) : suggestions.length > 0 ? (
                    <ul className="max-h-60 overflow-y-auto">
                      {suggestions.map((sug, i) => (
                        <li
                          key={i}
                          onClick={() => handleSuggestionClick(sug)}
                          className="px-4 py-2.5 text-sm hover:bg-sky-50 cursor-pointer border-b border-gray-50 last:border-0 flex items-start gap-2"
                        >
                          <MapPin className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
                          <span className="text-gray-700 leading-tight">{sug.name}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="px-4 py-3 text-sm text-gray-500 text-center">
                      No cities found
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            type="button" onClick={handleWeatherSearch} disabled={weatherLoading || !weatherCity.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          >
            {weatherLoading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
          <button
            type="button" onClick={handleGeoLocation} disabled={geoLoading}
            className="flex items-center gap-1.5 px-4 py-2.5 border border-sky-300 hover:bg-sky-100 disabled:opacity-50 text-sky-700 text-sm font-medium rounded-lg transition-colors bg-white shadow-sm"
          >
            {geoLoading ? <span className="w-4 h-4 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin" /> : <MapPin className="w-4 h-4" />}
            {t('myLocation')}
          </button>
        </div>

        <AnimatePresence>
          {weatherData && (
            <motion.div
              key="weather-card" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}
              className="mt-4 bg-white rounded-xl border border-sky-200 shadow-sm overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-sky-500 to-indigo-500 text-white">
                <div className="flex items-center gap-2">
                  <img src={`https://openweathermap.org/img/wn/${weatherData.icon}@2x.png`} alt={weatherData.weather_description} className="w-11 h-11" />
                  <div>
                    <p className="font-semibold text-base leading-tight">{weatherData.city}, {weatherData.country}</p>
                    <p className="text-sky-100 text-xs">{weatherData.weather_description}</p>
                  </div>
                </div>
                <button onClick={clearWeather} className="p-1.5 hover:bg-white/20 rounded-full transition-colors"><X className="w-4 h-4" /></button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
                <div className="flex flex-col items-center text-center p-3 bg-orange-50 rounded-xl border border-orange-100">
                  <Thermometer className="w-5 h-5 text-orange-500 mb-1" />
                  <p className="text-2xl font-bold text-orange-700">{weatherData.temperature}°C</p>
                  <p className="text-xs text-orange-500 font-medium">{t('temperature')}</p>
                  <p className="text-xs text-gray-400">Feels {weatherData.feels_like}°C</p>
                </div>
                <div className="flex flex-col items-center text-center p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <Droplets className="w-5 h-5 text-blue-500 mb-1" />
                  <p className="text-2xl font-bold text-blue-700">{weatherData.humidity}%</p>
                  <p className="text-xs text-blue-500 font-medium">{t('humidity')}</p>
                </div>
                <div className="flex flex-col items-center text-center p-3 bg-cyan-50 rounded-xl border border-cyan-100">
                  <CloudRain className="w-5 h-5 text-cyan-500 mb-1" />
                  <p className="text-2xl font-bold text-cyan-700">{weatherData.rainfall_5day_mm}</p>
                  <p className="text-xs text-cyan-500 font-medium">mm (5-day)</p>
                </div>
                <div className="flex flex-col items-center text-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <Wind className="w-5 h-5 text-gray-500 mb-1" />
                  <p className="text-2xl font-bold text-gray-700">{weatherData.wind_speed_kmh}</p>
                  <p className="text-xs text-gray-500 font-medium">km/h Wind</p>
                </div>
              </div>

              <div className="px-4 pb-2 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">Rainfall shown is accumulated over the next 5 days. For crop planning, enter your region's seasonal/annual rainfall if known.</p>
              </div>

              <div className="px-4 pb-4 pt-1">
                <button type="button" onClick={applyWeatherToForm} className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
                  <CheckCircle className="w-4 h-4" /> {t('applyWeather')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <Card className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input id="nitrogen"   label={t('nitrogen')}   type="number" step="0.1" required value={formData.nitrogen}   onChange={handleChange} />
            <Input id="phosphorus" label={t('phosphorus')} type="number" step="0.1" required value={formData.phosphorus} onChange={handleChange} />
            <Input id="potassium"  label={t('potassium')}  type="number" step="0.1" required value={formData.potassium}  onChange={handleChange} />
            <Input id="ph"         label={t('phLevel')}            type="number" step="0.1" min="0" max="14" required value={formData.ph} onChange={handleChange} />

            {WEATHER_FILLABLE.map((field) => {
              const meta = fieldMeta[field];
              const isAutoFilled = autoFilledFields.includes(field);
              return (
                <div key={field} className="relative">
                  <Input id={field} label={meta.label} type={meta.type} step={meta.step} required={meta.required} value={formData[field]} onChange={handleChange} placeholder={meta.placeholder} />
                  {isAutoFilled && (
                    <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="absolute top-0 right-0 flex items-center gap-1 text-xs text-sky-600 font-medium px-2 py-0.5 bg-sky-50 border border-sky-200 rounded-bl-lg rounded-tr-sm">
                      <Cloud className="w-3 h-3" /> weather
                    </motion.span>
                  )}
                </div>
              );
            })}
          </div>
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
            {loading ? t('consulting') : t('getRecBtn')}
          </Button>
        </form>
      </Card>

      {result && (
        <motion.div className="mt-8 space-y-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="bg-green-50 p-4 rounded-xl border border-green-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="font-semibold text-green-900 mb-2">{t('soilHealthSummary')}</h3>
              <p className="text-green-800 text-sm">{result.soil_health_summary}</p>
            </div>
            <Button 
              onClick={handleDownloadReport}
              variant="outline"
              className="border-green-600 text-green-700 hover:bg-green-600 hover:text-white shrink-0"
            >
              <FileText className="w-4 h-4 mr-2" />
              {t('downloadReport')}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {result.recommendations?.map((rec, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.15 }} className="relative">
                {i === 0 && <div className="absolute -top-3 inset-x-0 mx-auto w-max px-3 py-1 bg-green-700 text-white text-xs font-bold rounded-full z-10 shadow-sm border-2 border-white">⭐ {t('bestMatch')}</div>}
                <Card className={`h-full flex flex-col ${i === 0 ? 'border-2 border-green-500 shadow-md' : ''}`}>
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-text-primary capitalize">{rec.crop}</h3>
                    <Badge variant={getConfidenceColor(rec.confidence)}>{t('confidence')}: {rec.confidence}</Badge>
                  </div>
                  <p className="text-sm text-text-secondary mb-4 flex-grow">{rec.reason}</p>
                  <div className="space-y-2 mt-auto text-sm border-t border-border-color pt-4">
                    <div className="flex justify-between"><span className="text-text-muted">{t('season')}:</span><span className="font-medium text-text-primary">{rec.ideal_season}</span></div>
                    <div className="flex justify-between"><span className="text-text-muted">{t('waterReq')}:</span><span className="font-medium text-text-primary">{rec.water_requirement}</span></div>
                    <div className="flex justify-between"><span className="text-text-muted">{t('expYield')}:</span><span className="font-medium text-green-700">{rec.expected_yield}</span></div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {result.additional_tips && (
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
              <h3 className="font-semibold text-amber-900 mb-2">{t('expertTips')}</h3>
              <p className="text-amber-800 text-sm">{result.additional_tips}</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
