import os
import io
import base64
from typing import List, Dict, Any
import openai
import pdfplumber
import docx
import numpy as np
openai.api_key = os.getenv("OPENAI_API_KEY")
client = openai.AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
class MedicalRAGPipeline:
    def __init__(self):
        self.vector_store: List[Dict[str, Any]] = []
        self.uploaded_files: List[str] = []
    async def process_file(self, contents: bytes, filename: str, content_type: str) -> Dict:
        text = ""
        if content_type == "application/pdf":
            text = self._extract_pdf(contents)
        elif content_type in ["image/jpeg", "image/png", "image/webp", "image/gif"]:
            text = await self._extract_image(contents, content_type)
        elif content_type in [
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ]:
            text = self._extract_docx(contents)
        if not text.strip():
            raise ValueError("Could not extract any text from this file.")
        chunks = self._chunk_text(text, filename)
        for chunk in chunks:
            embedding = await self._embed(chunk["text"])
            self.vector_store.append({
                "text": chunk["text"],
                "embedding": embedding,
                "source": filename,
            })
        self.uploaded_files.append(filename)
        return {"chunks": len(chunks)}
    def _extract_pdf(self, contents: bytes) -> str:
        text = ""
        with pdfplumber.open(io.BytesIO(contents)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
                for table in page.extract_tables():
                    for row in table:
                        row_text = " | ".join([cell.strip() for cell in row if cell and cell.strip()])
                        if row_text:
                            text += row_text + "\n"
        return text
    async def _extract_image(self, contents: bytes, content_type: str) -> str:
        b64 = base64.b64encode(contents).decode("utf-8")
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{content_type};base64,{b64}",
                                "detail": "high",
                            },
                        },
                        {
                            "type": "text",
                            "text": (
                                "This is a medical document or report image. "
                                "Please extract ALL text and medical information from it in detail. "
                                "Include all values, test results, diagnoses, medications, dates, and any other information visible."
                            ),
                        },
                    ],
                }
            ],
            max_tokens=2000,
        )
        return response.choices[0].message.content
    def _extract_docx(self, contents: bytes) -> str:
        doc = docx.Document(io.BytesIO(contents))
        return "\n".join([para.text for para in doc.paragraphs if para.text.strip()])
    def _chunk_text(self, text: str, source: str, chunk_size: int = 500, overlap: int = 100) -> List[Dict]:
        words = text.split()
        chunks = []
        i = 0
        while i < len(words):
            chunk_words = words[i: i + chunk_size]
            chunk_text = " ".join(chunk_words)
            chunks.append({"text": chunk_text, "source": source})
            i += chunk_size - overlap
        return chunks
    async def _embed(self, text: str) -> List[float]:
        response = await client.embeddings.create(
            model="text-embedding-3-small",
            input=text,
        )
        return response.data[0].embedding
    def _cosine_similarity(self, a: List[float], b: List[float]) -> float:
        a, b = np.array(a), np.array(b)
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-10))
    async def _retrieve(self, query: str, top_k: int = 5) -> List[str]:
        if not self.vector_store:
            return []
        query_embedding = await self._embed(query)
        scored = [
            (self._cosine_similarity(query_embedding, item["embedding"]), item["text"], item["source"])
            for item in self.vector_store
        ]
        scored.sort(key=lambda x: x[0], reverse=True)
        return [f"[Source: {s}]\n{t}" for _, t, s in scored[:top_k]]
    async def answer(self, question: str, history: List[Dict]) -> str:
        context_chunks = await self._retrieve(question, top_k=5)
        context = "\n\n---\n\n".join(context_chunks) if context_chunks else ""
        system_prompt = """You are a highly knowledgeable and empathetic medical assistant AI.
Your role is to help patients understand their medical reports, conditions, symptoms, and treatment options.

Guidelines:
- Explain medical terms in simple, easy-to-understand language
- When analyzing reports, go through each value/result and explain what it means
- For diseases or conditions, explain: what it is, causes, symptoms, diagnosis, and treatment options
- Always be thorough, detailed, and compassionate
- Flag any critical or abnormal values clearly
- Always recommend consulting a doctor for final medical decisions
- Use clear formatting with sections when explaining complex topics
- If context from uploaded reports is available, reference it specifically
IMPORTANT: You are strictly a medical assistant. If the user asks anything unrelated to medicine, 
health, diseases, symptoms, medications, or medical reports (such as programming, coding, math, 
general knowledge, etc.), respond with exactly:
"I'm sorry, I can only assist with medical-related questions such as analyzing reports, 
understanding symptoms, diseases, medications, and general health guidance. 
Please consult a relevant expert for other topics."
{context_section}"""
        if context:
            context_section = f"The following context has been extracted from the patient's uploaded medical documents:\n\n{context}"
        else:
            context_section = "No medical documents have been uploaded yet. Answer based on general medical knowledge."
        system_prompt = system_prompt.replace("{context_section}", context_section)
        messages = [{"role": "system", "content": system_prompt}]
        for msg in history[-10:]:
            messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": question})
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_tokens=1500,
            temperature=0.3,
        )
        return response.choices[0].message.content
    def clear(self):
        self.vector_store = []
        self.uploaded_files = []