import axios from 'axios';

// Get base URL from environment or fallback to window origin / localhost:8000
const getBaseUrl = () => {
  const customUrl = localStorage.getItem('academic_rag_api_url');
  if (customUrl) return customUrl;
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 90000, // 90 seconds for large document embeddings or LLM generation
});

// Interceptor to always use latest base URL
api.interceptors.request.use((config) => {
  config.baseURL = getBaseUrl();
  return config;
});

export const apiClient = {
  setCustomBaseUrl: (url) => {
    if (url) {
      localStorage.setItem('academic_rag_api_url', url.replace(/\/$/, ''));
    } else {
      localStorage.removeItem('academic_rag_api_url');
    }
  },

  getCustomBaseUrl: () => {
    return localStorage.getItem('academic_rag_api_url') || '';
  },

  getEffectiveBaseUrl: () => {
    return getBaseUrl();
  },

  checkHealth: async () => {
    const res = await api.get('/health');
    return res.data;
  },

  uploadDocument: async (file, sessionId = 'default', onProgress = null) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('session_id', sessionId);

    const res = await api.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });
    return res.data;
  },

  listDocuments: async (sessionId = 'default') => {
    const res = await api.get('/documents', {
      params: { session_id: sessionId },
    });
    return res.data;
  },

  deleteDocument: async (documentId, sessionId = 'default') => {
    const res = await api.delete(`/documents/${documentId}`, {
      params: { session_id: sessionId },
    });
    return res.data;
  },

  askQuestion: async ({ query, sessionId = 'default', documentIds = null, apiKeyOverride = null }) => {
    const payload = {
      query,
      session_id: sessionId,
      document_ids: documentIds && documentIds.length > 0 ? documentIds : null,
      api_key_override: apiKeyOverride || undefined,
    };
    const res = await api.post('/chat/ask', payload);
    return res.data;
  },

  getSampleQuestions: async () => {
    try {
      const res = await api.get('/chat/sample-questions');
      return res.data?.questions || [];
    } catch {
      return [
        "What is the core research question addressed in the uploaded document?",
        "What methodology and experimental framework did the authors use?",
        "What were the key quantitative findings and conclusions?",
        "What limitations or future directions are identified?"
      ];
    }
  },
};

export default apiClient;
