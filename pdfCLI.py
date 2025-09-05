# Run CMD (if loaded file json from jobs.json): python3 ctump.py --manifest jobs.json --concurrency 6 --segment-size 200
"""
CTUMP DocImage -> PDF (async HTTP/2, segmented, low-memory)

- Async downloads with httpx (HTTP/2), bounded concurrency.
- Segment-wise processing: only keep up to `segment_size` pages in RAM at once.
- img2pdf creates single-page PDFs directly from PNG/JPEG bytes (lossless where possible).
- pikepdf merges per-segment PDFs, final PDF is linearized ("Fast Web View").
- Robust retry with Retry-After + jittered exponential backoff.
- No mutable module-level globals; values are threaded through parameters.

Time complexity (per document with n pages):
  Network: O(n) requests
  CPU:     O(n) conversions + O(n) page appends
Space complexity:
  O(s) where s = segment_size pages (independent of n)
"""

import asyncio
import io
import json
import os
import random
import sys
import tempfile
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
from urllib.parse import parse_qs, urlencode, urlparse

# ---------- Lazy install dependencies (optional; remove if you manage deps yourself) ----------
def _ensure(pkgs: List[str]) -> None:
    import importlib, subprocess
    for p in pkgs:
        try:
            importlib.import_module(p.split("[")[0])
        except Exception:
            subprocess.check_call([sys.executable, "-m", "pip", "install", p])

_ensure(["httpx[http2]>=0.26", "img2pdf>=0.6.0", "pikepdf>=9.0"])

import httpx
import img2pdf
import pikepdf

# ---------- Defaults (can be overridden by CLI flags) ----------
DEFAULT_BASE_URL = "https://media.ctump.edu.vn/DocImage.axd"
DEFAULT_CONCURRENCY = 6        # polite concurrency
DEFAULT_SEGMENT_SIZE = 200     # pages per segment
CONNECT_TIMEOUT = 5.0
READ_TIMEOUT = 30.0
USER_AGENT = "CTUMP-Async-Scraper/3.1 (+httpx)"
RETRY_TOTAL = 6
BACKOFF_BASE = 0.5             # seconds
RETRIABLE_STATUSES = {429, 500, 502, 503, 504}


@dataclass
class DocumentSpec:
    token: str
    start_page: int
    end_page: int
    output_filename: str


# ---------- URL builder ----------
def build_page_url(base_url: str, page: int, token: str) -> str:
    parsed = urlparse(base_url)
    params = parse_qs(parsed.query)
    params.update({
        "page": [str(page)],
        "token": [token],
        "zoom": ["100"],
        "format": ["png"],
    })
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path}?{urlencode(params, doseq=True)}"


# ---------- Retry/backoff helpers ----------
def jittered_backoff(attempt: int) -> float:
    # Full jitter: random(0, base * 2^(attempt-1))
    return random.uniform(0.0, BACKOFF_BASE * (2 ** max(0, attempt - 1)))


# ---------- Networking ----------
async def fetch_page_png(client: httpx.AsyncClient, url: str) -> Optional[bytes]:
    last_exc: Optional[Exception] = None
    for attempt in range(1, RETRY_TOTAL + 1):
        try:
            resp = await client.get(url)  # timeout handled at client level
            if resp.status_code in RETRIABLE_STATUSES:
                ra_hdr = resp.headers.get("Retry-After")
                if ra_hdr:
                    try:
                        delay = float(ra_hdr)  # seconds if numeric
                    except ValueError:
                        delay = jittered_backoff(attempt)
                else:
                    delay = jittered_backoff(attempt)
                await asyncio.sleep(delay)
                continue

            resp.raise_for_status()
            return resp.content
        except (httpx.HTTPError, httpx.ReadError, httpx.ConnectError) as e:
            last_exc = e
            await asyncio.sleep(jittered_backoff(attempt))
    print(f"[WARN] Giving up after {RETRY_TOTAL} attempts: {url} ({last_exc})")
    return None


