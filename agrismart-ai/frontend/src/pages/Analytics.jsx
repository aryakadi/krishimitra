import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  LayoutDashboard, TrendingUp, Bug, Sprout, IndianRupee,
  Activity, RefreshCw, Snowflake, Download, ChevronRight, AlertTriangle,
  Database, Cpu, Zap, CheckCircle
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import {
  fetchAnalyticsSummary, fetchCropTrends, fetchDiseaseTrends,
  fetchYieldComparison, fetchPriceHistory, downloadPdfReport
} from '@/api/agriApi';
import { useLanguage } from '@/hooks/useLanguage';

const PALETTE = ['#16a34a','#2563eb','#d97706','#dc2626','#7c3aed','#0891b2','#be185d','#059669'];
const SNOW_BLUE = '#29b5e8';

const TABS = [
  { id: 'overview',  label: 'Overview',       icon: LayoutDashboard },
  { id: 'crops',     label: 'Crop Trends',     icon: Sprout },
  { id: 'diseases',  label: 'Disease Trends',  icon: Bug },
  { id: 'yield',     label: 'Yield Comparison',icon: TrendingUp },
  { id: 'market',    label: 'Market Prices',   icon: IndianRupee },
];

const CROPS_FOR_PRICE = ['wheat','rice','cotton','soybean','onion','tomato','groundnut','maize'];

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="text-xs">
          {p.name}: <b>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</b>
        </p>
      ))}
    </div>
  );
};

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, colour, sub }) {
  return (
    <motion.div whileHover={{ y: -3 }} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
           style={{ background: colour + '18' }}>
        <Icon className="w-6 h-6" style={{ color: colour }} />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-800 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}

// ── Snowflake Status Badge ────────────────────────────────────────────────────
function SnowflakeBadge({ connected }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold
      ${connected ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
      <Snowflake className="w-3.5 h-3.5" />
      {connected ? '❄️ Snowflake Live' : '⚠ Mock Data (Snowflake not connected)'}
    </div>
  );
}

export default function Analytics() {
  const { t } = useLanguage();
  const [activeTab,      setActiveTab]      = useState('overview');
  const [summary,        setSummary]        = useState(null);
  const [cropTrends,     setCropTrends]     = useState([]);
  const [diseaseTrends,  setDiseaseTrends]  = useState([]);
  const [yieldComp,      setYieldComp]      = useState([]);
  const [priceHistory,   setPriceHistory]   = useState([]);
  const [selectedCrop,   setSelectedCrop]   = useState('wheat');
  const [loading,        setLoading]        = useState(true);
  const [tabLoading,     setTabLoading]     = useState(false);
  const [reportLoading,  setReportLoading]  = useState(false);
  const [error,          setError]          = useState(null);

  // ── Load summary (always) ──────────────────────────────────────────────────
  useEffect(() => {
    fetchAnalyticsSummary()
      .then(r => setSummary(r.data.data))
      .catch(() => setError('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  // ── Load tab-specific data ─────────────────────────────────────────────────
  const loadTabData = useCallback(async (tab) => {
    setTabLoading(true);
    try {
      if (tab === 'crops'    && !cropTrends.length)    setCropTrends((await fetchCropTrends()).data.data);
      if (tab === 'diseases' && !diseaseTrends.length) setDiseaseTrends((await fetchDiseaseTrends()).data.data);
      if (tab === 'yield'    && !yieldComp.length)     setYieldComp((await fetchYieldComparison()).data.data);
      if (tab === 'market')                            setPriceHistory((await fetchPriceHistory(selectedCrop)).data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setTabLoading(false);
    }
  }, [cropTrends.length, diseaseTrends.length, yieldComp.length, selectedCrop]);

  useEffect(() => { loadTabData(activeTab); }, [activeTab, loadTabData]);

  // ── Market crop change ─────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'market') {
      setTabLoading(true);
      fetchPriceHistory(selectedCrop)
        .then(r => setPriceHistory(r.data.data))
        .finally(() => setTabLoading(false));
    }
  }, [selectedCrop, activeTab]);

  // ── PDF Report ─────────────────────────────────────────────────────────────
  const handleDownloadReport = async () => {
    setReportLoading(true);
    try {
      await downloadPdfReport({ user_name: 'AgriSmart User', include_crop_trends: true, include_disease_trends: true, include_yield_comparison: true, include_feedback: true });
    } catch (e) {
      console.error('Report failed', e);
    } finally {
      setReportLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh] flex-col gap-4">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center animate-pulse">
        <Database className="w-8 h-8 text-white" />
      </div>
      <p className="text-gray-500 text-sm">Loading Snowflake analytics…</p>
    </div>
  );

  if (error) return (
    <div className="text-center py-20">
      <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-amber-500" />
      <p className="text-gray-600">{error}</p>
    </div>
  );

  // ── Prepare chart data ─────────────────────────────────────────────────────
  const diseaseBar = (() => {
    const map = {};
    diseaseTrends.forEach(d => {
      map[d.disease_name] = (map[d.disease_name] || 0) + (d.detection_count || 0);
    });
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a,b)=>b.count-a.count).slice(0,8);
  })();

  const cropLineData = (() => {
    const monthMap = {};
    cropTrends.forEach(d => {
      if (!monthMap[d.month]) monthMap[d.month] = { month: d.month };
      monthMap[d.month][d.crop_name] = (monthMap[d.month][d.crop_name] || 0) + d.recommendation_count;
    });
    return Object.values(monthMap).slice(-12);
  })();
  const cropNames = [...new Set(cropTrends.map(d => d.crop_name))].slice(0, 5);

  const yieldBarData = yieldComp.map(y => ({
    name: `${y.crop_name} (${y.region?.slice(0,8)})`,
    Avg:  y.avg_yield, Min: y.min_yield, Max: y.max_yield
  })).slice(0,8);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            Analytics Dashboard
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Powered by Snowflake Data Warehouse — Star Schema ❄️</p>
        </div>
        <div className="flex items-center gap-3">
          <SnowflakeBadge connected={summary?.snowflake_connected} />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleDownloadReport}
            disabled={reportLoading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition disabled:opacity-60"
          >
            {reportLoading
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : <Download className="w-4 h-4" />
            }
            PDF Report
          </motion.button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all
                ${activeTab === tab.id
                  ? 'bg-white text-green-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {tabLoading && activeTab !== 'overview' && (
            <div className="flex items-center justify-center h-40">
              <RefreshCw className="w-6 h-6 text-green-600 animate-spin" />
            </div>
          )}

          {/* ── OVERVIEW ─────────────────────────────────────────────────── */}
          {activeTab === 'overview' && summary && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard icon={Cpu}          label="Total Predictions"  value={summary.total_predictions ?? '—'} colour="#16a34a" sub="All time" />
                <KpiCard icon={CheckCircle}  label="System Accuracy"    value={`${summary.accuracy_pct ?? '—'}%`} colour="#2563eb" sub="Avg model acc" />
                <KpiCard icon={Zap}          label="Active Features"    value={summary.feature_usage?.length ?? 5} colour="#7c3aed" sub="AI modules" />
                <KpiCard icon={Snowflake}    label="Snowflake Tables"   value="12" colour={SNOW_BLUE} sub="Facts + Dims" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Feature Usage */}
                <Card className="p-6">
                  <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-500" /> Feature Usage
                  </h2>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={summary.feature_usage?.map(f => ({ name: f.feature, Hits: f.uses }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                      <RTooltip content={<CustomTooltip />} />
                      <Bar dataKey="Hits" radius={[6,6,0,0]} maxBarSize={50}>
                        {summary.feature_usage?.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                {/* Top Crops Pie */}
                <Card className="p-6">
                  <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <Sprout className="w-4 h-4 text-green-500" /> Top Recommended Crops
                  </h2>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={summary.top_crops?.map(c => ({ name: c.crop, value: c.count }))}
                        cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                        paddingAngle={4} dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {summary.top_crops?.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Pie>
                      <RTooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>

                {/* Top Diseases */}
                <Card className="p-6 lg:col-span-2">
                  <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <Bug className="w-4 h-4 text-amber-500" /> Disease Detections (Recent)
                  </h2>
                  <div className="space-y-2">
                    {summary.top_diseases?.map((d, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-400 w-4">{i+1}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden">
                          <div
                            className="h-full rounded-full flex items-center pl-3 text-xs font-semibold text-white transition-all"
                            style={{
                              width: `${Math.max(20, (d.count / (summary.top_diseases[0]?.count || 1)) * 100)}%`,
                              background: PALETTE[i % PALETTE.length]
                            }}
                          >
                            {d.name}
                          </div>
                        </div>
                        <span className="text-xs font-bold text-gray-600 w-8 text-right">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* ── CROP TRENDS ───────────────────────────────────────────────── */}
          {activeTab === 'crops' && !tabLoading && (
            <div className="space-y-6">
              <Card className="p-6">
                <h2 className="font-semibold text-gray-700 mb-1 flex items-center gap-2">
                  <Sprout className="w-4 h-4 text-green-500" /> Crop Recommendation Trends Over Time
                </h2>
                <p className="text-xs text-gray-400 mb-5">Source: <code>MV_CROP_TRENDS</code> (Snowflake Materialized View)</p>
                {cropLineData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={340}>
                    <LineChart data={cropLineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <RTooltip content={<CustomTooltip />} />
                      <Legend />
                      {cropNames.map((name, i) => (
                        <Line key={name} type="monotone" dataKey={name}
                              stroke={PALETTE[i % PALETTE.length]} strokeWidth={2.5}
                              dot={false} activeDot={{ r: 5 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No crop trend data yet</div>
                )}
              </Card>

              {/* Regional table */}
              <Card className="p-6">
                <h2 className="font-semibold text-gray-700 mb-4">Raw Aggregated Data (GROUP BY crop, region, month)</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-green-50 text-green-800">
                        {['Crop','Region','Month','Recommendations','Avg Temp','Avg Rainfall'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cropTrends.slice(0, 20).map((r, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-1.5 font-medium text-gray-700">{r.crop_name}</td>
                          <td className="px-3 py-1.5 text-gray-500">{r.region}</td>
                          <td className="px-3 py-1.5 text-gray-500">{r.month}</td>
                          <td className="px-3 py-1.5 text-center font-bold text-green-700">{r.recommendation_count}</td>
                          <td className="px-3 py-1.5 text-gray-500">{r.avg_temperature ?? '—'}°C</td>
                          <td className="px-3 py-1.5 text-gray-500">{r.avg_rainfall ?? '—'} mm</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ── DISEASE TRENDS ────────────────────────────────────────────── */}
          {activeTab === 'diseases' && !tabLoading && (
            <div className="space-y-6">
              <Card className="p-6">
                <h2 className="font-semibold text-gray-700 mb-1 flex items-center gap-2">
                  <Bug className="w-4 h-4 text-amber-500" /> Disease Frequency by Region
                </h2>
                <p className="text-xs text-gray-400 mb-5">Source: <code>MV_DISEASE_FREQ</code> (Snowflake Materialized View)</p>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={diseaseBar} layout="vertical" margin={{ left: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#4b5563', fontWeight: 500 }} axisLine={false} tickLine={false} width={130} />
                    <RTooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" radius={[0,6,6,0]} maxBarSize={28}>
                      {diseaseBar.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Disease pie by region */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h2 className="font-semibold text-gray-700 mb-4">Distribution by Disease Type</h2>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={diseaseBar.slice(0,6)} cx="50%" cy="50%"
                           outerRadius={100} dataKey="count"
                           label={({ name, percent }) => `${name.split(' ')[0]} ${(percent*100).toFixed(0)}%`}
                           labelLine={false}>
                        {diseaseBar.slice(0,6).map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Pie>
                      <RTooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
                <Card className="p-6">
                  <h2 className="font-semibold text-gray-700 mb-4">Trend Over Time (↑ critical alerts)</h2>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={diseaseTrends.slice(0,20).map(d => ({
                      month: d.month, Count: d.detection_count, Critical: d.critical_count || 0
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <RTooltip content={<CustomTooltip />} />
                      <Legend />
                      <Area type="monotone" dataKey="Count"    fill="#fef3c7" stroke="#d97706" fillOpacity={0.6} strokeWidth={2} />
                      <Area type="monotone" dataKey="Critical" fill="#fee2e2" stroke="#dc2626" fillOpacity={0.6} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            </div>
          )}

          {/* ── YIELD COMPARISON ──────────────────────────────────────────── */}
          {activeTab === 'yield' && !tabLoading && (
            <div className="space-y-6">
              <Card className="p-6">
                <h2 className="font-semibold text-gray-700 mb-1 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-sky-500" /> Yield Comparison Across Regions
                </h2>
                <p className="text-xs text-gray-400 mb-5">Source: <code>MV_YIELD_COMPARISON</code> — AVG, MIN, MAX yield (tonnes/ha)</p>
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={yieldBarData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} angle={-15} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} unit=" t/ha" />
                    <RTooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="Avg" fill="#16a34a" radius={[6,6,0,0]} maxBarSize={28} />
                    <Bar dataKey="Min" fill="#86efac" radius={[6,6,0,0]} maxBarSize={28} />
                    <Bar dataKey="Max" fill="#059669" radius={[6,6,0,0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card className="p-6">
                <h2 className="font-semibold text-gray-700 mb-4">Yield Data Table</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-sky-50 text-sky-800">
                        {['Crop','Region','Season','Avg Yield','Min','Max'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {yieldComp.map((y, i) => (
                        <tr key={i} className={i%2===0 ? 'bg-white':'bg-gray-50'}>
                          <td className="px-3 py-1.5 font-medium text-gray-700">{y.crop_name}</td>
                          <td className="px-3 py-1.5 text-gray-500">{y.region}</td>
                          <td className="px-3 py-1.5 text-gray-500">{y.season}</td>
                          <td className="px-3 py-1.5 font-bold text-sky-700">{y.avg_yield?.toFixed(2)} t/ha</td>
                          <td className="px-3 py-1.5 text-gray-400">{y.min_yield?.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-gray-400">{y.max_yield?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ── MARKET PRICES ─────────────────────────────────────────────── */}
          {activeTab === 'market' && !tabLoading && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <label className="text-sm font-semibold text-gray-600">Select Crop:</label>
                <select
                  value={selectedCrop}
                  onChange={e => setSelectedCrop(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                >
                  {CROPS_FOR_PRICE.map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>

              <Card className="p-6">
                <h2 className="font-semibold text-gray-700 mb-1 flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-green-600" /> {selectedCrop.charAt(0).toUpperCase()+selectedCrop.slice(1)} — Price History (INR/quintal)
                </h2>
                <p className="text-xs text-gray-400 mb-5">Source: <code>FACT_PRICE_FORECAST</code> with historical price data</p>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={priceHistory}>
                    <defs>
                      <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0}   />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <RTooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="avg_price" name="Avg Price (₹)"
                          stroke="#16a34a" fill="url(#priceGrad)" strokeWidth={2.5} dot={{ r: 4 }} />
                    <Area type="monotone" dataKey="max_price" name="Max Price (₹)"
                          stroke="#059669" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
                    <Area type="monotone" dataKey="min_price" name="Min Price (₹)"
                          stroke="#86efac" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
                    <Legend />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              <Card className="p-6">
                <h2 className="font-semibold text-gray-700 mb-4">Price Data Table</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-green-50 text-green-800">
                        {['Month','Crop','Avg Price (₹)','Min','Max','Trend'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {priceHistory.map((r, i) => (
                        <tr key={i} className={i%2===0 ? 'bg-white':'bg-gray-50'}>
                          <td className="px-3 py-1.5 text-gray-500">{r.month}</td>
                          <td className="px-3 py-1.5 font-medium text-gray-700">{r.crop}</td>
                          <td className="px-3 py-1.5 font-bold text-green-700">₹{r.avg_price?.toLocaleString()}</td>
                          <td className="px-3 py-1.5 text-gray-400">₹{r.min_price?.toLocaleString()}</td>
                          <td className="px-3 py-1.5 text-gray-400">₹{r.max_price?.toLocaleString()}</td>
                          <td className="px-3 py-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold
                              ${r.trend === 'up' ? 'bg-green-100 text-green-700' : r.trend === 'down' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                              {r.trend === 'up' ? '↑' : r.trend === 'down' ? '↓' : '→'} {r.trend}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
