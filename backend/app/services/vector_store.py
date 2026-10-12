import os
import json
import logging
import re
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path
import chromadb
from chromadb.config import Settings as ChromaSettings
from chromadb.utils import embedding_functions

from app.config import settings
from app.models.schemas import DocumentMetadata, Citation

logger = logging.getLogger(__name__)

class VectorStoreManager:
    _instance = None

    def __init__(self):
        self.persist_directory = settings.CHROMA_PERSIST_DIRECTORY
        os.makedirs(self.persist_directory, exist_ok=True)
        
        self.metadata_catalog_path = Path(self.persist_directory) / "documents_catalog.json"
        self._doc_catalog: Dict[str, Dict[str, Any]] = self._load_catalog()

        # Initialize persistent Chroma client
        self.client = chromadb.PersistentClient(
            path=self.persist_directory,
            settings=ChromaSettings(anonymized_telemetry=False)
        )
        
        # Initialize embedding function
        self.embedding_function = self._init_embedding_function()
        logger.info("ChromaDB persistent client initialized at: %s", self.persist_directory)

    @classmethod
    def get_instance(cls) -> "VectorStoreManager":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _init_embedding_function(self):
        """
        Initializes Sentence Transformers embedding function with fallback to default ONNX.
        """
        try:
            logger.info("Attempting to load SentenceTransformerEmbeddingFunction (%s)...", settings.EMBEDDING_MODEL_NAME)
            return embedding_functions.SentenceTransformerEmbeddingFunction(
                model_name=settings.EMBEDDING_MODEL_NAME
            )
        except Exception as e:
            logger.warning(
                "Could not load SentenceTransformerEmbeddingFunction (%s), falling back to DefaultEmbeddingFunction: %s",
                settings.EMBEDDING_MODEL_NAME, str(e)
            )
            return embedding_functions.DefaultEmbeddingFunction()

    def _safe_collection_name(self, session_id: str) -> str:
        """
        Chroma collection names must be 3-63 chars, alphanumeric with - or _.
        """
        clean = re.sub(r"[^a-zA-Z0-9_-]", "_", session_id)
        if len(clean) < 3:
            clean = f"sess_{clean}"
        return f"rag_{clean}"[:63]

    def _get_collection(self, session_id: str):
        collection_name = self._safe_collection_name(session_id)
        return self.client.get_or_create_collection(
            name=collection_name,
            embedding_function=self.embedding_function,
            metadata={"hnsw:space": "cosine"}
        )

    def _load_catalog(self) -> Dict[str, Dict[str, Any]]:
        if self.metadata_catalog_path.exists():
            try:
                with open(self.metadata_catalog_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.error("Failed to load document catalog: %s", e)
        return {}

    def _save_catalog(self):
        try:
            with open(self.metadata_catalog_path, "w", encoding="utf-8") as f:
                json.dump(self._doc_catalog, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error("Failed to save document catalog: %s", e)

    def add_document(
        self,
        session_id: str,
        document_id: str,
        filename: str,
        file_type: str,
        file_size_bytes: int,
        total_pages: int,
        chunks: List[Dict[str, Any]]
    ) -> DocumentMetadata:
        """
        Stores document chunks into ChromaDB and records metadata in the catalog.
        """
        collection = self._get_collection(session_id)

        ids = []
        documents = []
        metadatas = []

        for chunk in chunks:
            ids.append(chunk["chunk_id"])
            documents.append(chunk["text"])
            metadatas.append(chunk["metadata"])

        # Add to Chroma in batches if needed
        batch_size = 100
        for i in range(0, len(ids), batch_size):
            collection.add(
                ids=ids[i:i + batch_size],
                documents=documents[i:i + batch_size],
                metadatas=metadatas[i:i + batch_size]
            )

        doc_meta = DocumentMetadata(
            document_id=document_id,
            filename=filename,
            file_type=file_type,
            file_size_bytes=file_size_bytes,
            total_pages=total_pages,
            total_chunks=len(chunks),
            upload_time=datetime.utcnow().isoformat() + "Z",
            status="ready",
            session_id=session_id
        )

        catalog_key = f"{session_id}::{document_id}"
        self._doc_catalog[catalog_key] = doc_meta.model_dump()
        self._save_catalog()

        logger.info(
            "Indexed document '%s' (ID: %s) with %d chunks into session '%s'",
            filename, document_id, len(chunks), session_id
        )
        return doc_meta

    def list_documents(self, session_id: str) -> List[DocumentMetadata]:
        """
        Returns all registered documents for a session.
        """
        docs = []
        prefix = f"{session_id}::"
        for key, val in self._doc_catalog.items():
            if key.startswith(prefix) or val.get("session_id") == session_id:
                docs.append(DocumentMetadata(**val))
        
        # Sort by upload time desc
        docs.sort(key=lambda d: d.upload_time, reverse=True)
        return docs

    def get_document(self, session_id: str, document_id: str) -> Optional[DocumentMetadata]:
        catalog_key = f"{session_id}::{document_id}"
        val = self._doc_catalog.get(catalog_key)
        if val:
            return DocumentMetadata(**val)
        return None

    def delete_document(self, session_id: str, document_id: str) -> bool:
        """
        Deletes a document and its indexed chunks from ChromaDB and catalog.
        """
        collection = self._get_collection(session_id)

        try:
            # Delete chunks by document_id metadata
            collection.delete(where={"document_id": document_id})
        except Exception as e:
            logger.warning("Error deleting chunks from ChromaDB: %s", e)

        catalog_key = f"{session_id}::{document_id}"
        if catalog_key in self._doc_catalog:
            del self._doc_catalog[catalog_key]
            self._save_catalog()
            logger.info("Deleted document %s from session %s", document_id, session_id)
            return True
        return False

    def query_similar_chunks(
        self,
        session_id: str,
        query_text: str,
        top_k: int = 4,
        document_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Performs semantic similarity search against the session's document chunks.
        """
        collection = self._get_collection(session_id)
        
        # Check if collection is empty
        count = collection.count()
        if count == 0:
            return []

        where_filter = None
        if document_ids:
            if len(document_ids) == 1:
                where_filter = {"document_id": document_ids[0]}
            else:
                where_filter = {"document_id": {"$in": document_ids}}

        actual_k = min(top_k, count)

        try:
            results = collection.query(
                query_texts=[query_text],
                n_results=actual_k,
                where=where_filter,
                include=["documents", "metadatas", "distances"]
            )
        except Exception as e:
            logger.error("ChromaDB query failed: %s", e)
            return []

        retrieved: List[Dict[str, Any]] = []
        if not results or not results.get("ids") or not results["ids"][0]:
            return retrieved

        ids = results["ids"][0]
        docs = results["documents"][0]
        metas = results["metadatas"][0]
        distances = results.get("distances", [[0] * len(ids)])[0]

        for chunk_id, text, meta, dist in zip(ids, docs, metas, distances):
            # For cosine distance: distance is in [0, 2], similarity = 1 - (distance / 2) or max(0, 1 - distance)
            sim_score = max(0.0, 1.0 - float(dist)) if dist is not None else 0.5
            retrieved.append({
                "chunk_id": chunk_id,
                "text": text,
                "metadata": meta,
                "similarity_score": round(sim_score, 4)
            })

        return retrieved

    def get_total_documents_count(self) -> int:
        return len(self._doc_catalog)
