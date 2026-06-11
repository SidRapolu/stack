"""Runnable ingest -- the command you run to populate pgvector.

  python -m scripts.ingest            # ingest corpus (appends)
  python -m scripts.ingest --reset    # clear table first, then ingest

Uses the real Bedrock embedder + pgvector by default (online-first config).
Set EMBEDDING_PROVIDER=fake / STORE=memory only for dry runs.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.embeddings import get_embedding_provider  # noqa: E402
from app.ingest import ingest, load_corpus         # noqa: E402
from app.store import get_repository               # noqa: E402


def main() -> None:
    reset = "--reset" in sys.argv

    corpus = load_corpus()
    print(f"Loaded {len(corpus)} corpus chunks.")

    embedder = get_embedding_provider()
    repo, conn = get_repository()
    try:
        if reset:
            print("Resetting doc_chunks table...")
            repo.clear()

        print(f"Embedding + inserting (provider={type(embedder).__name__})...")
        n = ingest(repo, embedder, corpus=corpus)
        total = repo.count()
        print(f"Ingested {n} chunks. Table now holds {total}.")
    finally:
        if conn is not None:
            conn.close()


if __name__ == "__main__":
    main()
