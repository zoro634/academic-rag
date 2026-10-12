import os
import uuid
import shutil
import logging
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, Query, HTTPException, status

from app.config import settings
from app.models.schemas import (
    DocumentUploadResponse,
    DocumentListResponse,
    DocumentDeleteResponse,
    DocumentMetadata
)
from app.services.document_parser import DocumentParser, DocumentParsingError
from app.services.chunker import AcademicChunker
from app.services.vector_store import VectorStoreManager

router = APIRouter(prefix="", tags=["Documents"])
logger = logging.getLogger(__name__)

chunker = AcademicChunker(
    chunk_size=settings.CHUNK_SIZE,
    chunk_overlap=settings.CHUNK_OVERLAP
)

@router.post("/documents/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    session_id: str = Form("default")
):
    """
    Upload an academic document (PDF or DOCX), extract text with page metadata,
    generate semantic chunks and embeddings, and store them in ChromaDB.
    """
    filename = file.filename or "unknown_file"
    file_ext = Path(filename).suffix.lower()

    # 1. Validate file extension
    if file_ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{file_ext}'. Allowed formats: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )

    # 2. Save file temporarily and check size
    document_id = str(uuid.uuid4())
    temp_filename = f"{document_id}_{filename}"
    temp_file_path = Path(settings.UPLOAD_DIRECTORY) / temp_filename

    try:
        total_size = 0
        with open(temp_file_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                total_size += len(chunk)
                if total_size > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB}MB."
                    )
                buffer.write(chunk)

        # 3. Parse document
        try:
            parsed_data = DocumentParser.parse_document(str(temp_file_path))
        except DocumentParsingError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(e)
            )

        pages = parsed_data.get("pages", [])
        total_pages = parsed_data.get("total_pages", len(pages))

        if not pages:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No readable text could be extracted from this document."
            )

        # 4. Chunk document text
        chunks = chunker.chunk_document(
            document_id=document_id,
            document_name=filename,
            pages=pages,
            session_id=session_id
        )

        if not chunks:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Text chunking produced zero segments. Document might be empty."
            )

        # 5. Store chunks & embeddings in ChromaDB
        vector_store = VectorStoreManager.get_instance()
        doc_metadata = vector_store.add_document(
            session_id=session_id,
            document_id=document_id,
            filename=filename,
            file_type=file_ext.replace(".", ""),
            file_size_bytes=total_size,
            total_pages=total_pages,
            chunks=chunks
        )

        return DocumentUploadResponse(
            success=True,
            message=f"Document '{filename}' successfully processed and indexed into {len(chunks)} chunks.",
            document=doc_metadata
        )

    except HTTPException:
        # Re-raise explicit HTTP exceptions
        if temp_file_path.exists():
            temp_file_path.unlink(missing_ok=True)
        raise

    except Exception as e:
        logger.error("Failed to process document upload: %s", e, exc_info=True)
        if temp_file_path.exists():
            temp_file_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while processing the document: {str(e)}"
        )

@router.get("/documents", response_model=DocumentListResponse)
async def list_documents(session_id: str = Query("default")):
    """
    List all documents uploaded and indexed for the specified session.
    """
    vector_store = VectorStoreManager.get_instance()
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
    """
    Delete a document and completely remove its indexed chunks and embeddings from ChromaDB.
    """
    vector_store = VectorStoreManager.get_instance()
    deleted = vector_store.delete_document(session_id=session_id, document_id=document_id)
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID '{document_id}' not found in session '{session_id}'."
        )

    return DocumentDeleteResponse(
        success=True,
        document_id=document_id,
        message=f"Document '{document_id}' and all associated vector embeddings have been deleted."
    )
