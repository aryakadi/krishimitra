import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Leaf, UploadCloud, AlertTriangle, CheckCircle, Shield, Droplets, Clock, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { diseaseDetection } from '@/api/agriApi';
import { useLanguage } from '@/hooks/useLanguage';
import { generateAgriReport } from '@/utils/reportUtils';
import { FileText } from 'lucide-react';
import toast from 'react-hot-toast';

const generateThumbnail = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 150;
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

export default function DiseaseDetection() {
  const { language, t } = useLanguage();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('diseaseHistory');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const onDrop = useCallback(acceptedFiles => {
    if (acceptedFiles?.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp']
    },
    maxSize: 10 * 1024 * 1024,
    multiple: false
  });

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('language', language);

    try {
      const res = await diseaseDetection(formData);
      setResult(res);

      try {
        const thumbnail = await generateThumbnail(file);
        const newRecord = {
          id: Date.now(),
          date: new Date().toISOString(),
          disease_name: res.disease_name,
          urgency_level: res.urgency_level,
          image_preview: thumbnail
        };
        setHistory(prev => {
          const updated = [newRecord, ...prev].slice(0, 10); // Keep max 10 records
          localStorage.setItem('diseaseHistory', JSON.stringify(updated));
          return updated;
        });
      } catch (thumbErr) {
        console.error("Failed to map thumbnail for history", thumbErr);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = () => {
    if (!result) return;
    generateAgriReport({
      title: t('diseaseTitle') + ' ' + (t('report') || 'Report'),
      subtitle: `${t('diseaseSub')}`,
      language,
      farmerInputs: {
        'Detection Date': new Date().toLocaleDateString(),
        'Detection Type': 'Leaf Image Analysis',
        'Language': language === 'hi' ? 'Hindi' : (language === 'mr' ? 'Marathi' : 'English')
      },
      aiResults: {
        'Disease Name': result.disease_name,
        'Urgency Level': result.urgency_level,
        'Confidence': result.confidence,
        'Symptoms': result.symptoms?.join(', '),
        'Treatment': result.treatment?.join(' | '),
        'Organic Remedy': result.organic_remedy || 'N/A'
      }
    });
    toast.success('Diagnostic report downloaded!');
  };

  const getUrgencyColor = (urgency) => {
    const u = urgency?.toLowerCase() || '';
    if (u === 'critical') return 'danger';
    if (u === 'high') return 'warning';
    if (u === 'medium') return 'info';
    return 'success';
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('diseaseHistory');
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl text-text-primary mb-2">{t('diseaseTitle')}</h1>
        <p className="text-text-secondary">{t('diseaseSub')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <Card className="h-full">
            <div 
              {...getRootProps()} 
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors duration-300 flex flex-col items-center justify-center min-h-[300px]
                ${isDragActive ? 'border-green-500 bg-green-50' : 'border-green-300 bg-green-50 hover:bg-green-100'}`}
            >
              <input {...getInputProps()} />
              
              {preview ? (
                <div className="w-full h-full space-y-4">
                  <img src={preview} alt="Leaf preview" className="mx-auto max-h-[280px] object-cover rounded-lg shadow-sm" />
                  <p className="text-sm border text-green-700 bg-white rounded-md px-3 py-1 inline-block shadow-sm">Click or drag a new image to replace</p>
                </div>
              ) : (
                <div className="space-y-4 text-green-800">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <UploadCloud className="w-8 h-8 text-green-500" />
                  </div>
                  <h3 className="text-xl font-medium">{t('dropPhoto')}</h3>
                  <p className="text-sm text-green-600">{t('browsePhoto')}</p>
                  <p className="text-xs opacity-70 mt-4">Supported formats: JPG, PNG, WebP (Max 10MB)</p>
                </div>
              )}
            </div>
            
            <div className="mt-6">
              <Button 
                onClick={handleAnalyze} 
                disabled={!file || loading} 
                className="w-full" 
                size="lg"
                loading={loading}
              >
                {loading ? t('consulting') : t('analyzeBtn')}
              </Button>
            </div>
          </Card>
        </div>

        <div>
          {result ? (
            <motion.div 
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }}
              className="h-full"
            >
              <Card className="h-full flex flex-col relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-full h-2 ${getUrgencyColor(result.urgency_level) === 'danger' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                
                <div className="mb-6 mt-2">
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <h2 className="text-2xl text-text-primary">{result.disease_name}</h2>
                      <Badge variant="neutral" className="mt-1">Confidence: {result.confidence}</Badge>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={getUrgencyColor(result.urgency_level)} className="text-sm px-3 py-1 uppercase tracking-wider">
                        {result.urgency_level}
                      </Badge>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={handleDownloadReport}
                        className="text-green-700 hover:text-green-800 hover:bg-green-50 p-2"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        {t('downloadReport')}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                  <div>
                    <h4 className="font-semibold text-text-primary flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" /> {t('symptoms')}
                    </h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                      {result.symptoms?.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-text-primary flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-green-600" /> {t('treatment')}
                    </h4>
                    <ol className="list-decimal pl-5 space-y-1 text-sm text-green-900">
                      {result.treatment?.map((t, i) => <li key={i}>{t}</li>)}
                    </ol>
                  </div>

                  <div>
                    <h4 className="font-semibold text-text-primary flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-sky-500" /> {t('prevention')}
                    </h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                      {result.prevention?.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>

                  {result.organic_remedy && (
                    <div className="bg-amber-50 p-4 rounded-md border border-amber-200 flex items-start gap-3">
                      <Droplets className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-amber-900 mb-1 text-sm">{t('organic')}</h4>
                        <p className="text-amber-800 text-sm">{result.organic_remedy}</p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          ) : (
            <Card className="h-full flex items-center justify-center bg-gray-50 border-dashed border-2">
              <div className="text-center text-text-muted max-w-sm px-6">
                <Leaf className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p>{t('loading')}</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* ── Past Diagnoses Panel ──────────────────────────────────────────────── */}
      {history.length > 0 && (
        <Card className="max-w-7xl mx-auto overflow-hidden border-sky-100">
          <div 
            className="flex items-center justify-between p-2 cursor-pointer select-none"
            onClick={() => setShowHistory(!showHistory)}
          >
            <div className="flex items-center gap-2 text-text-primary">
              <Clock className="w-5 h-5 text-sky-600" />
              <h3 className="text-lg font-semibold">{t('pastDiagnoses')} ({history.length})</h3>
            </div>
            <div className="flex items-center gap-4">
              {showHistory ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </div>
          </div>
          
          <AnimatePresence>
            {showHistory && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-sky-50 pt-4 mt-2"
              >
                <div className="flex justify-end mb-4 px-2">
                  <button 
                    onClick={clearHistory}
                    className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t('clearHistory')}
                  </button>
                </div>
                {/* Records list... */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-2 pb-2">
                  {history.map((record) => (
                    <div key={record.id} className="flex gap-3 bg-white shadow-sm p-3 rounded-xl border border-gray-100 hover:border-sky-200 transition-colors">
                      <img 
                        src={record.image_preview} 
                        alt={record.disease_name} 
                        className="w-14 h-14 object-cover rounded-lg border border-gray-100 shrink-0" 
                      />
                      <div className="flex flex-col flex-1 min-w-0">
                        <p className="font-semibold text-text-primary text-sm truncate" title={record.disease_name}>
                          {record.disease_name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(record.date).toLocaleDateString()}
                        </p>
                        <div className="mt-auto pt-1">
                          <Badge variant={getUrgencyColor(record.urgency_level)} className="text-[10px] px-1.5 py-0 leading-tight inline-block tracking-wider uppercase">
                            {record.urgency_level}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      )}
    </div>
  );
}
