import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "project_title" in data
    assert data["vector_db_status"] == "connected"

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "Academic RAG" in data["short_name"]
    assert "endpoints" in data

def test_sample_questions():
    response = client.get("/chat/sample-questions")
    assert response.status_code == 200
    data = response.json()
    assert "questions" in data
    assert len(data["questions"]) > 0

def test_list_documents_empty():
    response = client.get("/documents?session_id=test_empty_session")
    assert response.status_code == 200
    data = response.json()
    assert data["total_count"] == 0
    assert data["documents"] == []

def test_chat_empty_session():
    response = client.post("/chat/ask", json={
        "query": "What is the core conclusion of the paper?",
        "session_id": "test_empty_session_123"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["is_grounded"] is False
    assert "No academic documents have been uploaded" in data["answer"]

def test_upload_invalid_file_extension():
    response = client.post(
        "/documents/upload",
        files={"file": ("malicious.exe", b"fake binary content", "application/octet-stream")},
        data={"session_id": "test_session"}
    )
    assert response.status_code == 400
    assert "Unsupported file format" in response.json()["detail"]
