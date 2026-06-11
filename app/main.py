"""FastAPI service -- online-first wiring.

POST /analyze: Go sends a topology, gets structured findings grounded in the
pgvector-backed AWS doc corpus, analyzed by Claude on Bedrock.

The store connection and analyzer are created once at startup from config
(pgvector + Bedrock by default) and reused. No per-request ingest -- the corpus
is populated out-of-band by scripts/ingest.py. Go owns canvas truth; this
service owns analysis and returns citations in the payload.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from pydantic import BaseModel

from app.analyzer import finding_to_dict, get_analyzer
from app.config import ANALYZER, EMBEDDING_PROVIDER, STORE
from app.embeddings import get_embedding_provider
from app.orchestrator import analyze_topology
from app.store import get_repository
from app.topology import Component, Edge, Topology


class ComponentIn(BaseModel):
    id: str
    service: str
    label: str = ""
    config: dict = {}


class EdgeIn(BaseModel):
    source: str
    target: str


class AnalyzeRequest(BaseModel):
    components: list[ComponentIn]
    edges: list[EdgeIn] = []


class FindingOut(BaseModel):
    component_id: str
    severity: str
    finding_type: str
    description: str
    source_title: str
    source_url: str


class AnalyzeResponse(BaseModel):
    findings: list[FindingOut]


state: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    repo, conn = get_repository()
    state["repo"] = repo
    state["conn"] = conn
    state["embedder"] = get_embedding_provider()
    state["analyzer"] = get_analyzer()
    try:
        yield
    finally:
        if state.get("conn") is not None:
            state["conn"].close()
        state.clear()


app = FastAPI(title="Stack RAG Service", lifespan=lifespan)


@app.get("/health")
def health():
    repo = state.get("repo")
    chunk_count = repo.count() if repo is not None else None
    return {
        "status": "ok",
        "store": STORE,
        "embedding_provider": EMBEDDING_PROVIDER,
        "analyzer": ANALYZER,
        "corpus_chunks": chunk_count,
    }


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    topology = Topology(
        components=[
            Component(id=c.id, service=c.service.lower(), label=c.label, config=c.config)
            for c in req.components
        ],
        edges=[Edge(source=e.source, target=e.target) for e in req.edges],
    )
    findings = analyze_topology(
        topology, state["repo"], state["embedder"], state["analyzer"]
    )
    return AnalyzeResponse(findings=[FindingOut(**finding_to_dict(f)) for f in findings])
