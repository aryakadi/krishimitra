import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Database, Layers, GitBranch, Table, Snowflake, Cpu, Zap, RefreshCw, CheckCircle, Clock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { fetchTableCounts } from '@/api/agriApi';

// ── Star Schema data definition ───────────────────────────────────────────────
const FACT_TABLES = [
  { name: 'FACT_PREDICTIONS',        key: 'FACT_PREDICTIONS',        color: '#16a34a', desc: 'Unified prediction log (disease/yield/price/crop_rec)' },
  { name: 'FACT_WEATHER',            key: 'FACT_WEATHER',            color: '#2563eb', desc: 'Weather observations from OpenWeatherMap' },
  { name: 'FACT_MARKET',             key: 'FACT_MARKET',             color: '#7c3aed', desc: 'Historical & forecasted crop market prices' },
  { name: 'FACT_DISEASE_DETECTION',  key: 'FACT_DISEASE_DETECTION',  color: '#dc2626', desc: 'CNN/Gemini disease detection results' },
  { name: 'FACT_YIELD_PREDICTION',   key: 'FACT_YIELD_PREDICTION',   color: '#0891b2', desc: 'Random Forest yield prediction results' },
  { name: 'FACT_PRICE_FORECAST',     key: 'FACT_PRICE_FORECAST',     color: '#d97706', desc: 'ARIMA/LSTM market price forecasts' },
  { name: 'FACT_CROP_RECOMMENDATION',key: 'FACT_CROP_RECOMMENDATION',color: '#059669', desc: 'AI-powered crop recommendation records' },
];

const DIM_TABLES = [
  { name: 'DIM_CROP',     key: 'DIM_CROP',     color: '#be185d', fields: 'crop_id, crop_name, season, crop_type, water_need, avg_yield' },
  { name: 'DIM_LOCATION', key: 'DIM_LOCATION', color: '#0e7490', fields: 'location_id, state, district, region, climate_zone' },
  { name: 'DIM_SOIL',     key: 'DIM_SOIL',     color: '#92400e', fields: 'soil_id, soil_type, nitrogen_range, ph_min, ph_max' },
  { name: 'DIM_TIME',     key: 'DIM_TIME',     color: '#4338ca', fields: 'time_id, day, month, year, quarter, season_label' },
  { name: 'DIM_USER',     key: 'DIM_USER',     color: '#166534', fields: 'user_id, name, language, region' },
];

const MVS = [
  { name: 'MV_CROP_TRENDS',      desc: 'Crop pop. by region/month — GROUP BY crop, region, month' },
  { name: 'MV_DISEASE_FREQ',     desc: 'Disease frequency by region — COUNT(*), critical_count' },
  { name: 'MV_YIELD_COMPARISON', desc: 'AVG/MIN/MAX yield across crops and locations' },
  { name: 'MV_MARKET_TRENDS',    desc: 'Price trends by crop — monthly aggregation' },
];

const ADVANCED = [
  {
    icon: Clock,
    name: 'Time Travel',
    desc: 'Query historical data at any point in the past using AT(OFFSET => -N) syntax. Access predictions from 7 days ago.'
  },
  {
    icon: Zap,
    name: 'Streams (CDC)',
    desc: 'STR_PREDICTIONS and STR_DISEASE capture Change Data Capture events for real-time downstream processing.'
  },
  {
    icon: RefreshCw,
    name: 'Scheduled Tasks',
    desc: 'TSK_REFRESH_MV runs hourly to keep materialized views current. TSK_POPULATE_DIM_TIME runs annually.'
  },
  {
    icon: Layers,
    name: 'Materialized Views',
    desc: 'Pre-aggregated OLAP results for 10× faster analytics queries. No full table scan on every dashboard load.'
  },
];

const ETL_STEPS = [
  {
    num: '1', label: 'Extract',   color: '#2563eb',
    items: ['User form inputs', 'OpenWeatherMap API', 'ML model outputs (CNN/RF/ARIMA)', 'Gemini + NVIDIA NIM responses']
  },
  {
    num: '2', label: 'Transform', color: '#d97706',
    items: ['Clean missing values (fill defaults)', 'Normalise units (°F→°C, acres→ha)', 'Feature engineering (NPK ratio, rainfall category)', 'Soil fertility score calculation']
  },
  {
    num: '3', label: 'Load',      color: '#16a34a',
    items: ['FACT_PREDICTIONS (unified log)', 'FACT_WEATHER (weather data)', 'Dimension table FK lookups', 'Update on feedback (actual_value)']
  },
];

