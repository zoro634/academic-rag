from typing import List, Optional
from pydantic import BaseModel, Field

class DocumentMetadata(BaseModel):
    document_id: str
    filename: str
    file_type: str
    file_size_bytes: int
    total_pages: int
    total_chunks: int
    upload_time: str
    status: str = "ready"  # "processing", "ready", "failed"
    session_id: str = "default"

class DocumentUploadResponse(BaseModel):
    success: bool
    message: str
    document: DocumentMetadata

class DocumentListResponse(BaseModel):
    documents: List[DocumentMetadata]
    total_count: int
    session_id: str

class DocumentDeleteResponse(BaseModel):
    success: bool
    document_id: str
    message: str

class Citation(BaseModel):
    document_id: str
    document_name: str
    page_number: Optional[int] = None
    chunk_id: str
    snippet: str
    relevance_score: Optional[float] = None

class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Question asked by the user")
    session_id: str = Field(default="default", description="User session identifier for document isolation")
    document_ids: Optional[List[str]] = Field(default=None, description="Optional filter to specific document IDs")
    api_key_override: Optional[str] = Field(default=None, description="Optional per-request Gemini API key override")

class ChatResponse(BaseModel):
    answer: str
    citations: List[Citation] = []
    session_id: str
    query: str
    documents_queried: List[str] = []
    is_grounded: bool = True
    model_used: str = "gemini-2.5-flash"

class HealthResponse(BaseModel):
    status: str = "ok"
    version: str
    project_title: str
    gemini_configured: bool
    vector_db_status: str
    active_documents_count: int
    supabase_configured: bool = True
    storage_bucket: str = "academic-documents"
