"""Store factory -- selects the repo from config and owns its connection.

STORE=pgvector (default) opens a real connection, bootstraps the schema, and
returns PgVectorChunkRepo. STORE=memory returns the in-memory repo for tests.
This is the seam that ties the env flag to the actual storage backend.
"""
from __future__ import annotations

from app.config import STORE
from app.retrieval import ChunkRepository, InMemoryChunkRepo, PgVectorChunkRepo


def get_repository() -> tuple[ChunkRepository, object | None]:
    """Return (repo, connection). Connection is None for the in-memory store.

    Caller is responsible for closing the connection when done (the FastAPI
    lifespan and the ingest script both do).
    """
    if STORE == "memory":
        return InMemoryChunkRepo(), None

    from app.db import get_connection, init_schema

    conn = get_connection()
    init_schema(conn)
    return PgVectorChunkRepo(conn), conn
