import React, { useState, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  BookOpen, 
  Layers, 
  Database 
} from 'lucide-react';
import apiClient from '../services/api';

export default function FileUploadModal({
  isOpen,
  onClose,
  sessionId,
  onUploadSuccess
}) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState('idle'); // idle | uploading | indexing | success | error
  const [statusMessage, setStatusMessage] = useState('');
  const [uploadedDoc, setUploadedDoc] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateFile = (file) => {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.pdf', '.docx'].includes(ext)) {
      setStatus('error');
      setStatusMessage('Invalid file format. Please upload an academic document in PDF or DOCX format.');
      return false;
    }
    const maxMb = 25;
    if (file.size > maxMb * 1024 * 1024) {
      setStatus('error');
      setStatusMessage(`File exceeds maximum limit of ${maxMb}MB.`);
      return false;
    }
    return true;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
        setStatus('idle');
        setStatusMessage('');
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
        setStatus('idle');
        setStatusMessage('');
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setStatus('uploading');
    setUploadProgress(0);
    setStatusMessage('Uploading document to academic parsing pipeline...');

    try {
      const response = await apiClient.uploadDocument(
        selectedFile,
        sessionId,
        (progress) => {
          setUploadProgress(progress);
          if (progress === 100) {
            setStatus('indexing');
            setStatusMessage('Extracting pages, generating dense embeddings & indexing into ChromaDB...');
          }
        }
      );

      setStatus('success');
      setStatusMessage(response.message || 'Document indexed and ready for inquiry!');
      setUploadedDoc(response.document);
      if (onUploadSuccess) {
        onUploadSuccess(response.document);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setStatus('error');
      setStatusMessage(
        err.response?.data?.detail || 
        err.message || 
        'Failed to process and index the document. Check file integrity.'
      );
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setStatus('idle');
    setStatusMessage('');
    setUploadedDoc(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-semibold text-white">Upload Academic Document</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {status === 'success' ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center animate-subtle">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">Document Successfully Indexed!</h4>
                <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                  {statusMessage}
                </p>
              </div>

              {uploadedDoc && (
                <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                  <div className="text-center">
                    <span className="block text-slate-500 text-[10px]">PAGES</span>
                    <span className="font-mono font-semibold text-indigo-300">{uploadedDoc.total_pages}</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-slate-500 text-[10px]">CHUNKS</span>
                    <span className="font-mono font-semibold text-indigo-300">{uploadedDoc.total_chunks}</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-slate-500 text-[10px]">SIZE</span>
                    <span className="font-mono font-semibold text-indigo-300">
                      {Math.round(uploadedDoc.file_size_bytes / 1024)} KB
                    </span>
                  </div>
                </div>
              )}

              <div className="flex justify-center space-x-3 pt-2">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Upload Another Document
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all"
                >
                  Start Asking Questions
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Dropzone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
                  dragActive
                    ? 'border-indigo-500 bg-indigo-950/20 shadow-lg shadow-indigo-500/10'
                    : selectedFile
                    ? 'border-indigo-500/60 bg-slate-950/40'
                    : 'border-slate-700/80 hover:border-slate-600 bg-slate-950/20 hover:bg-slate-950/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-950/60 border border-indigo-700/40 flex items-center justify-center text-indigo-400">
                    <UploadCloud className="w-6 h-6" />
                  </div>

                  {selectedFile ? (
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-200 truncate max-w-xs">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-indigo-300 font-mono">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to process
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-slate-200">
                        Drag and drop your academic paper here, or{' '}
                        <span className="text-indigo-400 hover:underline">browse</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Supports PDF (PyMuPDF) and DOCX (python-docx) up to 25MB
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress and status indicator */}
              {(status === 'uploading' || status === 'indexing') && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 text-indigo-300">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{statusMessage}</span>
                    </div>
                    <span className="font-mono text-slate-400">
                      {status === 'uploading' ? `${uploadProgress}%` : 'Indexing...'}
                    </span>
                  </div>

                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${status === 'indexing' ? 100 : uploadProgress}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3 text-indigo-400" /> Recursive Text Chunking
                    </span>
                    <span className="flex items-center gap-1">
                      <Database className="w-3 h-3 text-indigo-400" /> ChromaDB Vector Store
                    </span>
                  </div>
                </div>
              )}

              {/* Error message */}
              {status === 'error' && (
                <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-start space-x-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{statusMessage}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedFile || status === 'uploading' || status === 'indexing'}
                  onClick={handleUpload}
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/30 transition-all flex items-center space-x-2"
                >
                  {(status === 'uploading' || status === 'indexing') && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>Process & Index Document</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
