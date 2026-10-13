'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  GraduationCap, 
  Settings, 
  Cpu, 
  PlusCircle,
  Menu,
} from 'lucide-react';

interface NavbarProps {
  serverStatus: 'checking' | 'ok' | 'error';
  geminiConfigured: boolean;
  sessionId: string;
  onNewSession: () => void;
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}

export default function Navbar({
  serverStatus,
  geminiConfigured,
  sessionId,
  onNewSession,
  onOpenSettings,
  onToggleSidebar,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Brand & Title */}
          <div className="flex items-center space-x-3">
            <button
              onClick={onToggleSidebar}
              className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center space-x-2.5"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 p-0.5 shadow-lg shadow-indigo-500/20 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-base sm:text-lg font-bold font-serif tracking-tight text-white flex items-center gap-1.5">
                    Academic RAG
                    <span className="text-[10px] font-sans font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      QA System
                    </span>
                  </h1>
                </div>
                <p className="hidden md:block text-[11px] text-slate-400 font-sans truncate max-w-lg">
                  Intelligent Question Answering in Academic Document Collections
                </p>
              </div>
            </motion.div>
          </div>

          {/* Right: Session, Status Pills & Settings */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Session Pill */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs"
            >
              <span className="text-slate-400">Session:</span>
              <span className="font-mono font-semibold text-indigo-300">
                {sessionId.length > 10 ? `${sessionId.substring(0, 8)}...` : sessionId}
              </span>
              <button
                onClick={onNewSession}
                className="ml-1 p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-indigo-300 transition-colors"
                title="Create isolated new session"
              >
                <PlusCircle className="w-3.5 h-3.5" />
              </button>
            </motion.div>

            {/* Server status badge */}
            <div 
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
                serverStatus === 'ok'
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                  : serverStatus === 'checking'
                  ? 'bg-amber-950/40 text-amber-300 border-amber-800/60'
                  : 'bg-rose-950/40 text-rose-300 border-rose-800/60'
              }`}
              title={serverStatus === 'ok' ? 'FastAPI Backend Online' : 'Backend Connecting...'}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                serverStatus === 'ok' ? 'bg-emerald-400 animate-pulse' : 
                serverStatus === 'checking' ? 'bg-amber-400' : 'bg-rose-400'
              }`} />
              <span className="hidden md:inline font-mono text-[11px]">
                {serverStatus === 'ok' ? 'API Online' : serverStatus === 'checking' ? 'Connecting...' : 'Offline'}
              </span>
            </div>

            {/* AI Engine status pill */}
            <div 
              className={`hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
                geminiConfigured
                  ? 'bg-indigo-950/40 text-indigo-300 border-indigo-800/60'
                  : 'bg-amber-950/40 text-amber-300 border-amber-800/60'
              }`}
              title={geminiConfigured ? 'AI LLM Configured' : 'AI API Key Required'}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span className="font-mono text-[11px]">
                {geminiConfigured ? 'LLM Active' : 'Set API Key'}
              </span>
            </div>

            {/* Settings button */}
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
              title="System Settings & API Key"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
