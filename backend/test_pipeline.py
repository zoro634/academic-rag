"""
Direct unit test of DocumentParser, AcademicChunker, and VectorStoreManager.
"""
import sys
from pathlib import Path
from app.services.document_parser import DocumentParser
from app.services.chunker import AcademicChunker
from app.services.vector_store import VectorStoreManager

def main():
    sample_pdf = Path(__file__).parent / "sample_docs" / "sample_academic_paper.pdf"
    sample_docx = Path(__file__).parent / "sample_docs" / "sample_research_proposal.docx"

    print("1. Testing PDF parsing...")
    pdf_res = DocumentParser.parse_pdf(str(sample_pdf))
    print(f"   PDF parsed! Total pages: {pdf_res['total_pages']}, Extracted page blocks: {len(pdf_res['pages'])}")
    assert pdf_res['total_pages'] == 3, "Expected 3 pages"

    print("2. Testing DOCX parsing...")
    docx_res = DocumentParser.parse_docx(str(sample_docx))
    print(f"   DOCX parsed! Total logical pages: {docx_res['total_pages']}")
    assert len(docx_res['pages']) >= 1, "Expected at least 1 page"

    print("3. Testing Academic Chunker...")
    chunker = AcademicChunker(chunk_size=750, chunk_overlap=150)
    chunks = chunker.chunk_document(
        document_id="test_doc_001",
        document_name="sample_academic_paper.pdf",
        pages=pdf_res["pages"],
        session_id="test_pipeline_session"
    )
    print(f"   Chunks produced: {len(chunks)}")
    assert len(chunks) > 0, "No chunks produced"
    sample_c = chunks[0]
    print(f"   Sample chunk ID: {sample_c['chunk_id']}")
    print(f"   Sample chunk page: {sample_c['metadata']['page_number']}")
    print(f"   Sample chunk text preview: {sample_c['text'][:80]}...")

    print("4. Testing VectorStoreManager...")
    store = VectorStoreManager.get_instance()
    doc_meta = store.add_document(
        session_id="test_pipeline_session",
        document_id="test_doc_001",
        filename="sample_academic_paper.pdf",
        file_type="pdf",
        file_size_bytes=sample_pdf.stat().st_size,
        total_pages=pdf_res["total_pages"],
        chunks=chunks
    )
    print(f"   Added to ChromaDB! Document status: {doc_meta.status}, Total chunks: {doc_meta.total_chunks}")

    print("5. Testing Semantic Similarity Query...")
    query = "What was the factual precision score achieved by the RAG system?"
    results = store.query_similar_chunks(
        session_id="test_pipeline_session",
        query_text=query,
        top_k=3
    )
    print(f"   Retrieved {len(results)} chunks.")
    assert len(results) > 0, "Expected at least 1 retrieved chunk"
    top_result = results[0]
    print(f"   Top Match Similarity: {top_result['similarity_score']}")
    print(f"   Top Match Page: {top_result['metadata'].get('page_number')}")
    print(f"   Top Match Excerpt: {top_result['text'][:120]}...")

    print("\nSUCCESS: Entire Document Ingestion -> Chunking -> Vector Indexing -> Semantic Retrieval pipeline verified!")

if __name__ == "__main__":
    main()
