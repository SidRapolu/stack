"""Retrieval-in-isolation proof gate. Offline: fake embeddings + in-memory repo."""
from __future__ import annotations

import pytest

from app.embeddings import FakeEmbeddingProvider
from app.ingest import ingest
from app.retrieval import InMemoryChunkRepo


@pytest.fixture
def seeded():
    repo = InMemoryChunkRepo()
    embedder = FakeEmbeddingProvider()
    assert ingest(repo, embedder) > 0
    return repo, embedder


def _top(repo, embedder, query, top_k=5, services=None, categories=None):
    qv = embedder.embed_one(query)
    return repo.search(qv, top_k=top_k, services=services, categories=categories)


def test_dynamodb_item_size_is_top_result(seeded):
    repo, embedder = seeded
    results = _top(repo, embedder, "DynamoDB item size maximum limit")
    assert results and "400 KB" in results[0].content
    assert results[0].service == "dynamodb"


def test_sqs_duplicate_delivery_retrieves_at_least_once(seeded):
    repo, embedder = seeded
    results = _top(repo, embedder, "SQS messages delivered twice duplicates ordering")
    assert results and results[0].service == "sqs"
    assert "at-least-once" in results[0].content.lower()


def test_lambda_long_running_retrieves_timeout(seeded):
    repo, embedder = seeded
    results = _top(repo, embedder, "Lambda function runs too long maximum duration timeout")
    assert any("15 minutes" in r.content for r in results[:3])


def test_service_prefilter_restricts(seeded):
    repo, embedder = seeded
    results = _top(repo, embedder, "limits and quotas", top_k=10, services=["dynamodb"])
    assert results and all(r.service == "dynamodb" for r in results)


def test_category_prefilter_restricts(seeded):
    repo, embedder = seeded
    results = _top(repo, embedder, "constraints", top_k=10, categories=["limit"])
    assert results and all(r.category == "limit" for r in results)


def test_integration_category_retrievable(seeded):
    """The two-pass design needs integration-category chunks to exist + filter."""
    repo, embedder = seeded
    results = _top(repo, embedder, "Lambda RDS connection exhaustion",
                   top_k=5, categories=["integration"])
    assert results and all(r.category == "integration" for r in results)


def test_scores_descending(seeded):
    repo, embedder = seeded
    results = _top(repo, embedder, "DynamoDB partition key hot partition")
    scores = [r.score for r in results]
    assert scores == sorted(scores, reverse=True)
