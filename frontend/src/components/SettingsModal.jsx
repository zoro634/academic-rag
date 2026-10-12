import React, { useState, useEffect } from 'react';
import { 
  X, 
  Key, 
  Server, 
  Cpu, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ExternalLink,
  ShieldAlert,
  RotateCcw
} from 'lucide-react';
import apiClient from '../services/api';

export default function SettingsModal({
  isOpen,
  onClose,
  onSettingsSaved
}) {
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success: bool, message: str }

  useEffect(() => {
    if (isOpen) {
      setApiKey(localStorage.getItem('academic_rag_gemini_key') || '');
      setApiUrl(apiClient.getCustomBaseUrl() || '');
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    // Temporarily apply custom url if entered
    if (apiUrl) {
      apiClient.setCustomBaseUrl(apiUrl);
    }

    try {
      const data = await apiClient.checkHealth();
      setTestResult({
        success: true,
        message: `Connected successfully! Version ${data.version}, ChromaDB status: ${data.vector_db_status}, Gemini configured: ${data.gemini_configured ? 'Yes' : 'No (backend)'}`,
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: `Connection failed: ${err.message}. Ensure the FastAPI server is running.`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem('academic_rag_gemini_key', apiKey.trim());
    } else {
      localStorage.removeItem('academic_rag_gemini_key');
    }

    apiClient.setCustomBaseUrl(apiUrl.trim());

    if (onSettingsSaved) {
      onSettingsSaved({
        apiKey: apiKey.trim(),
        apiUrl: apiUrl.trim(),
      });
    }
    onClose();
  };

  const handleReset = () => {
    localStorage.removeItem('academic_rag_gemini_key');
    apiClient.setCustomBaseUrl('');
    setApiKey('');
    setApiUrl('');
    setTestResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-semibold text-white">System Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Gemini API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                <span>Google Gemini API Key</span>
              </label>
              <a
                href="https://aistudio.google.com/"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-indigo-400 hover:underline flex items-center gap-0.5"
              >
                Get Free Key <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy... (or leave blank if set in backend .env)"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-slate-200 placeholder-slate-600 focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-200"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Used to generate grounded Q&A syntheses via Google Gemini 2.5 Flash. Never exposed to public users.
            </p>
          </div>

          {/* Backend API Endpoint */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-indigo-400" />
              <span>Backend Server URL</span>
            </label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:8000 (or your Render deployed URL)"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-slate-200 placeholder-slate-600 focus:outline-none transition-colors font-mono"
            />
            <p className="text-[11px] text-slate-500">
              When deployed to Vercel, set your hosted backend URL here or in Vercel's <code className="text-slate-400">VITE_API_BASE_URL</code> environment variable.
            </p>
          </div>

          {/* Test Connection Button */}
          <div>
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="w-full py-2 px-3 rounded-xl text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 transition-colors flex items-center justify-center space-x-2"
            >
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5" />}
              <span>Test Backend API Connection</span>
            </button>

            {testResult && (
              <div className={`mt-2 p-2.5 rounded-xl border text-xs flex items-start space-x-2 ${
                testResult.success 
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' 
                  : 'bg-rose-950/40 border-rose-800 text-rose-300'
              }`}>
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                )}
                <span className="leading-relaxed">{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <button
              onClick={handleReset}
              className="text-xs text-slate-500 hover:text-slate-300 flex items-center space-x-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>

            <div className="flex space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