const SQL_EXAMPLES = [
  {
    title: 'Crop Trends — GROUP BY + AVG',
    sql: `SELECT crop_name, region,
       TO_VARCHAR(month, 'Mon YYYY') AS month_label,
       recommendation_count,
       avg_temperature, avg_rainfall
FROM   MV_CROP_TRENDS
WHERE  month >= DATEADD('month', -3, CURRENT_DATE())
ORDER  BY month DESC, recommendation_count DESC;`
  },
  {
    title: 'Disease Frequency by Region — JOIN + COUNT',
    sql: `SELECT d.disease_name, l.state, l.region,
       COUNT(*)               AS total_detections,
       COUNT(CASE WHEN urgency_level = 'critical' THEN 1 END) AS critical
FROM   FACT_DISEASE_DETECTION d
JOIN   FACT_PREDICTIONS       p ON d.prediction_id = p.prediction_id
LEFT JOIN DIM_LOCATION        l ON p.location_id   = l.location_id
GROUP  BY 1, 2, 3
ORDER  BY total_detections DESC;`
  },
  {
    title: 'Time Travel — Historical Predictions',
    sql: `-- View predictions from 7 days ago (Snowflake Time Travel)
SELECT prediction_id, prediction_type, predicted_value,
       confidence_score, model_used, created_at
FROM   FACT_PREDICTIONS
       AT(OFFSET => -60*60*24*7)
WHERE  prediction_type = 'disease'
ORDER  BY created_at DESC;`
  },
  {
    title: 'Feedback Loop — Predicted vs Actual',
    sql: `SELECT prediction_type,
       COUNT(*)                 AS total_predictions,
       COUNT(actual_value)      AS with_feedback,
       AVG(TRY_TO_DOUBLE(predicted_value)) AS avg_predicted,
       AVG(TRY_TO_DOUBLE(actual_value))    AS avg_actual,
       ROUND(RATIO_TO_REPORT(COUNT(actual_value))
             OVER () * 100, 1)             AS feedback_pct
FROM   FACT_PREDICTIONS
WHERE  actual_value IS NOT NULL
GROUP  BY prediction_type;`
  },
];

