"""Postgres connection + pgvector registration.

Owns the connection lifecycle for the doc_chunks table. Uses psycopg3. The
pgvector extension and the doc_chunks schema are bootstrapped by init_schema(),
so a fresh database becomes ready with one call (the ingest script runs it).
"""
from __future__ import annotations

from pathlib import Path

from app.config import require_database_url

_SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"


def get_connection():
    """Open a psycopg3 connection with the pgvector type registered.

    pgvector's psycopg adapter lets us pass Python lists straight into a
    vector() column and read them back as lists.
    """
    import psycopg
    from pgvector.psycopg import register_vector

    conn = psycopg.connect(require_database_url())
    # Ensure the extension exists before registering the type adapter.
    with conn.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
    conn.commit()
    register_vector(conn)
    return conn


def init_schema(conn) -> None:
    """Create the doc_chunks table + indexes if absent. Idempotent."""
    sql = _SCHEMA_PATH.read_text()
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()
