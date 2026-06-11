"""End-to-end pipeline test -- two-pass routing + grounded findings. Offline."""
from __future__ import annotations

import pytest

from app.analyzer import FakeAnalyzer
from app.embeddings import FakeEmbeddingProvider
from app.ingest import ingest
from app.orchestrator import analyze_topology
from app.retrieval import InMemoryChunkRepo
from app.topology import Component, Edge, Topology


@pytest.fixture
def pipeline():
    repo = InMemoryChunkRepo()
    embedder = FakeEmbeddingProvider()
    ingest(repo, embedder)
    return repo, embedder, FakeAnalyzer()


def _run(pipeline, topology):
    repo, embedder, analyzer = pipeline
    return analyze_topology(topology, repo, embedder, analyzer)


def _bad_architecture() -> Topology:
    return Topology(
        components=[
            Component(id="gw", service="apigateway"),
            Component(id="fn", service="lambda"),
            Component(id="ddb", service="dynamodb"),
            Component(id="db", service="rds"),
        ],
        edges=[Edge("gw", "fn"), Edge("fn", "ddb"), Edge("fn", "db")],
    )


def test_pipeline_produces_findings(pipeline):
    assert _run(pipeline, _bad_architecture())


def test_every_finding_is_grounded(pipeline):
    for f in _run(pipeline, _bad_architecture()):
        assert f.source_title and f.source_url


def test_dynamodb_item_size_surfaces_on_ddb(pipeline):
    findings = _run(pipeline, _bad_architecture())
    ddb = [f for f in findings if f.component_id == "ddb"]
    assert any("400 KB" in f.description for f in ddb)


def test_lambda_timeout_only_on_lambda_node(pipeline):
    """The core leak-fix assertion: single-service limits don't cross nodes."""
    findings = _run(pipeline, _bad_architecture())
    leaked = [
        f for f in findings
        if "Lambda Execution Timeout" in f.source_title and f.component_id != "fn"
    ]
    assert leaked == [], f"Lambda timeout leaked onto: {[f.component_id for f in leaked]}"


def test_findings_reference_real_components(pipeline):
    topology = _bad_architecture()
    valid = {c.id for c in topology.components}
    assert all(f.component_id in valid for f in _run(pipeline, topology))


def test_findings_sorted_by_severity(pipeline):
    rank = {"critical": 0, "warning": 1, "info": 2}
    ranks = [rank.get(f.severity, 3) for f in _run(pipeline, _bad_architecture())]
    assert ranks == sorted(ranks)


def test_no_duplicate_findings_per_component(pipeline):
    """Two-pass retrieval must not double-report the same chunk on a node."""
    findings = _run(pipeline, _bad_architecture())
    keys = [(f.component_id, f.source_title) for f in findings]
    assert len(keys) == len(set(keys))


def test_empty_topology(pipeline):
    assert _run(pipeline, Topology(components=[], edges=[])) == []
