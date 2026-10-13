import logging
from typing import List, Dict, Any, Optional
import google.generativeai as genai

from app.config import settings
from app.services.vector_store import SupabaseVectorStore
from app.models.schemas import ChatResponse, Citation

logger = logging.getLogger("academic_rag.rag_engine")

class RAGEngine:
    def __init__(self, vector_store: Optional[SupabaseVectorStore] = None):
        self.vector_store = vector_store or SupabaseVectorStore.get_instance()
        self.default_model_name = settings.GEMINI_MODEL
        self.fallback_models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"]
        self.embedding_model = settings.EMBEDDING_MODEL

    def _configure_gemini(self, api_key: Optional[str] = None) -> bool:
        """Configures google.generativeai with available API key."""
        key_to_use = (api_key or "").strip() or (settings.GEMINI_API_KEY or "").strip()
        if not key_to_use:
            return False
        try:
            genai.configure(api_key=key_to_use)
            return True
        except Exception as e:
            logger.error(f"Failed to configure Gemini API: {e}")
            return False

    def generate_embedding(self, text: str, api_key: Optional[str] = None, task_type: str = "retrieval_query") -> List[float]:
        """Generates 768-dim dense embedding using Google text-embedding-004."""
        if not self._configure_gemini(api_key):
            raise RuntimeError("Gemini API key is not configured. Please supply an API key.")

        try:
            res = genai.embed_content(
                model=self.embedding_model,
                content=text,
                task_type=task_type,
            )
            return res["embedding"]
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            raise RuntimeError(f"Embedding API error: {str(e)}")

    def generate_embeddings_batch(self, texts: List[str], api_key: Optional[str] = None) -> List[List[float]]:
        """Generates 768-dim embeddings in batches for document chunks."""
        if not self._configure_gemini(api_key):
            raise RuntimeError("Gemini API key is not configured.")

        embeddings: List[List[float]] = []
        # Batch by 20 chunks to stay within per-request API payload limits
        batch_size = 20
        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i + batch_size]
            try:
                res = genai.embed_content(
                    model=self.embedding_model,
                    content=batch_texts,
                    task_type="retrieval_document",
                )
                batch_embs = res.get("embedding", [])
                # If single embedding returned instead of list of lists
                if batch_embs and isinstance(batch_embs[0], float):
                    embeddings.append(batch_embs)
                else:
                    embeddings.extend(batch_embs)
            except Exception as e:
                logger.warning(f"Batch embedding failed ({e}), falling back to item-by-item: {e}")
                for t in batch_texts:
                    item_res = genai.embed_content(
                        model=self.embedding_model,
                        content=t,
                        task_type="retrieval_document",
                    )
                    embeddings.append(item_res["embedding"])

        return embeddings

    def _call_gemini_with_fallback(self, prompt: str, system_instruction: str, api_key: Optional[str] = None) -> tuple[str, str]:
        """Calls Gemini models with automatic fallback across versions."""
        if not self._configure_gemini(api_key):
            raise RuntimeError("Gemini API key is missing. Set GEMINI_API_KEY or provide it in Settings.")

        models_to_try = [self.default_model_name] + [
            m for m in self.fallback_models if m != self.default_model_name
        ]

        last_error = None
        for model_name in models_to_try:
            try:
                model = genai.GenerativeModel(
                    model_name=model_name,
                    system_instruction=system_instruction
                )
                response = model.generate_content(
                    prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.2,
                        max_output_tokens=2048,
                    )
                )
                if response and response.text:
                    return response.text.strip(), model_name
            except Exception as e:
                logger.warning(f"Gemini {model_name} failed: {e}. Trying next model...")
                last_error = e

        raise RuntimeError(f"All Gemini generation attempts failed: {last_error}")

    def generate_grounded_answer(
        self,
        query: str,
        session_id: str = "default",
        document_ids: Optional[List[str]] = None,
        api_key_override: Optional[str] = None
    ) -> ChatResponse:
        """
        Executes complete RAG pipeline with pgvector:
        1. Query vectorization via Gemini text-embedding-004.
        2. Semantic similarity retrieval via Supabase pgvector stored proc.
        3. Strict grounding prompt construction.
        4. Synthesized answer with verifiable page citations.
        """
        # Step 1: Check existing documents
        existing_docs = self.vector_store.list_documents(session_id)
        if not existing_docs:
            return ChatResponse(
                answer=(
                    "No academic documents have been uploaded to this session yet. "
                    "Please upload a peer-reviewed PDF or DOCX research manuscript using the sidebar to begin."
                ),
                citations=[],
                session_id=session_id,
                query=query,
                documents_queried=[],
                is_grounded=False,
                model_used="none"
            )

        # Step 2: Vectorize user query
        query_embedding = self.generate_embedding(
            text=query,
            api_key=api_key_override,
            task_type="retrieval_query"
        )

        # Step 3: Retrieve relevant chunks from pgvector
        top_chunks = self.vector_store.similarity_search(
            query_embedding=query_embedding,
            session_id=session_id,
            document_ids=document_ids,
            top_k=settings.TOP_K_RESULTS,
            threshold=settings.SIMILARITY_THRESHOLD,
        )

        if not top_chunks:
            return ChatResponse(
                answer=(
                    "Based on the uploaded documents, I could not find sufficient supporting information "
                    "to answer this question. The manuscript collection does not contain context "
                    "relevant to your query."
                ),
                citations=[],
                session_id=session_id,
                query=query,
                documents_queried=[d.filename for d in existing_docs],
                is_grounded=False,
                model_used=self.default_model_name
            )

        # Step 4: Build Citations and Context
        citations: List[Citation] = []
        context_parts: List[str] = []
        documents_queried_set = set()

        for idx, chunk in enumerate(top_chunks, 1):
            doc_name = chunk.get("document_name", "Academic Document")
            page_no = chunk.get("page_number", 1)
            content = chunk.get("content", "").strip()
            sim_score = round(float(chunk.get("similarity", 0.0)), 3)
            doc_id = str(chunk.get("document_id", ""))
            chunk_id = str(chunk.get("id", f"c_{idx}"))

            documents_queried_set.add(doc_name)

            citation = Citation(
                document_id=doc_id,
                document_name=doc_name,
                page_number=page_no,
                chunk_id=chunk_id,
                snippet=content[:240] + ("..." if len(content) > 240 else ""),
                relevance_score=sim_score
            )
            citations.append(citation)

            context_parts.append(
                f"[Source Ref {idx}] Document: '{doc_name}' | Page: {page_no} (Match Relevance: {sim_score})\n"
                f"Content:\n{content}\n"
            )

        grounding_context = "\n---\n".join(context_parts)

        # Step 5: System instruction and Prompt
        system_instruction = (
            "You are an expert Academic Research Assistant. Your task is to provide rigorous, factually "
            "grounded answers to scholar and student questions strictly based on the provided manuscript excerpts.\n\n"
            "MANDATORY GROUNDING RULES:\n"
            "1. Answer ONLY using the facts, figures, methodology, and statements present in the provided context.\n"
            "2. Whenever making a claim, cite the source document and page number in brackets, for example: [Document Name, Page X].\n"
            "3. If the provided context does not contain sufficient factual evidence to answer the question, state explicitly:\n"
            "   'Based on the uploaded documents, I could not find sufficient supporting information to answer this question.'\n"
            "4. NEVER invent or hallucinate data, authors, equations, or findings not present in the excerpts."
        )

        prompt = (
            f"STUDENT RESEARCH QUESTION:\n{query}\n\n"
            f"RETRIEVED ACADEMIC CONTEXT:\n{grounding_context}\n\n"
            f"SYNTHESIZED GROUNDED ANSWER:"
        )

        # Step 6: Generate Answer via Gemini
        generated_answer, model_used = self._call_gemini_with_fallback(
            prompt=prompt,
            system_instruction=system_instruction,
            api_key=api_key_override
        )

        return ChatResponse(
            answer=generated_answer,
            citations=citations,
            session_id=session_id,
            query=query,
            documents_queried=list(documents_queried_set),
            is_grounded=True,
            model_used=model_used
        )
