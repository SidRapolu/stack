"""Embedding providers -- Bedrock/Titan is the primary path.

get_embedding_provider() returns the real Titan provider by default. The fake
exists only for offline tests and must be explicitly selected. The Bedrock
provider includes retry-with-backoff on throttling, because Titan invoke is
per-text and a corpus ingest can issue thousands of calls.
"""
from __future__ import annotations

import hashlib
import math
import re
import time
from abc import ABC, abstractmethod

from app.config import (
    AWS_REGION,
    BEDROCK_EMBEDDING_MODEL,
    EMBEDDING_DIM,
    EMBEDDING_PROVIDER,
)

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _l2_normalize(vec: list[float]) -> list[float]:
    norm = math.sqrt(sum(x * x for x in vec))
    return vec if norm == 0.0 else [x / norm for x in vec]


class EmbeddingProvider(ABC):
    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]:
        ...

    def embed_one(self, text: str) -> list[float]:
        return self.embed([text])[0]


class BedrockEmbeddingProvider(EmbeddingProvider):
    """Amazon Titan Text Embeddings v2 via boto3 (1024-dim).

    Titan's invoke API embeds one text per call, so embed() loops. Throttling
    (ThrottlingException) is retried with exponential backoff -- important when
    ingesting a large corpus in one run.
    """

    def __init__(self, max_retries: int = 5):
        import boto3  # lazy: only needed on the real path
        self._client = boto3.client("bedrock-runtime", region_name=AWS_REGION)
        self._model = BEDROCK_EMBEDDING_MODEL
        self._max_retries = max_retries

    def _embed_one_remote(self, text: str) -> list[float]:
        import json
        from botocore.exceptions import ClientError

        attempt = 0
        while True:
            try:
                resp = self._client.invoke_model(
                    modelId=self._model,
                    body=json.dumps({"inputText": text}),
                )
                return json.loads(resp["body"].read())["embedding"]
            except ClientError as e:
                code = e.response.get("Error", {}).get("Code", "")
                if code in ("ThrottlingException", "TooManyRequestsException") and attempt < self._max_retries:
                    time.sleep(2 ** attempt)
                    attempt += 1
                    continue
                raise

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._embed_one_remote(t) for t in texts]


class FakeEmbeddingProvider(EmbeddingProvider):
    """Deterministic hashing embedding for OFFLINE TESTS ONLY.

    Shared tokens -> nearby vectors, so retrieval logic is testable without
    network. Not used in any real run.
    """

    def __init__(self, dim: int = EMBEDDING_DIM):
        self.dim = dim

    def _embed_text(self, text: str) -> list[float]:
        vec = [0.0] * self.dim
        for tok in _TOKEN_RE.findall(text.lower()):
            h = hashlib.sha1(tok.encode("utf-8")).digest()
            idx = int.from_bytes(h[:4], "big") % self.dim
            vec[idx] += 1.0 if h[4] & 1 else -1.0
        return _l2_normalize(vec)

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._embed_text(t) for t in texts]


def get_embedding_provider() -> EmbeddingProvider:
    if EMBEDDING_PROVIDER == "fake":
        return FakeEmbeddingProvider()
    return BedrockEmbeddingProvider()
