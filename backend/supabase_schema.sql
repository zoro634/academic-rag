-- ==============================================================================
-- Academic RAG Framework: Supabase PostgreSQL + pgvector Migration Schema
-- ==============================================================================
-- Run this entire script in your Supabase Dashboard:
-- 1. Go to your Supabase Project -> SQL Editor
-- 2. Paste this entire script and click "Run"
-- ==============================================================================

-- 1. Enable the pgvector extension for dense vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create the Documents metadata table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    total_pages INT NOT NULL DEFAULT 1,
    total_chunks INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for session queries
CREATE INDEX IF NOT EXISTS idx_documents_session_id ON documents(session_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);

-- 3. Create the Document Chunks table with vector(768) embeddings
-- Google text-embedding-004 produces 768-dimensional dense semantic vectors
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    document_name TEXT NOT NULL,
    page_number INT NOT NULL,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(768),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for chunk retrieval and deletion cascade
CREATE INDEX IF NOT EXISTS idx_document_chunks_session ON document_chunks(session_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_doc_id ON document_chunks(document_id);

-- HNSW Vector Index for fast cosine similarity retrieval
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw 
ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- 4. Vector similarity search function (Stored Procedure for RPC)
CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding vector(768),
  match_threshold float DEFAULT 0.0,
  match_count int DEFAULT 4,
  filter_session_id text DEFAULT 'default',
  filter_document_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  session_id text,
  document_name text,
  page_number int,
  chunk_index int,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.session_id,
    dc.document_name,
    dc.page_number,
    dc.chunk_index,
    dc.content,
    (1 - (dc.embedding <=> query_embedding))::float AS similarity
  FROM document_chunks dc
  WHERE dc.session_id = filter_session_id
    AND (filter_document_ids IS NULL OR dc.document_id = ANY(filter_document_ids))
    AND (1 - (dc.embedding <=> query_embedding)) >= match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. Storage Bucket Creation Notice:
-- In Supabase Dashboard -> Storage:
-- Create a new Public or Private bucket named: academic-documents
-- (The backend Python code will also auto-detect or create this bucket if permissions permit)
