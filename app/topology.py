"""Canvas topology -> per-component retrieval queries.

Each component becomes its own query. The refinement over the first cut:
retrieval is split into two filtered passes per component so single-service
limits don't leak onto neighbors:

  - SELF pass:        filter to the component's OWN service. Catches limits
                      and best-practices that belong to this node alone
                      (e.g. Lambda's 15-min timeout on the Lambda node).
  - INTEGRATION pass: filter to category='integration' across this component
                      AND its neighbors. Catches cross-edge concerns
                      (e.g. Lambda->RDS connection exhaustion) and attaches
                      them to the edge's endpoints.

The orchestrator runs both and merges, so a finding only appears on a node when
it's genuinely about that node or an edge it participates in.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Component:
    id: str
    service: str
    label: str = ""
    config: dict = field(default_factory=dict)


@dataclass
class Edge:
    source: str
    target: str


@dataclass
class Topology:
    components: list[Component]
    edges: list[Edge]

    def neighbors(self, component_id: str) -> list[Component]:
        by_id = {c.id: c for c in self.components}
        ids: set[str] = set()
        for e in self.edges:
            if e.source == component_id and e.target in by_id:
                ids.add(e.target)
            if e.target == component_id and e.source in by_id:
                ids.add(e.source)
        return [by_id[i] for i in ids]


@dataclass
class ComponentQuery:
    component_id: str
    service: str
    query_text: str
    filter_services: list[str]
    filter_categories: list[str] | None  # None = no category restriction


def build_queries(topology: Topology) -> list[ComponentQuery]:
    """Two queries per component: a self pass and an integration pass."""
    queries: list[ComponentQuery] = []

    for comp in topology.components:
        neighbors = topology.neighbors(comp.id)
        neighbor_services = sorted({n.service for n in neighbors})

        # --- SELF pass: this service's own limits/best-practices -------------
        self_parts = [comp.service]
        if comp.label:
            self_parts.append(comp.label)
        if comp.config:
            self_parts.append(" ".join(f"{k} {v}" for k, v in comp.config.items()))
        self_parts.append("limits quotas constraints best practices")
        queries.append(
            ComponentQuery(
                component_id=comp.id,
                service=comp.service,
                query_text=" ".join(self_parts),
                filter_services=[comp.service],          # OWN service only
                filter_categories=["limit", "best_practice"],
            )
        )

        # --- INTEGRATION pass: cross-edge concerns ---------------------------
        if neighbor_services:
            int_parts = [comp.service, "integration with", ", ".join(neighbor_services)]
            int_parts.append("failure cascade connection throughput")
            queries.append(
                ComponentQuery(
                    component_id=comp.id,
                    service=comp.service,
                    query_text=" ".join(int_parts),
                    filter_services=sorted({comp.service, *neighbor_services}),
                    filter_categories=["integration", "best_practice"],
                )
            )

    return queries