async def download_chunk_pngs(
    client: httpx.AsyncClient,
    base_url: str,
    token: str,
    start_page: int,
    end_page: int,
    concurrency: int,
) -> Dict[int, bytes]:
    """
    Download pages [start_page, end_page] with bounded concurrency.
    Returns {page_number: png_bytes or b"" on failure}.
    """
    sem = asyncio.Semaphore(concurrency)
    result: Dict[int, bytes] = {}

    async def worker(page: int) -> None:
        async with sem:
            url = build_page_url(base_url, page, token)
            data = await fetch_page_png(client, url)
            result[page] = data or b""

    await asyncio.gather(*(worker(p) for p in range(start_page, end_page + 1)))
    return result


# ---------- Conversion & assembly ----------
def page_png_to_pdf_bytes(png_bytes: bytes) -> Optional[bytes]:
    try:
        # img2pdf accepts raw bytes; produces a one-page PDF
        return img2pdf.convert(png_bytes)
    except Exception as e:
        print(f"[WARN] img2pdf conversion failed: {e}")
        return None


def assemble_segment(pages_png: List[Tuple[int, bytes]]) -> Optional[pikepdf.Pdf]:
    """
    Convert a list of (page_no, png_bytes) into a pikepdf.Pdf (keeping input order).
    Skips failed pages (empty bytes or conversion errors).
    """
    pdf = pikepdf.Pdf.new()
    ok = 0
    for pno, data in pages_png:
        if not data:
            print(f"[WARN] Page {pno}: missing; skipped.")
            continue
        one_pdf = page_png_to_pdf_bytes(data)
        if not one_pdf:
            print(f"[WARN] Page {pno}: conversion failed; skipped.")
            continue
        with pikepdf.open(io.BytesIO(one_pdf)) as one:
            pdf.pages.extend(one.pages)
            ok += 1
    return pdf if ok > 0 else None


def merge_segments(segment_paths: List[str], out_file: str) -> None:
    """
    Merge on-disk segment PDFs into final output (linearized for Fast Web View).
    """
    final = pikepdf.Pdf.new()
    for path in segment_paths:
        with pikepdf.open(path) as seg:
            final.pages.extend(seg.pages)
    final.save(out_file, linearize=True)


# ---------- Core pipeline per document ----------
async def scrape_doc_async(
    base_url: str,
    spec: DocumentSpec,
    concurrency: int,
    segment_size: int,
) -> bool:
    print(f"\n==> {spec.output_filename}: pages {spec.start_page}–{spec.end_page}")
    if os.path.exists(spec.output_filename):
        print(f"[INFO] Overwriting existing file: {spec.output_filename}")

    limits = httpx.Limits(
        max_connections=concurrency + 2,
        max_keepalive_connections=concurrency + 2,
    )
    client_timeout = httpx.Timeout(
        connect=CONNECT_TIMEOUT,
        read=READ_TIMEOUT,
        write=READ_TIMEOUT,
        pool=CONNECT_TIMEOUT,
    )

    async with httpx.AsyncClient(
        http2=True,
        headers={"User-Agent": USER_AGENT},
        limits=limits,
        timeout=client_timeout,
    ) as client:
        segments: List[str] = []
        total_pages = spec.end_page - spec.start_page + 1
        done_ok = 0
        done_fail = 0

        with tempfile.TemporaryDirectory() as tmpdir:
            # Process in segments to keep memory bounded
            current = spec.start_page
            seg_index = 0
            while current <= spec.end_page:
                seg_index += 1
                seg_start = current
                seg_end = min(seg_start + segment_size - 1, spec.end_page)
                print(f"[INFO] Segment {seg_index}: downloading pages {seg_start}–{seg_end} ...")

                pages_png = await download_chunk_pngs(
                    client, base_url, spec.token, seg_start, seg_end, concurrency
                )

                # Assemble in page order
                ordered = sorted(pages_png.items(), key=lambda kv: kv[0])
                segment_pdf = assemble_segment(ordered)
                ok_pages = sum(1 for _, b in ordered if b)
                fail_pages = (seg_end - seg_start + 1) - ok_pages
                done_ok += ok_pages
                done_fail += fail_pages

                if segment_pdf:
                    seg_path = os.path.join(tmpdir, f"segment_{seg_start}_{seg_end}.pdf")
                    segment_pdf.save(seg_path)
                    segments.append(seg_path)
                    print(f"[INFO] Segment {seg_index}: saved {seg_path}  ✓{ok_pages}  ✗{fail_pages}")
                else:
                    print(f"[WARN] Segment {seg_index}: no successful pages; skipped.")

                current = seg_end + 1

            if not segments:
                print("[ERROR] No pages succeeded; nothing to write.")
                return False

            print("[INFO] Merging segments and linearizing…")
            merge_segments(segments, spec.output_filename)

        print(f"[DONE] {spec.output_filename}  ✓{done_ok}  ✗{done_fail}  (total {total_pages})")
        return True


