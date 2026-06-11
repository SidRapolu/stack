"""Structured findings -- Bedrock/Claude is the primary analyzer.

The model is forced through the report_findings tool schema; it never returns
prose we parse. Every finding cites the doc chunk that grounds it. FakeAnalyzer
remains for offline tests only.
"""
from __future__ import annotations

import json
import time
from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass

from app.config import ANALYZER, AWS_REGION, BEDROCK_INFERENCE_MODEL
from app.retrieval import RetrievedChunk

FINDING_TOOL_SCHEMA = {
    "name": "report_findings",
    "description": "Report architectural findings for a component, each grounded in a provided documentation chunk.",
    "input_schema": {
        "type": "object",
        "properties": {
            "findings": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "severity": {"type": "string", "enum": ["info", "warning", "critical"]},
                        "finding_type": {"type": "string", "enum": ["conflict", "cascade", "gap"]},
                        "description": {"type": "string"},
                        "source_title": {"type": "string", "description": "Title of the doc chunk that grounds this finding."},
                    },
                    "required": ["severity", "finding_type", "description", "source_title"],
                },
            }
        },
        "required": ["findings"],
    },
}


@dataclass
class Finding:
    component_id: str
    severity: str
    finding_type: str
    description: str
    source_title: str
    source_url: str


class Analyzer(ABC):
    @abstractmethod
    def analyze(self, component_id: str, service: str, chunks: list[RetrievedChunk]) -> list[Finding]:
        ...


class BedrockAnalyzer(Analyzer):
    """Claude on Bedrock, forced through report_findings. Primary path."""

    def __init__(self, max_retries: int = 4):
        import boto3  # lazy
        self._client = boto3.client("bedrock-runtime", region_name=AWS_REGION)
        self._model = BEDROCK_INFERENCE_MODEL
        self._max_retries = max_retries

    def _invoke(self, body: dict) -> dict:
        from botocore.exceptions import ClientError

        attempt = 0
        while True:
            try:
                resp = self._client.invoke_model(
                    modelId=self._model, body=json.dumps(body)
                )
                return json.loads(resp["body"].read())
            except ClientError as e:
                code = e.response.get("Error", {}).get("Code", "")
                if code in ("ThrottlingException", "TooManyRequestsException") and attempt < self._max_retries:
                    time.sleep(2 ** attempt)
                    attempt += 1
                    continue
                raise

    def analyze(self, component_id, service, chunks):
        if not chunks:
            return []

        context = "\n\n".join(
            f"[{c.title}] (service={c.service}, category={c.category})\n{c.content}"
            for c in chunks
        )
        url_by_title = {c.title: c.source_url for c in chunks}

        system = (
            "You analyze cloud architecture components. You are given one component "
            "and AWS documentation chunks retrieved for it. Report only findings "
            "directly supported by a provided chunk, and only findings relevant to "
            "THIS component. Every finding must cite the title of the chunk that "
            "grounds it. Never invent limits or behaviors not present in the chunks. "
            "Use the report_findings tool."
        )
        user = (
            f"Component service: {service}\n\n"
            f"Retrieved documentation:\n{context}\n\n"
            "Report grounded findings for this component."
        )

        payload = self._invoke({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1024,
            "system": system,
            "messages": [{"role": "user", "content": user}],
            "tools": [FINDING_TOOL_SCHEMA],
            "tool_choice": {"type": "tool", "name": "report_findings"},
        })

        findings: list[Finding] = []
        for block in payload.get("content", []):
            if block.get("type") == "tool_use" and block.get("name") == "report_findings":
                for f in block["input"].get("findings", []):
                    findings.append(
                        Finding(
                            component_id=component_id,
                            severity=f["severity"],
                            finding_type=f["finding_type"],
                            description=f["description"],
                            source_title=f["source_title"],
                            source_url=url_by_title.get(f["source_title"], ""),
                        )
                    )
        return findings


class FakeAnalyzer(Analyzer):
    """Offline-test analyzer. Rule pass over retrieved chunks, no LLM."""

    def __init__(self, score_threshold: float = 0.05):
        # Threshold is a FAKE-PATH artifact only: the hash embedding produces
        # low absolute cosine scores, so the bar is low just to make offline
        # smoke tests representative. BedrockAnalyzer does not threshold on
        # score -- it judges relevance semantically over the retrieved chunks.
        self.score_threshold = score_threshold

    def analyze(self, component_id, service, chunks):
        findings: list[Finding] = []
        for ch in chunks:
            if ch.score < self.score_threshold:
                continue
            if ch.service.lower() != service.lower():
                continue  # only findings about THIS component's service
            if ch.category == "limit":
                sev, ftype = "warning", "conflict"
            elif ch.category == "best_practice":
                sev, ftype = "info", "gap"
            else:
                continue
            findings.append(
                Finding(
                    component_id=component_id, severity=sev, finding_type=ftype,
                    description=f"{ch.title}: {ch.content.split('.')[0]}.",
                    source_title=ch.title, source_url=ch.source_url,
                )
            )
        return findings[:3]


def get_analyzer() -> Analyzer:
    if ANALYZER == "fake":
        return FakeAnalyzer()
    return BedrockAnalyzer()


def finding_to_dict(f: Finding) -> dict:
    return asdict(f)
