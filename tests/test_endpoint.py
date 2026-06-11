"""HTTP endpoint test -- drives the app via TestClient.

Forces the offline providers (memory store, fake embed/analyze) so the endpoint
can be exercised with no Postgres and no AWS. Set BEFORE importing app.main so
config picks them up. Skips cleanly if FastAPI isn't installed.
"""
from __future__ import annotations

import os

os.environ.setdefault("STORE", "memory")
os.environ.setdefault("EMBEDDING_PROVIDER", "fake")
os.environ.setdefault("ANALYZER", "fake")

import pytest

pytest.importorskip("fastapi", reason="fastapi not installed")
from fastapi.testclient import TestClient  # noqa: E402

# The in-memory store starts empty; seed it at import so /analyze has corpus.
from app.embeddings import get_embedding_provider  # noqa: E402
from app.ingest import ingest, load_corpus  # noqa: E402
from app.main import app, state  # noqa: E402


@pytest.fixture
def client():
    with TestClient(app) as c:
        # lifespan built an empty in-memory repo; seed it for the test.
        ingest(state["repo"], state["embedder"], corpus=load_corpus())
        yield c


def test_health_ok(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["store"] == "memory"
    assert body["corpus_chunks"] and body["corpus_chunks"] > 0


def test_analyze_returns_grounded_findings(client):
    payload = {
        "components": [
            {"id": "gw", "service": "apigateway"},
            {"id": "fn", "service": "lambda"},
            {"id": "ddb", "service": "dynamodb"},
            {"id": "db", "service": "rds"},
        ],
        "edges": [
            {"source": "gw", "target": "fn"},
            {"source": "fn", "target": "ddb"},
            {"source": "fn", "target": "db"},
        ],
    }
    resp = client.post("/analyze", json=payload)
    assert resp.status_code == 200
    findings = resp.json()["findings"]
    assert findings
    for f in findings:
        assert f["source_title"] and f["source_url"]
        assert f["component_id"] in {"gw", "fn", "ddb", "db"}
    # leak fix holds over HTTP too
    assert not [
        f for f in findings
        if "Lambda Execution Timeout" in f["source_title"] and f["component_id"] != "fn"
    ]


def test_analyze_empty_canvas(client):
    resp = client.post("/analyze", json={"components": [], "edges": []})
    assert resp.status_code == 200 and resp.json()["findings"] == []


def test_analyze_rejects_malformed(client):
    resp = client.post("/analyze", json={"components": [{"label": "no id"}]})
    assert resp.status_code == 422
