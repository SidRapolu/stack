"""Live AWS doc fetcher -- curated-list based.

Reads corpus/sources.py, fetches each page, section-chunks the main content by
heading, tags chunks with service/category/source_url, and writes
corpus/aws_constraints.json (the same format ingestion consumes).

Design choices:
  - Per-page failures are caught and logged, never fatal: one broken page
    doesn't lose the whole run. The last good corpus JSON is preserved unless
    at least one page succeeds.
  - Section-aware chunking (split on h2/h3) keeps chunks coherent, not
    fixed-size. Each chunk carries the heading as its title.
  - A polite delay between requests avoids hammering AWS docs.

Run:  python -m scripts.fetch_corpus
Then: python -m scripts.ingest   (embeds the fetched corpus into pgvector)

NOTE: AWS docs HTML structure changes over time. If extraction returns little,
adjust _extract_main() / the heading selectors. This is the expected
maintenance point of a live scraper.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "corpus"))

CORPUS_OUT = ROOT / "corpus" / "aws_constraints.json"
REQUEST_DELAY_SEC = 1.0
MIN_CHUNK_CHARS = 200      # drop trivially short sections
MAX_CHUNK_CHARS = 2000     # cap; longer sections are truncated at a sentence


def _fetch_html(url: str) -> str:
    import httpx
    headers = {"User-Agent": "stack-rag-corpus-fetcher/1.0 (architecture analysis tool)"}
    resp = httpx.get(url, headers=headers, follow_redirects=True, timeout=30.0)
    resp.raise_for_status()
    return resp.text


def _extract_main(html: str):
    """Return the main documentation content element, or the whole soup."""
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    # AWS docs main content is typically in <main> or #main-content.
    for selector in ("main", "#main-content", "#main-col-body", "article"):
        node = soup.select_one(selector)
        if node:
            return node
    return soup.body or soup


def _section_chunks(main) -> list[tuple[str, str]]:
    """Split content into (heading, text) sections by h2/h3 boundaries."""
    chunks: list[tuple[str, str]] = []
    current_title = "Overview"
    current_parts: list[str] = []

    for el in main.find_all(["h1", "h2", "h3", "p", "li", "td"]):
        name = el.name
        text = el.get_text(" ", strip=True)
        if not text:
            continue
        if name in ("h1", "h2", "h3"):
            if current_parts:
                chunks.append((current_title, " ".join(current_parts)))
                current_parts = []
            current_title = text
        else:
            current_parts.append(text)
    if current_parts:
        chunks.append((current_title, " ".join(current_parts)))
    return chunks


def _clean_chunk(text: str) -> str:
    text = " ".join(text.split())
    if len(text) > MAX_CHUNK_CHARS:
        cut = text[:MAX_CHUNK_CHARS]
        last = cut.rfind(". ")
        text = cut[: last + 1] if last > 0 else cut
    return text


def fetch_all() -> list[dict]:
    from sources import SOURCES

    out: list[dict] = []
    failures: list[tuple[str, str]] = []

    for entry in SOURCES:
        url = entry["url"]
        try:
            html = _fetch_html(url)
            main = _extract_main(html)
            sections = _section_chunks(main)
            kept = 0
            for title, body in sections:
                body = _clean_chunk(body)
                if len(body) < MIN_CHUNK_CHARS:
                    continue
                out.append({
                    "service": entry["service"],
                    "category": entry["category"],
                    "title": f"{entry['service'].upper()} — {title}",
                    "content": body,
                    "source_url": url,
                })
                kept += 1
            print(f"  ok    {entry['service']:12} {kept:3} chunks  {url}")
        except Exception as e:  # noqa: BLE001 -- per-page isolation is intentional
            failures.append((url, str(e)))
            print(f"  FAIL  {entry['service']:12} {url}\n        {e}")
        time.sleep(REQUEST_DELAY_SEC)

    if failures and not out:
        raise SystemExit(
            f"\nAll {len(failures)} sources failed; corpus NOT overwritten. "
            f"Check network and selectors."
        )
    return out


def main() -> None:
    print(f"Fetching corpus from curated sources...\n")
    chunks = fetch_all()
    CORPUS_OUT.write_text(json.dumps(chunks, indent=2))
    print(f"\nWrote {len(chunks)} chunks to {CORPUS_OUT.relative_to(ROOT)}")
    print("Next: python -m scripts.ingest")


if __name__ == "__main__":
    main()
