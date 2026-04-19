import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Leaf, UploadCloud, AlertTriangle, CheckCircle, Shield, Droplets } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { diseaseDetection } from '@/api/agriApi';
import { useLanguage } from '@/hooks/useLanguage';

export default function DiseaseDetection() {
  const { language } = useLanguage();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyColor = (urgency) => {
    const u = urgency?.toLowerCase() || '';
    if (u === 'critical') return 'danger';
    if (u === 'high') return 'warning';
    if (u === 'medium') return 'info';
    return 'success';
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl text-text-primary mb-2">🔬 Disease Detection</h1>
        <p className="text-text-secondary">Upload a clear picture of the affected plant leaf for instant AI diagnosis.</p>
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
                  <h3 className="text-xl font-medium">Drop leaf photo here</h3>
                  <p className="text-sm text-green-600">or click to browse from device</p>
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
                {loading ? "Analyzing Leaf Image..." : "Analyze Leaf"}
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
                    <h2 className="text-2xl text-text-primary">{result.disease_name}</h2>
                    <Badge variant={getUrgencyColor(result.urgency_level)} className="text-sm px-3 py-1 uppercase tracking-wider">
                      {result.urgency_level} Urgency
                    </Badge>
                  </div>
                  <Badge variant="neutral">Confidence: {result.confidence}</Badge>
                </div>

                <div className="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                  <div>
                    <h4 className="font-semibold text-text-primary flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" /> Symptoms
                    </h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                      {result.symptoms?.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-text-primary flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-green-600" /> Recommended Treatment
                    </h4>
                    <ol className="list-decimal pl-5 space-y-1 text-sm text-green-900">
                      {result.treatment?.map((t, i) => <li key={i}>{t}</li>)}
                    </ol>
                  </div>

                  <div>
                    <h4 className="font-semibold text-text-primary flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-sky-500" /> Prevention Measures
                    </h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                      {result.prevention?.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>

                  {result.organic_remedy && (
                    <div className="bg-amber-50 p-4 rounded-md border border-amber-200 flex items-start gap-3">
                      <Droplets className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-amber-900 mb-1 text-sm">Organic Remedy</h4>
                        <p className="text-amber-800 text-sm">{result.organic_remedy}</p>
                      </div>
                    </div>
                  )}

                  {result.additional_info && (
                    <p className="text-sm text-text-muted italic bg-gray-50 p-3 rounded">{result.additional_info}</p>
                  )}
                </div>
              </Card>
            </motion.div>
          ) : (
            <Card className="h-full flex items-center justify-center bg-gray-50 border-dashed border-2">
              <div className="text-center text-text-muted max-w-sm px-6">
                <Leaf className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p>Upload an image and run analysis to see detailed disease diagnostic results here.</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
