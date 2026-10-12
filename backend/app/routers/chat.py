import logging
from fastapi import APIRouter, HTTPException, status
from app.models.schemas import ChatRequest, ChatResponse
from app.services.rag_engine import RAGEngine

router = APIRouter(prefix="", tags=["Chat"])
logger = logging.getLogger(__name__)

rag_engine = RAGEngine()

@router.post("/chat/ask", response_model=ChatResponse)
async def ask_question(request: ChatRequest):
    """
    Receives a natural language question, generates an embedding, retrieves relevant
    document chunks from ChromaDB, queries the Gemini API with grounded context,
    and returns the synthesized answer with source references.
    """
    query_str = request.query.strip()
    if not query_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The question query cannot be empty."
        )

    try:
        response = rag_engine.generate_grounded_answer(
            query=query_str,
            session_id=request.session_id,
            document_ids=request.document_ids,
            api_key_override=request.api_key_override
        )
        return response
    except Exception as e:
        logger.error("Chat question answering failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while answering your question: {str(e)}"
        )

@router.get("/chat/sample-questions")
async def get_sample_questions():
    """
    Returns suggested academic inquiry questions for students.
    """
    return {
        "questions": [
            "What is the central research question or hypothesis investigated in the paper?",
            "What methodology, dataset, or experimental design did the authors employ?",
            "What were the key quantitative and qualitative findings?",
            "What limitations or future directions did the authors identify?"
        ]
    }
