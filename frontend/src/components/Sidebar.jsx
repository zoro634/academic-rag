import React from 'react';
import { 
  FileText, 
  Trash2, 
  Upload, 
  Layers, 
  CheckCircle2, 
  Clock, 
  Plus, 
  FileSpreadsheet, 
  HelpCircle,
  Database,
  Filter,
  RefreshCw,
  Sparkles,
  BookOpen
} from 'lucide-react';

export default function Sidebar({
  documents = [],
  selectedDocIds = [],
  onToggleSelectDoc,
  onSelectAllDocs,
  onDeleteDoc,
  onOpenUpload,
  onLoadSamplePaper,
  loadingDocuments,
  sidebarOpen,
  onCloseSidebar,
  sessionId
}) {
  const formatSize = (bytes) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div 
          onClick={onCloseSidebar}
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar container */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-80 flex-shrink-0 flex flex-col
        border-r border-slate-800/80 bg-slate-950
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Top Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide uppercase font-sans">
                Document Corpus
              </h2>
              <p className="text-[11px] text-slate-400">
                {documents.length} {documents.length === 1 ? 'document' : 'documents'} indexed
              </p>
            </div>
          </div>

          <button
            onClick={onOpenUpload}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm shadow-indigo-600/30 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>
        </div>

        {/* Filter Toolbar (if documents exist) */}
        {documents.length > 0 && (
          <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800/60 flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-400">
              Query Scope: {selectedDocIds.length === 0 ? 'All Documents' : `${selectedDocIds.length} Selected`}
            </span>
            {selectedDocIds.length > 0 && (
              <button
                onClick={onSelectAllDocs}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 underline"
              >
                Clear Filter
              </button>
            )}
          </div>
        )}

        {/* Document List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {loadingDocuments ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 space-y-2">
              <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
              <p className="text-xs">Loading indexed documents...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12 px-3 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 mx-auto flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-300">No Academic Documents Yet</p>
                <p className="text-[11px] text-slate-500 max-w-[200px] mx-auto leading-relaxed">
                  Upload PDF research papers or Word manuscripts to activate semantic RAG.
                </p>
              </div>

              <div className="pt-2 space-y-2">
                <button
                  onClick={onOpenUpload}
                  className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-700/50 transition-colors flex items-center justify-center space-x-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Document</span>
                </button>

                {onLoadSamplePaper && (
                  <button
                    onClick={onLoadSamplePaper}
                    className="w-full py-1.5 px-3 rounded-xl text-[11px] text-slate-400 hover:text-slate-200 bg-slate-900/60 hover:bg-slate-800 border border-slate-800 transition-colors flex items-center justify-center space-x-1"
                  >
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>Load Demo Academic Paper</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            documents.map((doc) => {
              const isSelected = selectedDocIds.includes(doc.document_id);
              const isPdf = doc.file_type === 'pdf' || doc.filename.toLowerCase().endsWith('.pdf');

              return (
                <div
                  key={doc.document_id}
                  onClick={() => onToggleSelectDoc(doc.document_id)}
                  className={`group relative rounded-xl border p-3 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-indigo-500/80 bg-indigo-950/30'
                      : 'border-slate-800/80 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/70'
                  }`}
                >
                  <div className="flex items-start justify-between space-x-2">
                    <div className="flex items-start space-x-2.5 min-w-0">
                      <div className={`mt-0.5 p-1.5 rounded-lg flex-shrink-0 ${
                        isPdf 
                          ? 'bg-rose-950/60 text-rose-400 border border-rose-800/60' 
                          : 'bg-blue-950/60 text-blue-400 border border-blue-800/60'
                      }`}>
                        <FileText className="w-4 h-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 
                          className="text-xs font-medium text-slate-200 truncate group-hover:text-white"
                          title={doc.filename}
                        >
                          {doc.filename}
                        </h4>

                        <div className="flex items-center space-x-2 mt-1 text-[10px] text-slate-400 font-mono">
                          <span>{doc.total_pages} {doc.total_pages === 1 ? 'page' : 'pages'}</span>
                          <span>•</span>
                          <span>{doc.total_chunks} chunks</span>
                          <span>•</span>
                          <span>{formatSize(doc.file_size_bytes)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteDoc(doc.document_id, doc.filename);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-all flex-shrink-0"
                      title="Delete document and vector embeddings"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Status Badge */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                    <div className="flex items-center space-x-1">
                      {doc.status === 'ready' ? (
                        <span className="flex items-center space-x-1 text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Indexed & Ready</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1 text-amber-400 font-medium">
                          <Clock className="w-3 h-3 animate-spin" />
                          <span>Processing...</span>
                        </span>
                      )}
                    </div>

                    <span className="text-slate-500">
                      {isSelected ? 'Active Scope' : 'Click to filter'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 text-[11px] text-slate-400 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span>ChromaDB Vector Store</span>
            </span>
            <span className="font-mono text-emerald-400 text-[10px] px-1.5 py-0.2 rounded bg-emerald-950/60 border border-emerald-800">
              PERSISTENT
            </span>
          </div>
          <p className="text-[10px] text-slate-500 leading-tight">
            Isolated collection for session <code className="text-indigo-300 font-mono">{sessionId}</code>
          </p>
        </div>
      </aside>
    </>
  );
}