// ── Components ────────────────────────────────────────────────────────────────
function TableBadge({ name, rows, color }) {
  return (
    <motion.div whileHover={{ y: -2, boxShadow: `0 4px 20px ${color}30` }}
      className="rounded-xl border p-3 cursor-default"
      style={{ borderColor: color + '40', background: color + '08' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold font-mono" style={{ color }}>{name}</span>
        {rows !== undefined && (
          <span className="text-xs bg-white border rounded-full px-2 py-0.5 font-semibold text-gray-600">
            {rows.toLocaleString()} rows
          </span>
        )}
      </div>
    </motion.div>
  );
}

function SqlBlock({ title, sql }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between bg-gray-50 border-b border-gray-200 px-4 py-2">
        <span className="text-xs font-semibold text-gray-600">{title}</span>
        <button onClick={copy} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
          {copied ? '✓ Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="text-xs font-mono text-gray-800 bg-gray-900 text-green-300 p-4 overflow-x-auto leading-relaxed whitespace-pre">
        {sql}
      </pre>
    </div>
  );
}

export default function DataWarehouse() {
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('schema');

  useEffect(() => {
    fetchTableCounts()
      .then(r => setCounts(r.data.data || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sections = [
    { id: 'schema', label: 'Star Schema',        icon: Database },
    { id: 'etl',    label: 'ETL Pipeline',        icon: GitBranch },
    { id: 'sql',    label: 'OLAP Queries',        icon: Table },
    { id: 'adv',    label: 'Advanced Features',   icon: Snowflake },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-8">
        <div className="absolute inset-0 opacity-10"
             style={{ backgroundImage: 'radial-gradient(circle at 30% 40%, #29b5e8 0%, transparent 60%)' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-[#29b5e8]/20 flex items-center justify-center border border-[#29b5e8]/30">
              <Snowflake className="w-6 h-6 text-[#29b5e8]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Data Warehouse Architecture</h1>
              <p className="text-blue-300 text-sm">Snowflake · Star Schema · ADBMS Final Year Project</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            {['Star Schema', '5 Dimensions', '7 Fact Tables', '4 Materialized Views', 'CDC Streams', 'Scheduled Tasks', 'Time Travel'].map(tag => (
              <span key={tag} className="px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-blue-200 border border-white/10">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Live row counts summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Fact Tables',      value: Object.keys(FACT_TABLES).length, icon: Database,  color: '#16a34a' },
          { label: 'Dimension Tables', value: DIM_TABLES.length,               icon: Table,     color: '#2563eb' },
          { label: 'Materialized Views',value: MVS.length,                     icon: Layers,    color: '#7c3aed' },
          { label: 'Total Records',    value: Object.values(counts).reduce((a,b)=>a+b,0), icon: Cpu, color: '#d97706' },
        ].map(({ label, value, icon: Icon, color }) => (
          <motion.div key={label} whileHover={{ y: -2 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color + '15' }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-800">{loading ? '…' : value.toLocaleString()}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 overflow-x-auto">
        {sections.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveSection(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all
              ${activeSection === id ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ── STAR SCHEMA ─────────────────────────────────────────────────────── */}
      {activeSection === 'schema' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Card className="p-6">
            <h2 className="font-bold text-gray-800 text-lg mb-1 flex items-center gap-2">
              <Database className="w-5 h-5 text-green-600" /> Fact Tables
            </h2>
            <p className="text-xs text-gray-400 mb-4">Central tables storing measurable business events</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {FACT_TABLES.map(t => (
                <motion.div key={t.name} whileHover={{ scale: 1.02 }}
                  className="rounded-xl border-2 p-4 cursor-default"
                  style={{ borderColor: t.color + '50', background: t.color + '06' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: t.color }} />
                    <span className="text-xs font-bold font-mono text-gray-700">{t.name}</span>
                  </div>
                  <p className="text-xs text-gray-500">{t.desc}</p>
                  {counts[t.key] !== undefined && (
                    <div className="mt-2 text-xs font-bold" style={{ color: t.color }}>
                      {counts[t.key].toLocaleString()} records
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-bold text-gray-800 text-lg mb-1 flex items-center gap-2">
              <Table className="w-5 h-5 text-blue-600" /> Dimension Tables
            </h2>
            <p className="text-xs text-gray-400 mb-4">Descriptive attributes for OLAP slicing and dicing</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {DIM_TABLES.map(t => (
                <motion.div key={t.name} whileHover={{ scale: 1.02 }}
                  className="rounded-xl border-2 p-4 cursor-default"
                  style={{ borderColor: t.color + '50', background: t.color + '06' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-sm" style={{ background: t.color }} />
                    <span className="text-xs font-bold font-mono text-gray-700">{t.name}</span>
                  </div>
                  <p className="text-xs text-gray-400 font-mono leading-relaxed">{t.fields}</p>
                  {counts[t.key] !== undefined && (
                    <div className="mt-2 text-xs font-bold" style={{ color: t.color }}>
                      {counts[t.key].toLocaleString()} records
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </Card>

          {/* Visual star diagram */}
          <Card className="p-6">
            <h2 className="font-bold text-gray-800 text-lg mb-4">Star Schema Diagram</h2>
            <div className="relative flex flex-col items-center">
              {/* Center fact */}
              <div className="w-54 px-6 py-4 rounded-2xl bg-gradient-to-br from-green-600 to-emerald-700 text-white text-center shadow-lg mb-4 z-10">
                <Database className="w-6 h-6 mx-auto mb-1" />
                <div className="font-bold text-sm">FACT_PREDICTIONS</div>
                <div className="text-xs opacity-80 mt-1">Central Fact Table</div>
              </div>
              {/* Dimension table ring */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 w-full mt-2">
                {DIM_TABLES.map(dim => (
                  <div key={dim.name}
                       className="rounded-xl p-3 text-center border-2 text-xs font-mono font-semibold"
                       style={{ borderColor: dim.color, color: dim.color, background: dim.color + '10' }}>
                    ◆ {dim.name}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Materialized Views */}
          <Card className="p-6">
            <h2 className="font-bold text-gray-800 text-lg mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-600" /> Materialized Views (Pre-aggregated OLAP)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {MVS.map(mv => (
                <div key={mv.name} className="flex items-start gap-3 p-4 rounded-xl bg-purple-50 border border-purple-100">
                  <CheckCircle className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold font-mono text-purple-800">{mv.name}</p>
                    <p className="text-xs text-purple-600 mt-0.5">{mv.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── ETL PIPELINE ────────────────────────────────────────────────────── */}
      {activeSection === 'etl' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Card className="p-6">
            <h2 className="font-bold text-gray-800 text-lg mb-6 flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-orange-500" /> ETL Pipeline — Extract → Transform → Load
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
              <div className="hidden md:block absolute top-1/2 left-1/3 w-1/3 h-0.5 bg-gradient-to-r from-blue-400 to-orange-400 -translate-y-1/2 z-0" />
              <div className="hidden md:block absolute top-1/2 left-2/3 w-1/3 h-0.5 bg-gradient-to-r from-orange-400 to-green-500 -translate-y-1/2 z-0" />
              {ETL_STEPS.map((step, i) => (
                <motion.div key={step.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  className="relative z-10 bg-white rounded-2xl border-2 shadow-sm overflow-hidden"
                  style={{ borderColor: step.color }}>
                  <div className="p-4 text-white" style={{ background: `linear-gradient(135deg, ${step.color}, ${step.color}cc)` }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">{step.num}</span>
                      <span className="font-bold text-lg">{step.label}</span>
                    </div>
                  </div>
                  <div className="p-4 space-y-1.5">
                    {step.items.map(item => (
                      <div key={item} className="flex items-start gap-2 text-xs text-gray-600">
                        <span style={{ color: step.color }} className="mt-0.5 font-bold">•</span>
                        {item}
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-bold text-gray-800 text-lg mb-4">ETL Module Structure</h2>
            <div className="font-mono text-sm bg-gray-900 text-green-300 rounded-xl p-4 leading-relaxed">
              <div className="text-gray-500 text-xs mb-2"># backend/etl/pipeline.py</div>
              {`class Extractor:
    from_user_input(data) → dict
    from_weather_api(api_response) → dict
    from_ml_output(model, type, output) → dict

class Transformer:
    clean_missing(data) → dict      # fill nulls, defaults
    normalize_units(data) → dict    # °F→°C, acres→ha
    feature_engineer(data) → dict   # NPK ratio, rainfall cat
    transform(data) → dict          # full pipeline

class Loader:
    load_weather(data, city, location_id) → bool
    load_prediction(type, value, score, model) → int?
    load_market(prices, demand, supply) → bool
    update_actual_result(pred_id, actual) → bool

class ETLPipeline:
    run_weather(api_response, city) → bool
    run_prediction(type, output, value) → int?
    run_market(price_data) → bool
    run_feedback(pred_id, actual) → bool`}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── OLAP QUERIES ────────────────────────────────────────────────────── */}
      {activeSection === 'sql' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800 font-medium">
            📊 These queries power the Analytics Dashboard. They use <strong>GROUP BY</strong>, <strong>AVG</strong>, <strong>JOIN</strong>, and <strong>Snowflake Materialized Views</strong> for optimal OLAP performance.
          </div>
          {SQL_EXAMPLES.map(ex => (
            <Card key={ex.title} className="p-0 overflow-hidden">
              <SqlBlock title={ex.title} sql={ex.sql} />
            </Card>
          ))}
        </motion.div>
      )}

      {/* ── ADVANCED FEATURES ───────────────────────────────────────────────── */}
      {activeSection === 'adv' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ADVANCED.map(({ icon: Icon, name, desc }) => (
              <motion.div key={name} whileHover={{ y: -3 }}>
                <Card className="p-6 h-full">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                      <Icon className="w-6 h-6 text-[#29b5e8]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 mb-1">{name}</h3>
                      <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          <Card className="p-6">
            <h2 className="font-bold text-gray-800 text-lg mb-4 flex items-center gap-2">
              <Snowflake className="w-5 h-5 text-[#29b5e8]" /> Snowflake DDL Highlights
            </h2>
            <SqlBlock
              title="Streams + Tasks + Time Travel"
              sql={`-- CDC Stream on FACT_PREDICTIONS
CREATE OR REPLACE STREAM STR_PREDICTIONS
    ON TABLE FACT_PREDICTIONS
    COMMENT = 'Capture new prediction rows';

-- Hourly refresh task
CREATE OR REPLACE TASK TSK_REFRESH_MV
    WAREHOUSE = AGRISMART_WH
    SCHEDULE  = '60 MINUTE'
AS
    INSERT INTO FACT_QUERY_LOGS (endpoint, response_summary, region)
    SELECT '/system/mv-refresh', 'MV refresh executed', 'SYSTEM';

ALTER TASK TSK_REFRESH_MV RESUME;

-- Time Travel — query data from 7 days ago
SELECT * FROM FACT_PREDICTIONS
    AT(OFFSET => -60*60*24*7);`}
            />
          </Card>
        </motion.div>
      )}
    </div>
  );
}
