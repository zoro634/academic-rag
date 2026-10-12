import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Send, 
  Trash2, 
  Sparkles, 
  Copy, 
  Check, 
  User, 
  GraduationCap, 
  BookOpen, 
  Loader2, 
  AlertCircle, 
  Info,
  CornerDownLeft,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import CitationCard from './CitationCard';
import WelcomeHero from './WelcomeHero';

export default function ChatArea({
  messages,
  loading,
  onSendMessage,
  onClearChat,
  onOpenUpload,
  hasDocuments,
  sampleQuestions,
  selectedDocCount,
  totalDocCount
}) {
  const [inputQuery, setInputQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Handle Enter to submit (Shift+Enter for newline)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputQuery.trim() || loading) return;
    onSendMessage(inputQuery.trim());
    setInputQuery('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleCopyText = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSelectSample = (sampleQuestion) => {
    setInputQuery(sampleQuestion);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-950">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
        {messages.length === 0 ? (
          <WelcomeHero
            onGetStarted={onOpenUpload}
            onSelectSampleQuestion={handleSelectSample}
            hasDocuments={hasDocuments}
            sampleQuestions={sampleQuestions}
          />
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Header controls inside chat area */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 text-xs text-slate-400">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                <span>
                  Querying{' '}
                  <strong className="text-slate-200">
                    {selectedDocCount > 0 ? `${selectedDocCount} selected documents` : `all ${totalDocCount} documents`}
                  </strong>
                </span>
              </div>

              <button
                onClick={onClearChat}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-slate-200 transition-colors"
                title="Clear current inquiry history"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Chat</span>
              </button>
            </div>

            {/* Message history */}
            {messages.map((msg) => (
              <div key={msg.id} className="space-y-3 animate-fade-in">
                {msg.role === 'user' ? (
                  /* Student Question Bubble */
                  <div className="flex items-start justify-end space-x-3 pl-8">
                    <div className="max-w-2xl rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-3 text-white text-sm shadow-lg shadow-indigo-600/20">
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      <span className="block text-[10px] text-indigo-200/80 text-right mt-1 font-mono">
                        {msg.timestamp || 'Just now'}
                      </span>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-indigo-950 border border-indigo-700/60 flex items-center justify-center flex-shrink-0 text-indigo-300">
                      <User className="w-4 h-4" />
                    </div>
                  </div>
                ) : (
                  /* Assistant Grounded Answer Bubble */
                  <div className="flex items-start space-x-3 pr-8">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-700 to-indigo-500 p-0.5 flex items-center justify-center flex-shrink-0 text-white shadow-md shadow-indigo-500/20">
                      <GraduationCap className="w-4 h-4" />
                    </div>

                    <div className="flex-1 max-w-3xl rounded-2xl rounded-tl-sm bg-slate-900/90 border border-slate-800 p-4 sm:p-5 shadow-xl space-y-4">
                      {/* Message Header: Grounding Status & Copy */}
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80 text-xs">
                        <div className="flex items-center space-x-2">
                          {msg.isGrounded ? (
                            <span className="flex items-center space-x-1 text-emerald-400 font-medium text-[11px] bg-emerald-950/40 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Grounded Academic Synthesis</span>
                            </span>
                          ) : (
                            <span className="flex items-center space-x-1 text-amber-400 font-medium text-[11px] bg-amber-950/40 border border-amber-800/60 px-2 py-0.5 rounded-full">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              <span>Insufficient Document Context</span>
                            </span>
                          )}

                          {msg.modelUsed && (
                            <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
                              • {msg.modelUsed}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => handleCopyText(msg.content, msg.id)}
                          className="flex items-center space-x-1 text-slate-400 hover:text-white transition-colors"
                          title="Copy answer markdown"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-[11px] text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span className="text-[11px]">Copy</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Markdown Answer Content */}
                      <div className="prose prose-invert prose-indigo max-w-none text-xs sm:text-sm leading-relaxed font-sans text-slate-200">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>

                      {/* Source Citations Section */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="pt-3 border-t border-slate-800/80 space-y-2">
                          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-400">
                            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Source References & Retrieved Evidence ({msg.citations.length})</span>
                          </div>

                          <div className="grid grid-cols-1 gap-2 pt-1">
                            {msg.citations.map((citation, cIdx) => (
                              <CitationCard 
                                key={citation.chunk_id || cIdx} 
                                citation={citation} 
                                index={cIdx} 
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Pulsing Loading Indicator */}
            {loading && (
              <div className="flex items-start space-x-3 pr-8 animate-fade-in">
                <div className="w-8 h-8 rounded-xl bg-indigo-600/80 flex items-center justify-center flex-shrink-0 text-white animate-pulse">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div className="p-4 rounded-2xl rounded-tl-sm bg-slate-900 border border-slate-800 shadow-xl space-y-2 max-w-md">
                  <div className="flex items-center space-x-2 text-xs font-medium text-indigo-300">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    <span>Retrieving context & synthesizing with Gemini...</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Searching ChromaDB vector embeddings with cosine similarity, constructing context windows, and invoking Gemini 2.5 Flash.
                  </p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Bottom Sticky Input Form */}
      <div className="border-t border-slate-800/80 bg-slate-950/90 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-2">
          <div className="relative rounded-2xl bg-slate-900 border border-slate-800 focus-within:border-indigo-500/80 focus-within:ring-1 focus-within:ring-indigo-500/40 shadow-xl transition-all">
            <textarea
              ref={textareaRef}
              rows={2}
              value={inputQuery}
              onChange={(e) => {
                setInputQuery(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                hasDocuments 
                  ? "Ask an academic question about your uploaded documents... (e.g., 'What methodology did the authors use?')" 
                  : "Upload an academic paper first, or ask questions once indexed..."
              }
              className="w-full bg-transparent px-4 py-3.5 pr-24 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none leading-relaxed"
            />

            <div className="absolute right-3 bottom-3 flex items-center space-x-2">
              <button
                type="submit"
                disabled={!inputQuery.trim() || loading}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all flex items-center space-x-1.5 group"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <span>Ask</span>
                    <CornerDownLeft className="w-3 h-3 text-indigo-200 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span>Press <kbd className="px-1 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[10px]">Enter</kbd> to submit, <kbd className="px-1 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[10px]">Shift+Enter</kbd> for new line</span>
            <span className="hidden sm:inline">Answers strictly grounded in uploaded documents</span>
          </div>
        </form>
      </div>
    </div>
  );
}
