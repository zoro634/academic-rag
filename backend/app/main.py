import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.models.schemas import HealthResponse
from app.routers import documents, chat
from app.services.vector_store import SupabaseVectorStore
from app.services.supabase_client import check_supabase_health

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("academic_rag")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Academic RAG System (Supabase pgvector + Gemini)...")
    store = SupabaseVectorStore.get_instance()
    logger.info("Academic RAG System initialized.")
    yield
    logger.info("Academic RAG System shutting down.")

app = FastAPI(
    title=settings.PROJECT_TITLE,
    description=(
        "An intelligent question-answering framework powered by Retrieval-Augmented Generation (RAG), "
        "backed by Supabase PostgreSQL (pgvector), Supabase Storage, and Google Gemini 2.5 Flash."
    ),
    version=settings.VERSION,
    lifespan=lifespan
)

# Enable CORS for frontend web application (Vercel & local)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers (both root level and /api prefix)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(documents.router, prefix="/api")
app.include_router(chat.router, prefix="/api")

@app.get("/", tags=["General"])
async def root():
    return {
        "title": settings.PROJECT_TITLE,
        "short_name": settings.PROJECT_SHORT_NAME,
        "version": settings.VERSION,
        "description": "Supabase pgvector + Gemini Academic RAG Intelligent Question Answering Framework",
        "documentation": "/docs",
        "vector_store": "Supabase PostgreSQL (pgvector)",
        "storage": "Supabase Cloud Storage",
        "llm": settings.GEMINI_MODEL,
        "embedding": settings.EMBEDDING_MODEL,
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
    Health check endpoint reporting backend readiness, Supabase connection,
    and Gemini configuration.
    """
    vector_store = SupabaseVectorStore.get_instance()
    total_docs = vector_store.get_total_documents_count()
    sp_health = check_supabase_health()

    return HealthResponse(
        status="ok",
        version=settings.VERSION,
        project_title=settings.PROJECT_TITLE,
        gemini_configured=bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip()),
        vector_db_status="connected" if sp_health.get("connected") else "unconfigured_or_offline",
        active_documents_count=total_docs,
        supabase_configured=bool(settings.SUPABASE_URL and settings.SUPABASE_KEY),
        storage_bucket=settings.SUPABASE_STORAGE_BUCKET
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
