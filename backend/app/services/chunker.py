import uuid
from typing import List, Dict, Any

class AcademicChunker:
    """
    Intelligent chunker that divides page-aware text into semantic chunks
    with overlap, preserving page numbers and document metadata.
    """
    def __init__(self, chunk_size: int = 750, chunk_overlap: int = 150):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = ["\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " "]

    def _split_text(self, text: str) -> List[str]:
        """
        Recursively splits text into chunks under chunk_size with overlap.
        """
        if len(text) <= self.chunk_size:
            return [text.strip()] if text.strip() else []

        # Find the best separator that exists in text
        chosen_sep = " "
        for sep in self.separators:
            if sep in text:
                chosen_sep = sep
                break

        parts = text.split(chosen_sep)
        chunks: List[str] = []
        current_chunk: List[str] = []
        current_len = 0

        for part in parts:
            part_len = len(part) + len(chosen_sep)
            if current_len + part_len > self.chunk_size and current_chunk:
                chunk_str = chosen_sep.join(current_chunk).strip()
                if chunk_str:
                    chunks.append(chunk_str)
                
                # Keep overlap from the end of current_chunk
                overlap_len = 0
                overlap_parts: List[str] = []
                for p in reversed(current_chunk):
                    if overlap_len + len(p) <= self.chunk_overlap:
                        overlap_parts.insert(0, p)
                        overlap_len += len(p) + len(chosen_sep)
                    else:
                        break
                current_chunk = overlap_parts
                current_len = sum(len(p) + len(chosen_sep) for p in current_chunk)

            current_chunk.append(part)
            current_len += part_len

        if current_chunk:
            final_str = chosen_sep.join(current_chunk).strip()
            if final_str:
                chunks.append(final_str)

        return chunks

    def chunk_document(
        self, 
        document_id: str, 
        document_name: str, 
        pages: List[Dict[str, Any]], 
        session_id: str = "default"
    ) -> List[Dict[str, Any]]:
        """
        Splits a document's extracted pages into chunk records for vector storage.
        """
        all_chunks: List[Dict[str, Any]] = []
        global_chunk_idx = 0

        for page_data in pages:
            page_num = page_data.get("page_number", 1)
            page_text = page_data.get("text", "")

            if not page_text.strip():
                continue

            page_chunks = self._split_text(page_text)

            for local_idx, chunk_text in enumerate(page_chunks):
                chunk_id = f"{document_id}_p{page_num}_c{local_idx}_{uuid.uuid4().hex[:6]}"
                
                all_chunks.append({
                    "chunk_id": chunk_id,
                    "document_id": document_id,
                    "document_name": document_name,
                    "page_number": page_num,
                    "text": chunk_text,
                    "metadata": {
                        "document_id": str(document_id),
                        "document_name": str(document_name),
                        "page_number": int(page_num),
                        "session_id": str(session_id),
                        "chunk_index": int(global_chunk_idx),
                        "char_length": len(chunk_text)
                    }
                })
                global_chunk_idx += 1

        return all_chunks
