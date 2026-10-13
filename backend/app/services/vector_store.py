import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import uuid

from app.config import settings
from app.services.supabase_client import get_supabase_client
from app.models.schemas import DocumentMetadata

logger = logging.getLogger("academic_rag.vector_store")

class SupabaseVectorStore:
    """
    Persistent Vector Store and Metadata Manager using Supabase PostgreSQL (pgvector)
    and Supabase Cloud Storage.
    Guarantees persistence across restarts and redeployments.
    """
    _instance: Optional["SupabaseVectorStore"] = None

    def __init__(self):
        self.bucket_name = settings.SUPABASE_STORAGE_BUCKET

    @classmethod
    def get_instance(cls) -> "SupabaseVectorStore":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def upload_file_to_storage(self, file_bytes: bytes, filename: str, session_id: str) -> str:
        """
        Uploads an academic document to Supabase Storage bucket.
        Returns the unique storage path.
        """
        client = get_supabase_client()
        if not client:
            raise RuntimeError("Supabase client is not configured. Please set SUPABASE_URL and SUPABASE_KEY.")

        storage_path = f"{session_id}/{uuid.uuid4().hex[:8]}_{filename}"
        try:
            # Upload with upsert=True
            client.storage.from_(self.bucket_name).upload(
                path=storage_path,
                file=file_bytes,
                file_options={"upsert": "true"}
            )
            logger.info(f"Uploaded file to Supabase Storage at: {storage_path}")
            return storage_path
        except Exception as e:
            logger.error(f"Failed to upload file to Supabase Storage: {e}")
            # If bucket doesn't exist, provide clear exception
            raise RuntimeError(
                f"Failed to upload to Supabase Storage bucket '{self.bucket_name}': {str(e)}. "
                f"Please ensure bucket '{self.bucket_name}' exists in your Supabase project."
            )

    def insert_document(
        self,
        session_id: str,
        filename: str,
        file_size: int,
        mime_type: str,
        storage_path: str,
        total_pages: int,
        total_chunks: int,
    ) -> DocumentMetadata:
        """Inserts document metadata into Supabase `documents` table."""
        client = get_supabase_client()
        if not client:
            raise RuntimeError("Supabase client not configured.")

        doc_id = str(uuid.uuid4())
        created_at_iso = datetime.now(timezone.utc).isoformat()

        doc_data = {
            "id": doc_id,
            "session_id": session_id,
            "filename": filename,
            "file_size": file_size,
            "mime_type": mime_type,
            "storage_path": storage_path,
            "total_pages": total_pages,
            "total_chunks": total_chunks,
            "created_at": created_at_iso,
        }

        try:
            client.table("documents").insert(doc_data).execute()
            logger.info(f"Document metadata inserted: {doc_id} ({filename})")
        except Exception as e:
            logger.error(f"Failed to insert document into Supabase: {e}")
            raise RuntimeError(f"Database error inserting document: {str(e)}")

        return DocumentMetadata(
            document_id=doc_id,
            filename=filename,
            file_type=filename.split(".")[-1].lower(),
            file_size_bytes=file_size,
            total_pages=total_pages,
            total_chunks=total_chunks,
            upload_time=created_at_iso,
            status="ready",
            session_id=session_id,
        )

    def insert_chunks(
        self,
        document_id: str,
        session_id: str,
        document_name: str,
        chunks: List[Dict[str, Any]],
        embeddings: List[List[float]],
    ) -> int:
        """
        Inserts document chunks and their 768-dimensional pgvector embeddings
        into the `document_chunks` table.
        """
        client = get_supabase_client()
        if not client:
            raise RuntimeError("Supabase client not configured.")

        if len(chunks) != len(embeddings):
            raise ValueError("Chunks count must match embeddings count")

        rows = []
        for chunk, emb in zip(chunks, embeddings):
            rows.append({
                "id": str(uuid.uuid4()),
                "document_id": document_id,
                "session_id": session_id,
                "document_name": document_name,
                "page_number": chunk.get("page_number", 1),
                "chunk_index": chunk.get("chunk_index", 0),
                "content": chunk.get("text", ""),
                "embedding": emb,  # Supabase client serializes list of floats to pgvector format
            })

        # Batch insert in chunks of 50 to avoid payload limits
        batch_size = 50
        total_inserted = 0
        for i in range(0, len(rows), batch_size):
            batch = rows[i:i + batch_size]
            try:
                client.table("document_chunks").insert(batch).execute()
                total_inserted += len(batch)
            except Exception as e:
                logger.error(f"Failed inserting chunk batch into Supabase pgvector: {e}")
                raise RuntimeError(f"Database error inserting vector chunks: {str(e)}")

        logger.info(f"Successfully indexed {total_inserted} chunks into pgvector for doc {document_id}")
        return total_inserted

    def similarity_search(
        self,
        query_embedding: List[float],
        session_id: str,
        document_ids: Optional[List[str]] = None,
        top_k: int = 4,
        threshold: float = 0.0,
    ) -> List[Dict[str, Any]]:
        """
        Executes semantic cosine vector search via Supabase pgvector stored procedure `match_document_chunks`.
        """
        client = get_supabase_client()
        if not client:
            raise RuntimeError("Supabase client not configured.")

        params = {
            "query_embedding": query_embedding,
            "match_threshold": threshold,
            "match_count": top_k,
            "filter_session_id": session_id,
            "filter_document_ids": document_ids if document_ids else None,
        }

        try:
            rpc_res = client.rpc("match_document_chunks", params).execute()
            results = rpc_res.data or []
            return results
        except Exception as e:
            logger.error(f"Error during pgvector similarity search RPC: {e}")
            raise RuntimeError(f"pgvector query error: {str(e)}")

    def list_documents(self, session_id: str) -> List[DocumentMetadata]:
        """Lists all uploaded documents for the specified session from Supabase."""
        client = get_supabase_client()
        if not client:
            return []

        try:
            res = (
                client.table("documents")
                .select("*")
                .eq("session_id", session_id)
                .order("created_at", desc=True)
                .execute()
            )
            rows = res.data or []
            docs = []
            for r in rows:
                docs.append(
                    DocumentMetadata(
                        document_id=str(r["id"]),
                        filename=r["filename"],
                        file_type=r["filename"].split(".")[-1].lower(),
                        file_size_bytes=r.get("file_size", 0),
                        total_pages=r.get("total_pages", 1),
                        total_chunks=r.get("total_chunks", 0),
                        upload_time=str(r.get("created_at", "")),
                        status="ready",
                        session_id=r.get("session_id", session_id),
                    )
                )
            return docs
        except Exception as e:
            logger.error(f"Failed to list documents for session {session_id}: {e}")
            return []

    def delete_document(self, document_id: str, session_id: str) -> bool:
        """
        Deletes document from Supabase `documents` (cascades to chunks)
        and deletes file from Supabase Storage.
        """
        client = get_supabase_client()
        if not client:
            raise RuntimeError("Supabase client not configured.")

        try:
            # First fetch document to find storage path
            fetch_res = (
                client.table("documents")
                .select("storage_path")
                .eq("id", document_id)
                .eq("session_id", session_id)
                .execute()
            )
            storage_path = None
            if fetch_res.data and len(fetch_res.data) > 0:
                storage_path = fetch_res.data[0].get("storage_path")

            # Delete from DB (foreign key with ON DELETE CASCADE purges document_chunks)
            client.table("documents").delete().eq("id", document_id).eq("session_id", session_id).execute()

            # Delete from Storage if path found
            if storage_path:
                try:
                    client.storage.from_(self.bucket_name).remove([storage_path])
                except Exception as st_err:
                    logger.warning(f"Failed to remove file from Supabase storage: {st_err}")

            logger.info(f"Deleted document {document_id} and purged all associated chunks.")
            return True
        except Exception as e:
            logger.error(f"Failed to delete document {document_id}: {e}")
            raise RuntimeError(f"Database error deleting document: {str(e)}")

    def get_total_documents_count(self) -> int:
        """Returns total active documents count across database."""
        client = get_supabase_client()
        if not client:
            return 0
        try:
            res = client.table("documents").select("id", count="exact").limit(1).execute()
            return res.count or 0
        except Exception:
            return 0

# Backwards compatible alias
VectorStoreManager = SupabaseVectorStore
