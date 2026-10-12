import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Copy, Check, FileText } from 'lucide-react';

export default function CitationCard({ citation, index }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(citation.snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const relevancePct = citation.relevance_score != null 
    ? Math.round(citation.relevance_score * 100) 
    : null;

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 overflow-hidden transition-all duration-200 hover:border-indigo-500/40">
      <div 
        onClick={() => setExpanded(!expanded)}
        className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 select-none text-xs"
      >
        <div className="flex items-center space-x-2 min-w-0">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-950 border border-indigo-700/60 text-indigo-300 flex items-center justify-center font-mono text-[10px] font-semibold">
            {index + 1}
          </span>
          <FileText className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
          <span className="font-medium text-slate-200 truncate max-w-[200px] sm:max-w-[280px]">
            {citation.document_name}
          </span>
          {citation.page_number && (
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700">
              Page {citation.page_number}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
          {relevancePct !== null && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
              relevancePct > 80 ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
              relevancePct > 60 ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' :
              'bg-slate-800 text-slate-300 border border-slate-700'
            }`}>
              {relevancePct}% match
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-3.5 py-2.5 bg-slate-950/60 border-t border-slate-800/80 text-xs text-slate-300 font-serif leading-relaxed">
          <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-slate-800 text-[10px] font-sans text-slate-400">
            <span>Retrieved Passage Excerpt:</span>
            <button
              onClick={handleCopy}
              className="flex items-center space-x-1 text-slate-400 hover:text-indigo-300 transition-colors"
              title="Copy excerpt"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <p className="italic text-slate-300/90 whitespace-pre-wrap">
            "{citation.snippet}"
          </p>
        </div>
      )}
    </div>
  );
}
