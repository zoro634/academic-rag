import os
import tempfile
import logging
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, Query, HTTPException, status

from app.config import settings
from app.models.schemas import (
    DocumentUploadResponse,
    DocumentListResponse,
    DocumentDeleteResponse,
)
from app.services.document_parser import DocumentParser, DocumentParsingError
from app.services.chunker import AcademicChunker
from app.services.vector_store import SupabaseVectorStore
from app.services.rag_engine import RAGEngine

router = APIRouter(prefix="", tags=["Documents"])
logger = logging.getLogger("academic_rag.documents")

chunker = AcademicChunker(
    chunk_size=settings.CHUNK_SIZE,
    chunk_overlap=settings.CHUNK_OVERLAP
)

@router.post("/documents/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    session_id: str = Form("default"),
    api_key_override: str = Form(None)
):
    """
    Upload an academic document (PDF or DOCX), persist the file in Supabase Cloud Storage,
    extract page-level text, generate 768-dim embeddings, and index into Supabase pgvector.
    """
    filename = file.filename or "unknown_file"
    file_ext = Path(filename).suffix.lower()

    # 1. Validate extension
    if file_ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported format '{file_ext}'. Allowed formats: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )

    # 2. Read bytes and validate size
    file_bytes = await file.read()
    total_size = len(file_bytes)
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if total_size > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB}MB."
        )

    vector_store = SupabaseVectorStore.get_instance()
    rag_engine = RAGEngine(vector_store)

    # 3. Upload file bytes to Supabase Cloud Storage
    try:
        storage_path = vector_store.upload_file_to_storage(
            file_bytes=file_bytes,
            filename=filename,
            session_id=session_id
        )
    except Exception as e:
        logger.error(f"Storage upload error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store file in Supabase Storage: {str(e)}"
        )

    # 4. Parse text using temporary local file
    with tempfile.NamedTemporaryFile(suffix=file_ext, delete=False) as tmp_file:
        tmp_path = tmp_file.name
        tmp_file.write(file_bytes)

    try:
        parsed_data = DocumentParser.parse_document(tmp_path)
    except DocumentParsingError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass

    pages = parsed_data.get("pages", [])
    total_pages = parsed_data.get("total_pages", len(pages))

    if not pages:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No readable text could be extracted from this document."
        )

    # 5. Chunk text with page tracking
    chunks = chunker.chunk_document(
        document_id="pending",
        document_name=filename,
        pages=pages,
        session_id=session_id
    )

    if not chunks:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Text chunking produced zero segments. Document might be empty."
        )

    # 6. Generate 768-dim embeddings via Google Gemini text-embedding-004
    chunk_texts = [c["text"] for c in chunks]
    try:
        embeddings = rag_engine.generate_embeddings_batch(
            texts=chunk_texts,
            api_key=api_key_override
        )
    except Exception as e:
        logger.error(f"Failed to generate embeddings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Embedding generation error: {str(e)}. Please check your GEMINI_API_KEY."
        )

    # 7. Insert document metadata and vector chunks into Supabase pgvector
    try:
        doc_metadata = vector_store.insert_document(
            session_id=session_id,
            filename=filename,
            file_size=total_size,
            mime_type=file.content_type or "application/octet-stream",
            storage_path=storage_path,
            total_pages=total_pages,
            total_chunks=len(chunks),
        )

        vector_store.insert_chunks(
            document_id=doc_metadata.document_id,
            session_id=session_id,
            document_name=filename,
            chunks=chunks,
            embeddings=embeddings,
        )
    except Exception as e:
        logger.error(f"Database insertion failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save document and embeddings to Supabase PostgreSQL: {str(e)}"
        )

    return DocumentUploadResponse(
        success=True,
        message=f"Document '{filename}' uploaded to Supabase Storage and indexed into {len(chunks)} pgvector chunks.",
        document=doc_metadata
    )

@router.get("/documents", response_model=DocumentListResponse)
async def list_documents(session_id: str = Query("default")):
    """List all documents uploaded and indexed for the specified session."""
    vector_store = SupabaseVectorStore.get_instance()
    docs = vector_store.list_documents(session_id=session_id)
    return DocumentListResponse(
        documents=docs,
        total_count=len(docs),
        session_id=session_id
    )

@router.delete("/documents/{document_id}", response_model=DocumentDeleteResponse)
async def delete_document(
    document_id: str,
    session_id: str = Query("default")
):
    """Delete document from Supabase PostgreSQL (cascading vector chunks) and Supabase Storage."""
    vector_store = SupabaseVectorStore.get_instance()
    try:
        deleted = vector_store.delete_document(document_id=document_id, session_id=session_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting document: {str(e)}"
        )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{document_id}' not found in session '{session_id}'."
        )

    return DocumentDeleteResponse(
        success=True,
        document_id=document_id,
        message=f"Document '{document_id}' and all associated pgvector embeddings deleted from Supabase."
    )
