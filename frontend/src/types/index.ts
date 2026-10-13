export interface DocumentMetadata {
  document_id: string;
  filename: string;
  file_type: string;
  file_size_bytes: number;
  total_pages: number;
  total_chunks: number;
  upload_time: string;
  status: 'ready' | 'processing' | 'failed';
  session_id: string;
}

export interface Citation {
  document_id: string;
  document_name: string;
  page_number?: number | null;
  chunk_id: string;
  snippet: string;
  relevance_score?: number | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: Citation[];
  isGrounded?: boolean;
  modelUsed?: string;
}

export interface HealthResponse {
  status: string;
  version: string;
  project_title: string;
  gemini_configured: boolean;
  vector_db_status: string;
  active_documents_count: number;
  supabase_configured?: boolean;
  storage_bucket?: string;
}

export interface DocumentUploadResponse {
  success: boolean;
  message: string;
  document: DocumentMetadata;
}

export interface DocumentListResponse {
  documents: DocumentMetadata[];
  total_count: number;
  session_id: string;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
  session_id: string;
  query: string;
  documents_queried: string[];
  is_grounded: boolean;
  model_used: string;
}
