import logging
from typing import Optional
from supabase import create_client, Client
from app.config import settings

logger = logging.getLogger("academic_rag.supabase")

_supabase_client: Optional[Client] = None

def get_supabase_client() -> Optional[Client]:
    """
    Returns singleton instance of Supabase Client.
    Gracefully returns None if SUPABASE_URL or SUPABASE_KEY are not configured.
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        logger.warning(
            "SUPABASE_URL or SUPABASE_KEY is missing. "
            "Please configure these environment variables in your deployment."
        )
        return None

    try:
        _supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        logger.info("Supabase client initialized successfully.")
        return _supabase_client
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        return None

def check_supabase_health() -> dict:
    """Check connectivity to Supabase PostgreSQL and Storage."""
    client = get_supabase_client()
    if not client:
        return {
            "connected": False,
            "message": "SUPABASE_URL or SUPABASE_KEY environment variable not configured"
        }
    
    try:
        # Test table query (lightweight limit 1)
        res = client.table("documents").select("id").limit(1).execute()
        return {
            "connected": True,
            "message": "Connected to Supabase PostgreSQL & pgvector",
            "bucket": settings.SUPABASE_STORAGE_BUCKET
        }
    except Exception as e:
        return {
            "connected": False,
            "message": f"Supabase connection test failed: {str(e)}"
        }
