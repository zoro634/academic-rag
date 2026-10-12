import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import FileUploadModal from './components/FileUploadModal';
import SettingsModal from './components/SettingsModal';
import apiClient from './services/api';

// Generate or restore session ID
const getInitialSessionId = () => {
  const existing = localStorage.getItem('academic_rag_session_id');
  if (existing) return existing;
  const newId = `session_${Math.random().toString(36).substring(2, 9)}`;
  localStorage.setItem('academic_rag_session_id', newId);
  return newId;
};

export default function App() {
  const [sessionId, setSessionId] = useState(getInitialSessionId);
  const [documents, setDocuments] = useState([]);
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [serverStatus, setServerStatus] = useState('checking'); // 'checking' | 'ok' | 'error'
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [sampleQuestions, setSampleQuestions] = useState([]);

  // Modals and layout state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Check health and server readiness
  const checkHealth = useCallback(async () => {
    try {
      const data = await apiClient.checkHealth();
      setServerStatus('ok');
      const hasLocalKey = !!localStorage.getItem('academic_rag_gemini_key');
      setGeminiConfigured(data.gemini_configured || hasLocalKey);
    } catch (err) {
      console.warn('Backend server connection check failed:', err);
      setServerStatus('error');
    }
  }, []);

  // Fetch documents for the current session
  const fetchDocuments = useCallback(async (currentSession) => {
    setLoadingDocuments(true);
    try {
      const res = await apiClient.listDocuments(currentSession || sessionId);
      setDocuments(res.documents || []);
    } catch (err) {
      console.error('Failed to fetch documents for session:', err);
    } finally {
      setLoadingDocuments(false);
    }
  }, [sessionId]);

  // Fetch sample questions
  const fetchSampleQuestions = useCallback(async () => {
    try {
      const questions = await apiClient.getSampleQuestions();
      setSampleQuestions(questions);
    } catch (err) {
      console.error('Failed to fetch sample questions:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    checkHealth();
    fetchDocuments(sessionId);
    fetchSampleQuestions();

    // Periodic health check
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [sessionId, checkHealth, fetchDocuments, fetchSampleQuestions]);

  // Handle creating a new isolated session
  const handleNewSession = () => {
    const newId = `session_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('academic_rag_session_id', newId);
    setSessionId(newId);
    setDocuments([]);
    setSelectedDocIds([]);
    setMessages([]);
    fetchDocuments(newId);
  };

  // Toggle document selection for scoped queries
  const handleToggleSelectDoc = (docId) => {
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
  const handleDeleteDoc = async (documentId, filename) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}" and its vector embeddings?`)) {
      return;
    }

    try {
      await apiClient.deleteDocument(documentId, sessionId);
      setDocuments((prev) => prev.filter((d) => d.document_id !== documentId));
      setSelectedDocIds((prev) => prev.filter((id) => id !== documentId));
    } catch (err) {
      alert(`Failed to delete document: ${err.response?.data?.detail || err.message}`);
    }
  };

  // Handle sending a question
  const handleSendMessage = async (queryText) => {
    if (!queryText.trim()) return;

    const userMessageId = `user_${Date.now()}`;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newUserMsg = {
      id: userMessageId,
      role: 'user',
      content: queryText.trim(),
      timestamp: timeStr,
    };

    setMessages((prev) => [...prev, newUserMsg]);
    setLoadingChat(true);

    try {
      const apiKeyOverride = localStorage.getItem('academic_rag_gemini_key') || null;
      const response = await apiClient.askQuestion({
        query: queryText.trim(),
        sessionId,
        documentIds: selectedDocIds,
        apiKeyOverride,
      });

      const assistantMsg = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        citations: response.citations || [],
        isGrounded: response.is_grounded,
        modelUsed: response.model_used,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Q&A generation failed:', err);
      const errorMsg = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: `**Error:** ${err.response?.data?.detail || err.message || 'Unable to retrieve answer from backend.'}\n\nPlease verify that the backend server is reachable and that your Gemini API key is configured.`,
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

  // Load sample academic paper for rapid testing
  const handleLoadSamplePaper = async () => {
    setUploadModalOpen(true);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Navigation */}
      <Navbar
        serverStatus={serverStatus}
        geminiConfigured={geminiConfigured}
        sessionId={sessionId}
        onNewSession={handleNewSession}
        onOpenSettings={() => setSettingsModalOpen(true)}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        sidebarOpen={sidebarOpen}
      />

      {/* Main Layout: Sidebar + Chat Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Document Management Sidebar */}
        <Sidebar
          documents={documents}
          selectedDocIds={selectedDocIds}
          onToggleSelectDoc={handleToggleSelectDoc}
          onSelectAllDocs={handleSelectAllDocs}
          onDeleteDoc={handleDeleteDoc}
          onOpenUpload={() => setUploadModalOpen(true)}
          onLoadSamplePaper={handleLoadSamplePaper}
          loadingDocuments={loadingDocuments}
          sidebarOpen={sidebarOpen}
          onCloseSidebar={() => setSidebarOpen(false)}
          sessionId={sessionId}
        />

        {/* Right Q&A Chat Area */}
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
      </div>

      {/* Modals */}
      <FileUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        sessionId={sessionId}
        onUploadSuccess={(newDoc) => {
          fetchDocuments(sessionId);
        }}
      />

      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        onSettingsSaved={() => {
          checkHealth();
        }}
      />
    </div>
  );
}
