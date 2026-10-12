import React from 'react';
import { 
  GraduationCap, 
  Upload, 
  Search, 
  Sparkles, 
  ShieldCheck, 
  Layers, 
  FileText, 
  BookOpen, 
  ArrowRight 
} from 'lucide-react';

export default function WelcomeHero({ 
  onGetStarted, 
  onSelectSampleQuestion,
  hasDocuments,
  sampleQuestions = [] 
}) {
  const defaultQuestions = [
    "What is the primary research hypothesis and problem statement?",
    "What methodology, dataset, and experimental setup did the authors use?",
    "What were the core quantitative results and statistical findings?",
    "What theoretical limitations or future directions are discussed?"
  ];

  const questionsToShow = sampleQuestions.length > 0 ? sampleQuestions : defaultQuestions;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-10 animate-fade-in">
      {/* Hero Badge & Title */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 text-xs font-medium">
          <GraduationCap className="w-4 h-4 text-indigo-400" />
          <span>Academic Research Intelligence</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight font-serif max-w-3xl mx-auto leading-tight">
          A Retrieval-Augmented Generation Framework for Intelligent Question Answering in Academic Document Collections
        </h1>

        <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Upload peer-reviewed research papers or scholarly manuscripts in PDF and DOCX formats. 
          Pose complex academic questions in natural language and receive factually grounded answers 
          accompanied by verifiable source citations.
        </p>

        {/* Action Button: Get Started */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onGetStarted}
            className="px-6 py-3 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all flex items-center space-x-2 group"
          >
            <Upload className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
            <span>{hasDocuments ? 'Explore Documents & Ask Questions' : 'Get Started & Upload Paper'}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* 3 Pipeline Architectural Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors space-y-2.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-800 text-indigo-400 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">1. Multi-Format Ingestion</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Extracts full-text with page-level metadata from PDF (PyMuPDF) and Word DOCX manuscripts with structural fidelity.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors space-y-2.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-800 text-indigo-400 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">2. Semantic Vector Index</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Partitions text with overlapping windows and encodes 384d dense embeddings into ChromaDB for sub-second semantic retrieval.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors space-y-2.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-800 text-indigo-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">3. Grounded Synthesis</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Strict context prompting with Google Gemini ensures zero hallucination, citing precise document names and page numbers.
          </p>
        </div>
      </div>

      {/* Suggested Academic Inquiry Questions */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Suggested Academic Research Inquiries</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {questionsToShow.map((q, idx) => (
            <button
              key={idx}
              onClick={() => onSelectSampleQuestion(q)}
              className="text-left p-3.5 rounded-xl bg-slate-900/40 hover:bg-slate-800/80 border border-slate-800/80 hover:border-indigo-500/40 text-xs text-slate-300 transition-all flex items-start space-x-2.5 group"
            >
              <Search className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0 group-hover:text-indigo-300" />
              <span className="leading-relaxed group-hover:text-white">{q}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
