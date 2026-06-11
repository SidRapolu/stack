"""Retrieval layer -- pgvector is the primary store.

PgVectorChunkRepo is the real path: metadata pre-filter in SQL, cosine ranking
via the <=> operator, top-k. InMemoryChunkRepo remains for offline tests with
identical ranking semantics.
"""
from __future__ import annotations

import math
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class Chunk:
    service: str
    category: str
    title: str
    content: str
    source_url: str
    embedding: list[float]


@dataclass
class RetrievedChunk:
    title: str
    content: str
    service: str
    category: str
    source_url: str
    score: float  # cosine similarity in [-1, 1]; higher = closer


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return 0.0 if na == 0.0 or nb == 0.0 else dot / (na * nb)


class ChunkRepository(ABC):
    @abstractmethod
    def add(self, chunk: Chunk) -> None: ...

    @abstractmethod
    def add_many(self, chunks: list[Chunk]) -> int: ...

    @abstractmethod
    def count(self) -> int: ...

    @abstractmethod
    def clear(self) -> None: ...

    @abstractmethod
    def search(
        self,
        query_embedding: list[float],
        top_k: int,
        services: list[str] | None = None,
        categories: list[str] | None = None,
    ) -> list[RetrievedChunk]: ...


class PgVectorChunkRepo(ChunkRepository):
    """Primary store. psycopg3 + pgvector with the vector type registered."""

    def __init__(self, conn):
        self._conn = conn

    def add(self, chunk: Chunk) -> None:
        self.add_many([chunk])

    def add_many(self, chunks: list[Chunk]) -> int:
        with self._conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO doc_chunks
                    (service, category, title, content, source_url, embedding)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                [
                    (c.service, c.category, c.title, c.content, c.source_url, c.embedding)
                    for c in chunks
                ],
            )
        self._conn.commit()
        return len(chunks)

    def count(self) -> int:
        with self._conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM doc_chunks")
            return int(cur.fetchone()[0])

    def clear(self) -> None:
        with self._conn.cursor() as cur:
            cur.execute("TRUNCATE doc_chunks RESTART IDENTITY")
        self._conn.commit()

    def search(self, query_embedding, top_k, services=None, categories=None):
        where, params = [], []
        if services:
            where.append("service = ANY(%s)")
            params.append([s.lower() for s in services])
        if categories:
            where.append("category = ANY(%s)")
            params.append([c.lower() for c in categories])
        where_sql = ("WHERE " + " AND ".join(where)) if where else ""

        sql = f"""
            SELECT title, content, service, category, source_url,
                   1 - (embedding <=> %s) AS score
            FROM doc_chunks
            {where_sql}
            ORDER BY embedding <=> %s
            LIMIT %s
        """
        params = [query_embedding] + params + [query_embedding, top_k]
        with self._conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
        return [
            RetrievedChunk(
                title=r[0], content=r[1], service=r[2],
                category=r[3], source_url=r[4], score=float(r[5]),
            )
            for r in rows
        ]


class InMemoryChunkRepo(ChunkRepository):
    """Offline-test repo. Pure-Python cosine ranking, no DB."""

    def __init__(self):
        self._chunks: list[Chunk] = []

    def add(self, chunk: Chunk) -> None:
        self._chunks.append(chunk)

    def add_many(self, chunks: list[Chunk]) -> int:
        self._chunks.extend(chunks)
        return len(chunks)

    def count(self) -> int:
        return len(self._chunks)

    def clear(self) -> None:
        self._chunks = []

    def search(self, query_embedding, top_k, services=None, categories=None):
        candidates = self._chunks
        if services:
            svc = {s.lower() for s in services}
            candidates = [c for c in candidates if c.service.lower() in svc]
        if categories:
            cat = {c.lower() for c in categories}
            candidates = [c for c in candidates if c.category.lower() in cat]
        scored = [
            RetrievedChunk(
                title=c.title, content=c.content, service=c.service,
                category=c.category, source_url=c.source_url,
                score=_cosine_similarity(query_embedding, c.embedding),
            )
            for c in candidates
        ]
        scored.sort(key=lambda r: r.score, reverse=True)
        return scored[:top_k]
