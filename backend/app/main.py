import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.models.schemas import HealthResponse
from app.routers import documents, chat
from app.services.vector_store import VectorStoreManager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("academic_rag")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize vector store
    logger.info("Initializing Academic RAG System...")
    VectorStoreManager.get_instance()
    logger.info("Academic RAG System initialized and ready.")
    yield
    logger.info("Academic RAG System shutting down.")

app = FastAPI(
    title=settings.PROJECT_TITLE,
    description=(
        "An intelligent question-answering framework powered by Retrieval-Augmented Generation (RAG), "
        "allowing students to upload academic papers (PDF/DOCX) and receive grounded, cited answers."
    ),
    version=settings.VERSION,
    lifespan=lifespan
)

# Enable CORS for frontend web application
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers (both at root level per specification and with /api prefix for flexibility)
app.include_router(documents.router)
app.include_router(chat.router)

# Also include with /api prefix
app.include_router(documents.router, prefix="/api")
app.include_router(chat.router, prefix="/api")

@app.get("/", tags=["General"])
async def root():
    return {
        "title": settings.PROJECT_TITLE,
        "short_name": settings.PROJECT_SHORT_NAME,
        "version": settings.VERSION,
        "description": "Online RAG-Based Intelligent Question Answering System for Academic Documents",
        "documentation": "/docs",
        "endpoints": {
            "health": "/health",
            "upload_document": "POST /documents/upload",
            "list_documents": "GET /documents?session_id={session_id}",
            "delete_document": "DELETE /documents/{document_id}?session_id={session_id}",
            "ask_question": "POST /chat/ask",
            "sample_questions": "GET /chat/sample-questions"
        }
    }

@app.get("/health", response_model=HealthResponse, tags=["General"])
@app.get("/api/health", response_model=HealthResponse, tags=["General"])
async def health_check():
    """
    Health check endpoint reporting backend readiness, Gemini configuration, and vector DB status.
    """
    vector_store = VectorStoreManager.get_instance()
    total_docs = vector_store.get_total_documents_count()

    return HealthResponse(
        status="ok",
        version=settings.VERSION,
        project_title=settings.PROJECT_TITLE,
        gemini_configured=bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip()),
        vector_db_status="connected",
        active_documents_count=total_docs
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
