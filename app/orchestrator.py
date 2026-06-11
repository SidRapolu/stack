"""Orchestrator: topology -> two-pass retrieval -> findings, deduped.

Each component yields a self query and (if connected) an integration query.
We retrieve per query with its filters, analyze, then dedupe findings by
(component_id, source_title) so a chunk surfacing in both passes yields one
finding. Output is severity-ordered for the UI rail.
"""
from __future__ import annotations

from app.analyzer import Analyzer, Finding
from app.config import RETRIEVAL_TOP_K
from app.embeddings import EmbeddingProvider
from app.retrieval import ChunkRepository
from app.topology import Topology, build_queries


def analyze_topology(
    topology: Topology,
    repo: ChunkRepository,
    embedder: EmbeddingProvider,
    analyzer: Analyzer,
    top_k: int = RETRIEVAL_TOP_K,
) -> list[Finding]:
    seen: set[tuple[str, str]] = set()
    merged: list[Finding] = []

    for q in build_queries(topology):
        qv = embedder.embed_one(q.query_text)
        chunks = repo.search(
            qv,
            top_k=top_k,
            services=q.filter_services,
            categories=q.filter_categories,
        )
        for f in analyzer.analyze(q.component_id, q.service, chunks):
            key = (f.component_id, f.source_title)
            if key in seen:
                continue
            seen.add(key)
            merged.append(f)

    sev_rank = {"critical": 0, "warning": 1, "info": 2}
    merged.sort(key=lambda f: sev_rank.get(f.severity, 3))
    return merged
