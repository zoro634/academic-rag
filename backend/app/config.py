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
    VERSION: str = "1.0.0"
    
    # Gemini LLM Settings
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    
    # ChromaDB & Vector Store
    CHROMA_PERSIST_DIRECTORY: str = os.getenv(
        "CHROMA_PERSIST_DIRECTORY", 
        str(Path(__file__).resolve().parent.parent / "chroma_db")
    )
    UPLOAD_DIRECTORY: str = os.getenv(
        "UPLOAD_DIRECTORY", 
        str(Path(__file__).resolve().parent.parent / "uploads")
    )
    
    # Document Chunking & Retrieval
    MAX_UPLOAD_SIZE_MB: int = 25
    ALLOWED_EXTENSIONS: list[str] = [".pdf", ".docx"]
    CHUNK_SIZE: int = 750
    CHUNK_OVERLAP: int = 150
    TOP_K_RESULTS: int = 4
    
    # Embedding Configuration
    # Uses sentence-transformers all-MiniLM-L6-v2 by default or Chroma default ONNX
    EMBEDDING_MODEL_NAME: str = os.getenv("EMBEDDING_MODEL_NAME", "all-MiniLM-L6-v2")
    
    # Server & Security
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    CORS_ORIGINS: list[str] = ["*"]

    model_config = {
        "env_file": ".env",
        "extra": "allow"
    }

settings = Settings()

# Ensure directories exist
os.makedirs(settings.CHROMA_PERSIST_DIRECTORY, exist_ok=True)
os.makedirs(settings.UPLOAD_DIRECTORY, exist_ok=True)
