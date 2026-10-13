'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import ChatArea from '@/components/ChatArea';
import FileUploadModal from '@/components/FileUploadModal';
import SettingsModal from '@/components/SettingsModal';
import apiClient from '@/lib/api';
import { DocumentMetadata, ChatMessage } from '@/types';

// Generate or restore session ID
const getInitialSessionId = (): string => {
  if (typeof window === 'undefined') return 'session_default';
  const existing = localStorage.getItem('academic_rag_session_id');
  if (existing) return existing;
  const newId = `session_${Math.random().toString(36).substring(2, 9)}`;
  localStorage.setItem('academic_rag_session_id', newId);
  return newId;
};

export default function Home() {
  const [sessionId, setSessionId] = useState<string>('session_default');
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState<boolean>(false);
  const [loadingDocuments, setLoadingDocuments] = useState<boolean>(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [geminiConfigured, setGeminiConfigured] = useState<boolean>(false);
  const [sampleQuestions, setSampleQuestions] = useState<string[]>([]);

  // Modals & layout
  const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Initialize session ID on client
  useEffect(() => {
    setSessionId(getInitialSessionId());
  }, []);

  // Check health and server readiness
  const checkHealth = useCallback(async () => {
    try {
      const data = await apiClient.checkHealth();
      setServerStatus('ok');
      const hasLocalKey = typeof window !== 'undefined' && !!localStorage.getItem('academic_rag_api_key');
      setGeminiConfigured(data.gemini_configured || hasLocalKey);
    } catch (err) {
      console.warn('Backend server connection check failed:', err);
      setServerStatus('error');
    }
  }, []);

  // Fetch documents for the current session
  const fetchDocuments = useCallback(async (currentSession: string) => {
    setLoadingDocuments(true);
    try {
      const res = await apiClient.listDocuments(currentSession);
      setDocuments(res.documents || []);
    } catch (err) {
      console.error('Failed to fetch documents for session:', err);
    } finally {
      setLoadingDocuments(false);
    }
  }, []);

  // Fetch sample questions
  const fetchSampleQuestions = useCallback(async () => {
    try {
      const questions = await apiClient.getSampleQuestions();
      setSampleQuestions(questions);
    } catch (err) {
      console.error('Failed to fetch sample questions:', err);
    }
  }, []);

  // Initial load and periodic health polling
  useEffect(() => {
    if (sessionId) {
      checkHealth();
      fetchDocuments(sessionId);
      fetchSampleQuestions();

      const interval = setInterval(checkHealth, 30000);
      return () => clearInterval(interval);
    }
  }, [sessionId, checkHealth, fetchDocuments, fetchSampleQuestions]);

  // Handle creating a new isolated session
  const handleNewSession = () => {
    const newId = `session_${Math.random().toString(36).substring(2, 9)}`;
    if (typeof window !== 'undefined') {
      localStorage.setItem('academic_rag_session_id', newId);
    }
    setSessionId(newId);
    setDocuments([]);
    setSelectedDocIds([]);
    setMessages([]);
    fetchDocuments(newId);
  };

  // Toggle document selection for scoped queries
  const handleToggleSelectDoc = (docId: string) => {
    setSelectedDocIds((prev) => {
      if (prev.includes(docId)) {
        return prev.filter((id) => id !== docId);
      } else {
        return [...prev, docId];
      }
    });
  };

  const handleSelectAllDocs = () => {
    setSelectedDocIds([]);
  };

  // Delete a document
  const handleDeleteDoc = async (documentId: string, filename: string) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}" and its vector embeddings?`)) {
      return;
    }

    try {
      await apiClient.deleteDocument(documentId, sessionId);
      setDocuments((prev) => prev.filter((d) => d.document_id !== documentId));
      setSelectedDocIds((prev) => prev.filter((id) => id !== documentId));
    } catch (err: unknown) {
      const errorMsg = (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail 
        || (err as Error)?.message;
      alert(`Failed to delete document: ${errorMsg}`);
    }
  };

  // Handle sending a question
  const handleSendMessage = async (queryText: string) => {
    if (!queryText.trim()) return;

    const userMessageId = `user_${Date.now()}`;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newUserMsg: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content: queryText.trim(),
      timestamp: timeStr,
    };

    setMessages((prev) => [...prev, newUserMsg]);
    setLoadingChat(true);

    try {
      const apiKeyOverride = typeof window !== 'undefined' ? localStorage.getItem('academic_rag_api_key') : null;
      const response = await apiClient.askQuestion({
        query: queryText.trim(),
        sessionId,
        documentIds: selectedDocIds,
        apiKeyOverride,
      });

      const assistantMsg: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        citations: response.citations || [],
        isGrounded: response.is_grounded,
        modelUsed: response.model_used,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      console.error('Q&A generation failed:', err);
      const errorDetail = (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail 
        || (err as Error)?.message 
        || 'Unable to retrieve answer from backend.';
      
      const errorMsg: ChatMessage = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: `**Error:** ${errorDetail}\n\nPlease verify that the backend server is reachable.`,
        citations: [],
        isGrounded: false,
        modelUsed: 'error',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoadingChat(false);
    }
  };

  // Clear chat history
  const handleClearChat = () => {
    if (messages.length > 0 && window.confirm('Clear all conversation messages?')) {
      setMessages([]);
    }
  };

  // Handle successful upload
  const handleUploadSuccess = (newDoc: DocumentMetadata) => {
    setDocuments((prev) => [newDoc, ...prev.filter((d) => d.document_id !== newDoc.document_id)]);
    fetchDocuments(sessionId);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        serverStatus={serverStatus}
        geminiConfigured={geminiConfigured}
        sessionId={sessionId}
        onNewSession={handleNewSession}
        onOpenSettings={() => setSettingsModalOpen(true)}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        sidebarOpen={sidebarOpen}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document Sidebar */}
        <Sidebar
          documents={documents}
          selectedDocIds={selectedDocIds}
          onToggleSelectDoc={handleToggleSelectDoc}
          onSelectAllDocs={handleSelectAllDocs}
          onDeleteDoc={handleDeleteDoc}
          onOpenUpload={() => setUploadModalOpen(true)}
          loadingDocuments={loadingDocuments}
          sidebarOpen={sidebarOpen}
          onCloseSidebar={() => setSidebarOpen(false)}
          sessionId={sessionId}
        />

        {/* Chat Workspace */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <ChatArea
            messages={messages}
            loading={loadingChat}
            onSendMessage={handleSendMessage}
            onClearChat={handleClearChat}
            onOpenUpload={() => setUploadModalOpen(true)}
            hasDocuments={documents.length > 0}
            sampleQuestions={sampleQuestions}
            selectedDocCount={selectedDocIds.length}
            totalDocCount={documents.length}
          />
        </main>
      </div>

      {/* Upload Modal */}
      <FileUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        sessionId={sessionId}
        onUploadSuccess={handleUploadSuccess}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        onSettingsSaved={() => {
          checkHealth();
          fetchDocuments(sessionId);
        }}
      />
    </div>
  );
}
