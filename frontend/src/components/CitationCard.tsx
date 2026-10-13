'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Copy, Check, FileText } from 'lucide-react';
import { Citation } from '@/types';

interface CitationCardProps {
  citation: Citation;
  index: number;
}

export default function CitationCard({ citation, index }: CitationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (citation.snippet) {
      navigator.clipboard.writeText(citation.snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const relevancePct = citation.relevance_score != null 
    ? Math.round(citation.relevance_score * 100) 
    : null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className="rounded-lg border border-slate-700/60 bg-slate-900/60 overflow-hidden transition-all duration-200 hover:border-indigo-500/40"
    >
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

      <AnimatePresence>
        {expanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-3.5 py-2.5 bg-slate-950/60 border-t border-slate-800/80 text-xs text-slate-300 font-serif leading-relaxed"
          >
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
              &quot;{citation.snippet}&quot;
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
