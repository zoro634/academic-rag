'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import apiClient from '@/lib/api';
import { DocumentMetadata } from '@/types';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  onUploadSuccess: (doc: DocumentMetadata) => void;
}

export default function FileUploadModal({
  isOpen,
  onClose,
  sessionId,
  onUploadSuccess,
}: FileUploadModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'indexing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [uploadedDoc, setUploadedDoc] = useState<DocumentMetadata | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateFile = (file: File): boolean => {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.pdf', '.docx'].includes(ext)) {
      setStatus('error');
      setStatusMessage('Invalid format. Please upload an academic paper in PDF or DOCX format.');
      return false;
    }
    const maxMb = 25;
    if (file.size > maxMb * 1024 * 1024) {
      setStatus('error');
      setStatusMessage(`File exceeds maximum size limit of ${maxMb}MB.`);
      return false;
    }
    return true;
  };

  const handleDrop = (e: React.DragEvent) => {
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
            setStatusMessage('Parsing pages, extracting text & generating dense vector embeddings...');
          }
        }
      );

      setStatus('success');
      setStatusMessage(response.message || 'Document indexed successfully!');
      setUploadedDoc(response.document);
      onUploadSuccess(response.document);
    } catch (err: unknown) {
      setStatus('error');
      const errorMsg = (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail 
        || (err as Error)?.message 
        || 'Upload failed. Please ensure the backend server is online.';
      setStatusMessage(errorMsg);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setUploadProgress(0);
    setStatus('idle');
    setStatusMessage('');
    setUploadedDoc(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-semibold text-white">Ingest Academic Document</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-5">
            {/* Drag & Drop Zone */}
            {status !== 'success' && (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-indigo-500 bg-indigo-950/30'
                    : selectedFile
                    ? 'border-indigo-500/60 bg-slate-950/60'
                    : 'border-slate-700/80 hover:border-indigo-500/50 bg-slate-950/40 hover:bg-slate-950/60'
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
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    selectedFile ? 'bg-indigo-600/20 text-indigo-400' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {selectedFile ? <FileText className="w-6 h-6" /> : <UploadCloud className="w-6 h-6" />}
                  </div>

                  <div className="space-y-1">
                    {selectedFile ? (
                      <div>
                        <p className="text-sm font-semibold text-white truncate max-w-xs mx-auto">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-indigo-400 font-mono">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-slate-200">
                          Click to browse or drag & drop document
                        </p>
                        <p className="text-xs text-slate-400">
                          Supports peer-reviewed manuscripts in <strong className="text-indigo-400">PDF</strong> and <strong className="text-indigo-400">DOCX</strong> formats (up to 25MB)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Progress & Processing Visualizer */}
            {(status === 'uploading' || status === 'indexing') && (
              <div className="space-y-2.5 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    <span>{statusMessage}</span>
                  </span>
                  <span className="font-mono text-indigo-400 font-semibold">{uploadProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error Message */}
            {status === 'error' && (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-rose-200">Ingestion Error</p>
                  <p className="leading-relaxed">{statusMessage}</p>
                </div>
              </div>
            )}

            {/* Success Card */}
            {status === 'success' && uploadedDoc && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/80 text-emerald-300 text-xs space-y-2">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-emerald-200">Indexing Complete</span>
                  </div>
                  <p className="text-emerald-300/90 leading-relaxed">
                    Document <strong className="text-white">{uploadedDoc.filename}</strong> has been vectorized and indexed into the vector store.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center space-x-1.5 text-slate-400">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Physical Pages</span>
                    </div>
                    <p className="text-base font-bold font-mono text-white">{uploadedDoc.total_pages}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center space-x-1.5 text-slate-400">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Vector Chunks</span>
                    </div>
                    <p className="text-base font-bold font-mono text-white">{uploadedDoc.total_chunks}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-800">
              {status === 'success' ? (
                <>
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    Upload Another
                  </button>
                  <button
                    onClick={onClose}
                    className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all"
                  >
                    Start Querying
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
                    disabled={status === 'uploading' || status === 'indexing'}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={!selectedFile || status === 'uploading' || status === 'indexing'}
                    className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/30 transition-all flex items-center space-x-1.5"
                  >
                    {status === 'uploading' || status === 'indexing' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <span>Upload & Index</span>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
