import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GitMerge, CheckCircle, RefreshCw, TrendingUp, Target, Award, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card } from '@/components/ui/Card';
import { submitFeedback, fetchFeedbackSummary } from '@/api/agriApi';
import toast from 'react-hot-toast';

const PALETTE = ['#16a34a', '#2563eb', '#d97706', '#dc2626'];

export default function Feedback() {
  const [predictionId, setPredictionId]   = useState('');
  const [actualValue,  setActualValue]    = useState('');
  const [notes,        setNotes]          = useState('');
  const [submitting,   setSubmitting]     = useState(false);
  const [submitted,    setSubmitted]      = useState(false);
  const [summary,      setSummary]        = useState(null);
  const [loadingSum,   setLoadingSum]     = useState(true);

  useEffect(() => {
    fetchFeedbackSummary()
      .then(r => setSummary(r.data.data))
      .catch(() => {})
      .finally(() => setLoadingSum(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!predictionId || !actualValue) {
      toast.error('Please provide Prediction ID and actual value');
      return;
    }
    setSubmitting(true);
    try {
      await submitFeedback({
        prediction_id: parseInt(predictionId),
        actual_value: actualValue,
        notes
      });
      setSubmitted(true);
      toast.success('Feedback submitted! This will be used to retrain models.');
      // Reload summary
      const r = await fetchFeedbackSummary();
      setSummary(r.data.data);
    } catch (e) {
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const accuracyData = summary?.accuracy
    ? Object.entries(summary.accuracy).map(([type, info]) => ({
        name: type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
        accuracy: info.accuracy_pct || 0,
        count: info.count || 0
      }))
    : [];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-900 via-emerald-900 to-green-800 p-8">
        <div className="absolute inset-0 opacity-10"
             style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, #10b981 0%, transparent 60%)' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <GitMerge className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Feedback Loop</h1>
              <p className="text-emerald-300 text-sm">Close the ML cycle — predicted vs actual helps retrain models</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            {[
              { label: 'Total Predictions',   value: summary?.total_predictions ?? '—' },
              { label: 'With Feedback',        value: summary?.with_feedback ?? '—' },
              { label: 'Overall Accuracy',     value: `${summary?.overall_accuracy_pct ?? '—'}%` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/10 rounded-xl p-4 border border-white/10">
                <p className="text-2xl font-bold text-white">{loadingSum ? '…' : value}</p>
                <p className="text-xs text-emerald-300 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Submit Feedback Form */}
        <Card className="p-6">
          <h2 className="font-bold text-gray-800 text-lg mb-1 flex items-center gap-2">
            <Target className="w-5 h-5 text-green-600" /> Submit Actual Outcome
          </h2>
          <p className="text-sm text-gray-500 mb-5">
            After observing the real result, submit it here. It will be stored in
            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded mx-1">FACT_PREDICTIONS.actual_value</code>
            in Snowflake and used to periodically retrain models.
          </p>

          {submitted ? (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-4 py-10">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-9 h-9 text-green-600" />
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-800 text-lg">Feedback Submitted!</p>
                <p className="text-sm text-gray-500 mt-1">Thank you. This data improves future predictions.</p>
              </div>
              <button
                onClick={() => { setSubmitted(false); setPredictionId(''); setActualValue(''); setNotes(''); }}
                className="px-5 py-2 rounded-xl bg-green-100 text-green-700 font-semibold text-sm hover:bg-green-200 transition"
              >
                Submit Another
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Prediction ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={predictionId}
                  onChange={e => setPredictionId(e.target.value)}
                  placeholder="e.g. 42 (from FACT_PREDICTIONS)"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">Find this ID from the API response or Snowflake FACT_PREDICTIONS table</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Actual Observed Value <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={actualValue}
                  onChange={e => setActualValue(e.target.value)}
                  placeholder="e.g. 3.8 (yield in t/ha) or 'Rust' (disease name)"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Any additional observations or context..."
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                />
              </div>

              <motion.button
                type="submit"
                disabled={submitting}
                whileTap={{ scale: 0.97 }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-sm hover:from-green-700 hover:to-emerald-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {submitting ? 'Submitting…' : 'Submit to Snowflake'}
              </motion.button>
            </form>
          )}
        </Card>

        {/* How it works */}
        <div className="space-y-4">
          <Card className="p-6">
            <h2 className="font-bold text-gray-800 text-lg mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" /> How the Feedback Loop Works
            </h2>
            <div className="space-y-4">
              {[
                {
                  step: '1', color: '#2563eb',
                  title: 'Prediction Made',
                  desc: 'AI model (Gemini/NVIDIA NIM) makes a prediction. Stored in FACT_PREDICTIONS with predicted_value and confidence_score.'
                },
                {
                  step: '2', color: '#d97706',
                  title: 'Real Outcome Observed',
                  desc: 'Farmer observes the actual result (real yield, real disease, real selling price).'
                },
                {
                  step: '3', color: '#16a34a',
                  title: 'Feedback Submitted',
                  desc: 'This form updates FACT_PREDICTIONS.actual_value in Snowflake via UPDATE query.'
                },
                {
                  step: '4', color: '#7c3aed',
                  title: 'Model Retraining',
                  desc: 'Periodically, predicted vs actual data is extracted from Snowflake and used to retrain ML models.'
                },
              ].map(({ step, color, title, desc }) => (
                <div key={step} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 mt-0.5"
                       style={{ background: color }}>
                    {step}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700 text-sm">{title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div className="text-xs text-gray-600 leading-relaxed">
                <strong>Snowflake SQL:</strong>
                <pre className="mt-2 bg-gray-900 text-green-300 rounded-lg p-3 text-xs font-mono overflow-x-auto">
{`UPDATE FACT_PREDICTIONS
SET    actual_value = %s,
       feedback_at  = CURRENT_TIMESTAMP()
WHERE  prediction_id = %s;`}
                </pre>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Accuracy Chart */}
      {!loadingSum && accuracyData.length > 0 && (
        <Card className="p-6">
          <h2 className="font-bold text-gray-800 text-lg mb-1 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-sky-500" /> Model Accuracy by Prediction Type
          </h2>
          <p className="text-xs text-gray-400 mb-5">Based on predictions with submitted feedback in Snowflake</p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={accuracyData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
              <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`}
                     tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: '#4b5563', fontWeight: 500 }}
                     axisLine={false} tickLine={false} width={120} />
              <Tooltip formatter={(v) => [`${v}%`, 'Accuracy']} />
              <Bar dataKey="accuracy" radius={[0, 8, 8, 0]} maxBarSize={36}>
                {accuracyData.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}
