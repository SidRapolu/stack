"""Ingestion: corpus JSON -> embed -> vector store.

Importable ingest() is used by tests with injected providers. The runnable
script form (scripts/ingest.py) wires the real Bedrock embedder + pgvector and
is what you run after fetching the corpus.
"""
from __future__ import annotations

import json
from pathlib import Path

from app.embeddings import EmbeddingProvider
from app.retrieval import Chunk, ChunkRepository

CORPUS_PATH = Path(__file__).resolve().parent.parent / "corpus" / "aws_constraints.json"


def load_corpus(path: Path = CORPUS_PATH) -> list[dict]:
    with open(path) as f:
        return json.load(f)


def ingest(
    repo: ChunkRepository,
    embedder: EmbeddingProvider,
    corpus: list[dict] | None = None,
    batch_size: int = 16,
) -> int:
    """Embed every corpus entry and load it into the repo. Returns count.

    Embeds the heading together with the body so the section topic is weighted.
    """
    entries = corpus if corpus is not None else load_corpus()
    texts = [f"{e['title']}. {e['content']}" for e in entries]

    chunks: list[Chunk] = []
    for start in range(0, len(entries), batch_size):
        batch = entries[start:start + batch_size]
        batch_texts = texts[start:start + batch_size]
        vectors = embedder.embed(batch_texts)
        for entry, vec in zip(batch, vectors):
            chunks.append(Chunk(
                service=entry["service"],
                category=entry["category"],
                title=entry["title"],
                content=entry["content"],
                source_url=entry["source_url"],
                embedding=vec,
            ))

    repo.add_many(chunks)
    return len(chunks)
