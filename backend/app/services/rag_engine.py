import os
import logging
from typing import List, Dict, Any, Optional
import google.generativeai as genai

from app.config import settings
from app.services.vector_store import VectorStoreManager
from app.models.schemas import ChatResponse, Citation

logger = logging.getLogger(__name__)

class RAGEngine:
    def __init__(self, vector_store: Optional[VectorStoreManager] = None):
        self.vector_store = vector_store or VectorStoreManager.get_instance()
        self.default_model_name = settings.GEMINI_MODEL
        self.fallback_models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"]

    def _configure_gemini(self, api_key: Optional[str] = None) -> bool:
        """
        Configures google.generativeai with available API key.
        """
        key_to_use = (api_key or "").strip() or (settings.GEMINI_API_KEY or "").strip()
        if not key_to_use:
            return False
        try:
            genai.configure(api_key=key_to_use)
            return True
        except Exception as e:
            logger.error("Failed to configure Gemini API: %s", e)
            return False

    def _call_gemini_with_fallback(self, prompt: str, system_instruction: str, api_key: Optional[str] = None) -> tuple[str, str]:
        """
        Calls Gemini models with automatic fallback. Returns (generated_text, model_name).
        """
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
                        temperature=0.2,  # Low temperature for strict factual grounding
                        max_output_tokens=2048,
                    )
                )
                if response and response.text:
                    return response.text.strip(), model_name
            except Exception as e:
                logger.warning("Gemini model %s call failed: %s. Trying fallback...", model_name, str(e))
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
        Executes complete RAG pipeline:
        1. Retrieve semantic chunks from vector store.
        2. Format citations and context.
        3. Call Gemini LLM with strict grounding instructions.
        4. Return ChatResponse with citations.
        """
        # Step 1: Check if documents exist in this session
        existing_docs = self.vector_store.list_documents(session_id)
        if not existing_docs:
            return ChatResponse(
                answer=(
                    "No academic documents have been uploaded to your session yet. "
                    "Please upload a PDF or DOCX research paper using the sidebar to begin asking questions."
                ),
                citations=[],
                session_id=session_id,
                query=query,
                documents_queried=[],
                is_grounded=False,
                model_used="none"
            )

        # Step 2: Retrieve relevant chunks
        top_chunks = self.vector_store.query_similar_chunks(
            session_id=session_id,
            query_text=query,
            top_k=settings.TOP_K_RESULTS,
            document_ids=document_ids
        )

        if not top_chunks:
            return ChatResponse(
                answer="Based on the uploaded documents, I could not find sufficient supporting information to answer this question.",
                citations=[],
                session_id=session_id,
                query=query,
                documents_queried=[d.filename for d in existing_docs],
                is_grounded=True,
                model_used="none"
            )

        # Step 3: Build citations list
        citations: List[Citation] = []
        context_blocks = []
        documents_queried = set()

        for idx, chunk in enumerate(top_chunks, start=1):
            meta = chunk.get("metadata", {})
            doc_name = meta.get("document_name", "Unknown Document")
            doc_id = meta.get("document_id", "")
            page_num = meta.get("page_number")
            raw_text = chunk.get("text", "").strip()
            score = chunk.get("similarity_score", 0.0)

            documents_queried.add(doc_name)

            # Snippet for frontend citation preview
            snippet = raw_text[:280] + ("..." if len(raw_text) > 280 else "")

            citations.append(Citation(
                document_id=doc_id,
                document_name=doc_name,
                page_number=page_num,
                chunk_id=chunk.get("chunk_id", f"c_{idx}"),
                snippet=snippet,
                relevance_score=score
            ))

            source_label = f"Source {idx}: Document '{doc_name}'"
            if page_num:
                source_label += f", Page {page_num}"
            
            context_blocks.append(f"[{source_label}]\n{raw_text}\n")

        formatted_context = "\n--------------------\n".join(context_blocks)

        # Step 4: Check Gemini configuration
        is_configured = self._configure_gemini(api_key_override)
        if not is_configured:
            # Provide helpful response with extracted context and citations
            fallback_answer = (
                "> **Note**: Google Gemini API key is not configured yet. "
                "The semantic retrieval engine successfully found the most relevant excerpts from your documents below!\n\n"
                "To enable automated LLM synthesis:\n"
                "1. Add `GEMINI_API_KEY=your_key_here` into `backend/.env`, or\n"
                "2. Click the **Settings** icon in the top header and enter your Gemini API key.\n\n"
                "### Retrieved Context Highlights:\n"
            )
            for c in citations:
                p_text = f" (Page {c.page_number})" if c.page_number else ""
                fallback_answer += f"- **{c.document_name}{p_text}** [Relevance: {int((c.relevance_score or 0)*100)}%]:\n> *\"{c.snippet}\"*\n\n"

            return ChatResponse(
                answer=fallback_answer,
                citations=citations,
                session_id=session_id,
                query=query,
                documents_queried=list(documents_queried),
                is_grounded=True,
                model_used="retrieval-only"
            )

        # Step 5: System instruction & user prompt
        system_instruction = (
            "You are an intelligent academic research assistant for an academic document collection. "
            "Your objective is to provide rigorous, accurate, and scholarly answers based strictly on the retrieved context.\n\n"
            "MANDATORY GROUNDING RULES:\n"
            "1. Base your answer SOLELY on the provided document excerpts below. Do not use outside assumptions.\n"
            "2. Whenever stating a factual finding, method, or conclusion, cite the source name and page number "
            "(e.g., '[Document Name, Page X]').\n"
            "3. If the provided excerpts DO NOT contain sufficient supporting information to answer the question, you MUST "
            "explicitly state: 'Based on the uploaded documents, I could not find sufficient supporting information to answer this question.' "
            "Do not fabricate facts or speculate.\n"
            "4. Format your response cleanly with markdown: use bolding, bullet points, and code/math blocks if appropriate."
        )

        user_prompt = f"""RETRIEVED ACADEMIC CONTEXT:
{formatted_context}

STUDENT QUESTION:
{query}

Please formulate a clear, well-structured answer grounded strictly in the context above:"""

        try:
            answer_text, model_used = self._call_gemini_with_fallback(
                prompt=user_prompt,
                system_instruction=system_instruction,
                api_key=api_key_override
            )
            return ChatResponse(
                answer=answer_text,
                citations=citations,
                session_id=session_id,
                query=query,
                documents_queried=list(documents_queried),
                is_grounded=True,
                model_used=model_used
            )
        except Exception as e:
            logger.error("Error generating Gemini response: %s", e)
            return ChatResponse(
                answer=f"An error occurred while communicating with the Gemini API: {str(e)}",
                citations=citations,
                session_id=session_id,
                query=query,
                documents_queried=list(documents_queried),
                is_grounded=False,
                model_used="error"
            )
