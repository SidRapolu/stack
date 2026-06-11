# Stack — RAG Analysis Service

The Python service behind Stack. A Claude agent reasons over a system-design
topology grounded in retrieved AWS documentation, returning **structured,
doc-cited findings**: conflicts and likely failure cascades, flagged per
component as the design is built.

This build is **online-first**. The default code paths target real services
(Bedrock + pgvector). Getting it running is filling in two things and running
two commands — see **Connect** below.

## Connect (the entire surface you touch)

1. **Postgres with pgvector.** Either run the bundled local one:
   ```bash
   docker compose up -d        # Postgres + pgvector on :5432
   ```
   …or point at a hosted instance (RDS / Supabase / Neon).

2. **Credentials.** Copy `.env.example` → `.env` and set:
   - `DATABASE_URL` — your Postgres connection string
   - `AWS_REGION` — a region where the Bedrock models are enabled
   - AWS creds via the standard boto3 chain (env / `~/.aws` / role)

3. **Install + populate + serve:**
   ```bash
   pip install -r requirements.txt
   python -m scripts.fetch_corpus     # scrape curated AWS docs -> corpus JSON
   python -m scripts.ingest --reset   # embed (Titan) -> load pgvector
   uvicorn app.main:app --reload      # serves /health and /analyze
   ```

`GET /health` reports the live corpus chunk count so you can confirm ingestion
worked. That's it — no code changes required to go live.

## Architecture

Two services, one Postgres instance, ownership follows the write path:

- **Go service** (separate repo) — owns canvases, snapshots, persistence. The
  system of record. Calls `POST /analyze`.
- **Python service** (this repo) — owns the `doc_chunks` vector table and all
  retrieval + inference. Go never reads or writes `doc_chunks`; it receives
  chunk citations in the `/analyze` response instead.

The vector table is **derived data**, rebuildable from the AWS docs. Losing it
loses analysis, not user data.

## Pipeline

```
sources.py (curated URLs)
  → fetch_corpus.py   (scrape + section-chunk -> corpus JSON)
  → ingest.py         (Titan embed -> pgvector)

POST /analyze topology
  → per-component queries (two passes: self + integration)
  → Titan embed
  → pgvector retrieval (metadata pre-filter, then cosine rank)
  → Claude on Bedrock (tool-use enforced findings schema)
  → findings + citations
```

### Two-pass per-component retrieval

Each component yields two filtered queries:
- **self** — filtered to the component's own service, categories limit /
  best_practice. Catches single-service limits (e.g. Lambda's 15-min timeout)
  and attaches them **only** to that node.
- **integration** — filtered to the component + its neighbors, category
  integration. Catches cross-edge concerns (e.g. Lambda→RDS connection
  exhaustion).

This split fixes single-service limits leaking onto neighbor nodes. Findings
are deduped per (component, source) and severity-ordered for the UI.

## The file you maintain

`corpus/sources.py` — the curated list of AWS doc URLs. Add a `{service,
category, url}` entry to cover a new service, re-run the fetcher. Choose
constraint-bearing pages (quotas/limits/best-practices), not overviews —
corpus quality is the ceiling on retrieval quality.

## Provider switches (default = online)

| env | default | offline value |
|-----|---------|---------------|
| `EMBEDDING_PROVIDER` | `bedrock` | `fake` |
| `STORE` | `pgvector` | `memory` |
| `ANALYZER` | `bedrock` | `fake` |

The offline values back the test suite (no DB, no AWS). They are not used in any
real run.

## Tests

```bash
pip install -r requirements.txt
pytest                  # pythonpath/testpaths configured in pyproject.toml
```

- `test_retrieval.py` — proof gate: retrieval ranks the right chunk top-1,
  pre-filters restrict correctly, integration category is retrievable.
- `test_pipeline.py` — full chain; includes the leak-fix assertion (single-
  service limits stay on their node) and the dedup assertion.
- `test_endpoint.py` — `/health` + `/analyze` over HTTP (offline providers).

## Layout

```
app/
  config.py        online-first config; provider/store/analyzer selection
  embeddings.py    Titan (primary, retry/backoff) + fake
  db.py            psycopg3 connection + pgvector registration + schema bootstrap
  store.py         config-driven repo factory (pgvector | memory)
  retrieval.py     ChunkRepository: pgvector (primary) + in-memory
  schema.sql       doc_chunks table + HNSW index
  ingest.py        corpus -> embed -> store (importable)
  topology.py      canvas -> two-pass per-component queries
  analyzer.py      Finding schema + Bedrock tool-use (primary) + fake
  orchestrator.py  ties pipeline into analyze_topology(), dedupes
  main.py          FastAPI: /health, /analyze
corpus/
  sources.py             curated AWS doc URLs (you maintain)
  aws_constraints.json   fetched/curated corpus (generated)
scripts/
  fetch_corpus.py        live scraper: sources -> corpus JSON
  ingest.py              runnable: corpus -> pgvector (--reset to clear)
tests/
docker-compose.yml       local Postgres + pgvector
.env.example             the connect surface
pyproject.toml           pytest config (pythonpath)
```

## Known maintenance point

The live fetcher depends on AWS docs HTML structure, which changes. If
`fetch_corpus.py` returns few chunks for a page, adjust the selectors in
`_extract_main()` / `_section_chunks()`. The curated `aws_constraints.json`
ships populated so the pipeline works even before the first scrape.
