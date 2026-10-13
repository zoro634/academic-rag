'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion } from 'framer-motion';
import { 
  Send, 
  Trash2, 
  Copy, 
  Check, 
  User, 
  GraduationCap, 
  Loader2, 
  BookOpen, 
  ShieldCheck, 
  ShieldAlert 
} from 'lucide-react';
import CitationCard from './CitationCard';
import WelcomeHero from './WelcomeHero';
import { ChatMessage } from '@/types';

interface ChatAreaProps {
  messages: ChatMessage[];
  loading: boolean;
  onSendMessage: (query: string) => void;
  onClearChat: () => void;
  onOpenUpload: () => void;
  hasDocuments: boolean;
  sampleQuestions: string[];
  selectedDocCount: number;
  totalDocCount: number;
}

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
}: ChatAreaProps) {
  const [inputQuery, setInputQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || loading) return;
    onSendMessage(inputQuery.trim());
    setInputQuery('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSelectSample = (sampleQuestion: string) => {
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

              {messages.length > 0 && (
                <button
                  onClick={onClearChat}
                  className="flex items-center space-x-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                  title="Clear conversation history"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear History</span>
                </button>
              )}
            </div>

            {/* Conversation Stream */}
            {messages.map((msg) => {
              const isUser = msg.role === 'user';

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`flex items-start space-x-3 sm:space-x-4 ${
                    isUser ? 'flex-row-reverse space-x-reverse' : ''
                  }`}
                >
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs shadow-md ${
                    isUser 
                      ? 'bg-indigo-600 text-white shadow-indigo-600/30' 
                      : 'bg-slate-900 border border-slate-800 text-indigo-400 shadow-slate-950/50'
                  }`}>
                    {isUser ? <User className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
                  </div>

                  {/* Message Bubble Container */}
                  <div className={`flex-1 max-w-3xl space-y-3 ${isUser ? 'items-end text-right' : ''}`}>
                    <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-300">
                        {isUser ? 'Research Scholar' : 'Academic Assistant'}
                      </span>
                      <span>•</span>
                      <span className="font-mono">{msg.timestamp}</span>

                      {!isUser && msg.isGrounded !== undefined && (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px]">
                          <span>•</span>
                          {msg.isGrounded ? (
                            <span className="text-emerald-400 flex items-center gap-0.5">
                              <ShieldCheck className="w-3 h-3" />
                              <span>Grounded</span>
                            </span>
                          ) : (
                            <span className="text-amber-400 flex items-center gap-0.5">
                              <ShieldAlert className="w-3 h-3" />
                              <span>Ungrounded</span>
                            </span>
                          )}
                        </span>
                      )}
                    </div>

                    {/* Content Box */}
                    <div className={`rounded-2xl p-4 sm:p-5 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-600/20 text-left'
                        : 'bg-slate-900/90 border border-slate-800/90 text-slate-200 rounded-tl-none shadow-xl'
                    }`}>
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-slate-950 prose-pre:border prose-pre:border-slate-800">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      )}

                      {!isUser && (
                        <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                          <span className="text-[10px] font-mono text-slate-500">
                            {msg.modelUsed ? `Synthesized by ${msg.modelUsed}` : ''}
                          </span>

                          <button
                            onClick={() => handleCopyText(msg.content, msg.id)}
                            className="flex items-center space-x-1 text-slate-400 hover:text-white transition-colors cursor-pointer text-[11px]"
                            title="Copy answer to clipboard"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Verifiable Citations references */}
                    {!isUser && msg.citations && msg.citations.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center space-x-1.5 text-xs font-semibold text-indigo-400">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Verifiable Page References ({msg.citations.length})</span>
                        </div>

                        <div className="space-y-1.5">
                          {msg.citations.map((citation, cIdx) => (
                            <CitationCard
                              key={`${msg.id}_c_${cIdx}`}
                              citation={citation}
                              index={cIdx}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {/* Loading Indicator */}
            {loading && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start space-x-3 sm:space-x-4"
              >
                <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 text-indigo-400 flex items-center justify-center flex-shrink-0 shadow-md">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div className="rounded-2xl rounded-tl-none p-4 bg-slate-900 border border-slate-800 text-slate-300 text-xs flex items-center space-x-3 shadow-xl">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <div className="space-y-0.5">
                    <p className="font-semibold text-slate-200">Retrieving & Synthesizing...</p>
                    <p className="text-[11px] text-slate-400">Searching vector embeddings and generating grounded citations</p>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="p-4 sm:p-6 bg-slate-950 border-t border-slate-800/80">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-2">
          <div className="relative rounded-2xl bg-slate-900 border border-slate-800 focus-within:border-indigo-500/80 focus-within:ring-1 focus-within:ring-indigo-500/80 transition-all shadow-xl">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={hasDocuments ? "Ask an academic question across indexed manuscripts..." : "Upload an academic paper first, or ask questions once indexed..."}
              className="w-full pl-4 pr-14 py-3.5 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none max-h-36 overflow-y-auto"
            />

            <button
              type="submit"
              disabled={!inputQuery.trim() || loading}
              className="absolute right-2.5 bottom-2.5 p-2 rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
              title="Submit Inquiry (Enter)"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 font-mono">
            <span>Press <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">Enter</kbd> to submit, <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">Shift+Enter</kbd> for new line</span>
            <span>Zero hallucination • Strict citations</span>
          </div>
        </form>
      </div>
    </div>
  );
}
