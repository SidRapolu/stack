-- Schema for the vector table the Python service OWNS.
-- Lives in the same Postgres instance as the Go service's canvases/snapshots,
-- but Go never reads or writes this table. Ownership follows the write path.
--
-- This table is DERIVED DATA: fully rebuildable from the source AWS docs by
-- re-running ingestion. It is not truth. That's why losing it loses analysis,
-- not user data -- the clean failure-domain boundary.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS doc_chunks (
    id           BIGSERIAL PRIMARY KEY,

    -- Metadata used for PRE-FILTERING before vector search. A query about a
    -- DynamoDB node filters to service='dynamodb' first, then ranks by vector
    -- similarity within that slice. Hybrid retrieval: structured filter
    -- narrows, vector similarity ranks.
    service      TEXT NOT NULL,          -- e.g. 'dynamodb', 'sqs', 'lambda'
    category     TEXT NOT NULL,          -- 'limit' | 'best_practice' | 'integration' | 'pricing'
    title        TEXT NOT NULL,          -- section heading, e.g. 'DynamoDB Item Size Limit'
    content      TEXT NOT NULL,          -- the chunk text itself
    source_url   TEXT NOT NULL,          -- provenance, surfaced in findings as citation

    -- Dimension is hard-coded to the embedding model (Titan v2 = 1024).
    -- Changing the model means a migration + full re-embed.
    embedding    vector(1024) NOT NULL,

    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pre-filter columns: btree indexes so service/category filtering is cheap.
CREATE INDEX IF NOT EXISTS idx_doc_chunks_service  ON doc_chunks (service);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_category ON doc_chunks (category);

-- HNSW index for cosine distance. Excellent up to millions of vectors; our
-- corpus is tens of thousands of chunks at most, comfortably inside the
-- regime where pgvector beats reaching for a dedicated vector DB.
CREATE INDEX IF NOT EXISTS idx_doc_chunks_embedding
    ON doc_chunks
    USING hnsw (embedding vector_cosine_ops);
