import requests
import json
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"

def test_live_server():
    print("=== Testing Live FastAPI Server on Port 8000 ===")
    
    # 1. Health check
    res = requests.get(f"{BASE_URL}/health")
    print(f"1. Health Check status: {res.status_code}")
    print("   Data:", res.json())
    assert res.status_code == 200

    # 2. Upload document
    pdf_path = Path("backend/sample_docs/sample_academic_paper.pdf")
    with open(pdf_path, "rb") as f:
        files = {"file": ("sample_academic_paper.pdf", f, "application/pdf")}
        data = {"session_id": "live_session_101"}
        upload_res = requests.post(f"{BASE_URL}/documents/upload", files=files, data=data)
    
    print(f"\n2. Upload Document status: {upload_res.status_code}")
    upload_data = upload_res.json()
    print("   Uploaded Doc:", upload_data["document"]["filename"])
    print(f"   Pages: {upload_data['document']['total_pages']}, Chunks: {upload_data['document']['total_chunks']}")
    assert upload_res.status_code == 201

    # 3. List documents for session
    list_res = requests.get(f"{BASE_URL}/documents?session_id=live_session_101")
    print(f"\n3. List Documents count: {list_res.json()['total_count']}")
    assert list_res.json()["total_count"] == 1

    # 4. Ask a question
    ask_payload = {
        "query": "What is the factual precision score achieved by the RAG system and what methodology was used?",
        "session_id": "live_session_101"
    }
    chat_res = requests.post(f"{BASE_URL}/chat/ask", json=ask_payload)
    print(f"\n4. Ask Question status: {chat_res.status_code}")
    chat_data = chat_res.json()
    print("   Is Grounded:", chat_data["is_grounded"])
    print("   Citations Count:", len(chat_data["citations"]))
    for i, c in enumerate(chat_data["citations"], 1):
        print(f"     [Citation {i}] {c['document_name']} (Page {c['page_number']}) - Relevance: {c['relevance_score']}")
    print("\n   Answer Preview:\n", chat_data["answer"][:300] + "...")
    assert chat_res.status_code == 200

    print("\n=== ALL LIVE ENDPOINTS VERIFIED AND WORKING PERFECTLY! ===")

if __name__ == "__main__":
    test_live_server()