# ---------- CLI / interactive ----------
def parse_cli_or_prompt() -> Tuple[str, List[DocumentSpec], int, int]:
    """
    Return (base_url, docs, concurrency, segment_size).
    Supports --manifest JSON for batch runs; otherwise interactive prompts.
    """
    import argparse
    ap = argparse.ArgumentParser(description="CTUMP DocImage -> PDF (async)")
    ap.add_argument("--base-url", default=DEFAULT_BASE_URL, help="DocImage endpoint")
    ap.add_argument("--manifest", help="Path to JSON list: [{token,start_page,end_page,output_filename}, ...]")
    ap.add_argument("--concurrency", type=int, default=DEFAULT_CONCURRENCY, help="Max concurrent downloads")
    ap.add_argument("--segment-size", type=int, default=DEFAULT_SEGMENT_SIZE, help="Pages per segment (RAM bound)")
    args = ap.parse_args()

    # sanitize
    concurrency = max(1, int(args.concurrency))
    segment_size = max(20, int(args.segment_size))

    docs: List[DocumentSpec] = []
    if args.manifest:
        with open(args.manifest, "r", encoding="utf-8") as f:
            data = json.load(f)
        for i, d in enumerate(data, 1):
            name = str(d["output_filename"]).strip()
            if not name.lower().endswith(".pdf"):
                name += ".pdf"
            docs.append(DocumentSpec(
                token=str(d["token"]).strip(),
                start_page=int(d["start_page"]),
                end_page=int(d["end_page"]),
                output_filename=name,
            ))
        return args.base_url, docs, concurrency, segment_size

    # Interactive mode
    def _num(prompt: str) -> int:
        while True:
            try:
                v = int(input(prompt))
                if v <= 0:
                    raise ValueError()
                return v
            except ValueError:
                print("Please enter a positive integer.")

    n = _num("How many documents? ")
    for idx in range(1, n + 1):
        print(f"\n--- Document #{idx} ---")
        token = input("Token: ").strip()
        while True:
            s = _num("Start page: ")
            e = _num("End page: ")
            if e >= s:
                break
            print("End page must be >= start page.")
        name = input("Output filename (.pdf added if missing): ").strip()
        if not name.lower().endswith(".pdf"):
            name += ".pdf"
        docs.append(DocumentSpec(token=token, start_page=s, end_page=e, output_filename=name))

    return args.base_url, docs, concurrency, segment_size


async def main_async() -> None:
    base_url, docs, concurrency, segment_size = parse_cli_or_prompt()
    for i, spec in enumerate(docs, 1):
        await scrape_doc_async(base_url, spec, concurrency, segment_size)
        print("-" * 40)


if __name__ == "__main__":
    try:
        asyncio.run(main_async())
    except KeyboardInterrupt:
        print("\n[INTERRUPTED]")
