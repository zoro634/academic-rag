import os
from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load .env if present
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

class Settings(BaseSettings):
    PROJECT_TITLE: str = (
        "A Retrieval-Augmented Generation Framework for Intelligent "
        "Question Answering in Academic Document Collections"
    )
    PROJECT_SHORT_NAME: str = "Academic RAG Assistant"
    VERSION: str = "2.0.0"
    
    # Supabase Configuration (PostgreSQL with pgvector & Cloud Storage)
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""))
    SUPABASE_STORAGE_BUCKET: str = os.getenv("SUPABASE_STORAGE_BUCKET", "academic-documents")
    
    # Google Gemini LLM & Embedding Settings
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "models/text-embedding-004")
    
    # Document Chunking & Retrieval Parameters
    MAX_UPLOAD_SIZE_MB: int = 25
    ALLOWED_EXTENSIONS: list[str] = [".pdf", ".docx"]
    CHUNK_SIZE: int = 750
    CHUNK_OVERLAP: int = 150
    TOP_K_RESULTS: int = 4
    SIMILARITY_THRESHOLD: float = float(os.getenv("SIMILARITY_THRESHOLD", "0.20"))
    
    # Server & CORS
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    CORS_ORIGINS: list[str] = ["*"]

    model_config = {
        "env_file": ".env",
        "extra": "allow"
    }

settings = Settings()
