#!/usr/bin/env python3
"""
CTUMP DocImage -> PDF (Flask Web UI, Async, Auto-Detect Token)

- Flask web interface with single file and HTML rendering
- Browser can patch to backend to serve PDFs
- Async HTTP/2 downloads (httpx), bounded concurrency
- Segment-wise assembly to keep RAM flat
- img2pdf one-page PDFs (often lossless for PNG/JPEG)
- pikepdf merge + linearize (Fast Web View)
- Robust retries with Retry-After + jitter backoff
- "Add Document" dialog supports pasting viewer URL and auto-detecting token
- Automatic cache clearing after processing completion

Run:
  python ctsample.py
  Then open http://localhost:5000 in your browser
"""

import asyncio
import io
import json
import os
import random
import sys
import tempfile
import threading
import queue
import re
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Tuple, Callable
from urllib.parse import parse_qs, urlencode, urlparse, urljoin
from datetime import datetime

# ------------------------- Web Framework (Flask) -------------------------
from flask import Flask, render_template_string, request, jsonify, send_file, redirect, url_for

# --------------------- Optional auto-install of deps --------------------
def _ensure(pkgs: List[str]) -> None:
    import importlib, subprocess
    for p in pkgs:
        try:
            importlib.import_module(p.split("[")[0])
        except Exception:
            subprocess.check_call([sys.executable, "-m", "pip", "install", p])

# Install third-party deps if missing
_ensure(["httpx[http2]>=0.26", "img2pdf>=0.6.0", "pikepdf>=9.0", "flask>=2.0.0"])

import httpx
import img2pdf
import pikepdf

# ----------------------------- Defaults ---------------------------------
DEFAULT_BASE_URL = "https://media.ctump.edu.vn/DocImage.axd"
DEFAULT_CONCURRENCY = 6
DEFAULT_SEGMENT_SIZE = 200
CONNECT_TIMEOUT = 5.0
READ_TIMEOUT = 30.0
USER_AGENT = "CTUMP-Async-Scraper/GUI-1.2 (+httpx)"
RETRY_TOTAL = 6
BACKOFF_BASE = 0.5  # seconds
RETRIABLE_STATUSES = {429, 500, 502, 503, 504}

# ----------------------------- Web App State ----------------------------
app = Flask(__name__)
app.secret_key = os.urandom(24)

# Global state for the web app
app_state = {
    "docs": [],
    "logs": [],
    "progress": {"current": 0, "total": 0, "segment": "-"},
    "is_running": False,
    "cancel_event": threading.Event(),
    "output_files": {}  # Map filename -> full path
}

# ----------------------------- Regex ------------------------------------
TOKEN_RE = re.compile(r"token\s*=\s*['\"]([0-9a-fA-F-]{36})['\"]")
UUID_RE  = re.compile(r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b")

# ----------------------------- Datatypes --------------------------------
@dataclass
class DocumentSpec:
    token: str
    start_page: int
    end_page: int
    output_filename: str

# --------------------------- Scraper Core -------------------------------
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

def jittered_backoff(attempt: int) -> float:
    # full-jitter backoff
    return random.uniform(0.0, BACKOFF_BASE * (2 ** max(0, attempt - 1)))

async def fetch_page_png(client: httpx.AsyncClient, url: str, cancel_ev: threading.Event) -> Optional[bytes]:
    if cancel_ev.is_set():
        return None
    last_exc: Optional[Exception] = None
    for attempt in range(1, RETRY_TOTAL + 1):
        if cancel_ev.is_set():
            return None
        try:
            resp = await client.get(url)  # timeout handled at client level
            if resp.status_code in RETRIABLE_STATUSES:
                ra_hdr = resp.headers.get("Retry-After")
                if ra_hdr:
                    try:
                        delay = float(ra_hdr)
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
    return None

async def download_chunk_pngs(
    client: httpx.AsyncClient,
    base_url: str,
    token: str,
    start_page: int,
    end_page: int,
    concurrency: int,
    cancel_ev: threading.Event,
    on_page_done: Optional[Callable[[int, bool], None]] = None,
) -> Dict[int, bytes]:
    """
    Download pages [start_page, end_page] with bounded concurrency.
    Returns {page_number: png_bytes or b"" on failure}.
    """
    sem = asyncio.Semaphore(concurrency)
    result: Dict[int, bytes] = {}

    async def worker(page: int) -> None:
        if cancel_ev.is_set():
            result[page] = b""
            return
        async with sem:
            url = build_page_url(base_url, page, token)
            data = await fetch_page_png(client, url, cancel_ev)
            ok = data is not None
            result[page] = data if ok else b""
            if on_page_done:
                on_page_done(page, ok)

    await asyncio.gather(*(worker(p) for p in range(start_page, end_page + 1)))
    return result

def page_png_to_pdf_bytes(png_bytes: bytes) -> Optional[bytes]:
    try:
        return img2pdf.convert(png_bytes)
    except Exception:
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
            continue
        one_pdf = page_png_to_pdf_bytes(data)
        if not one_pdf:
            continue
        with pikepdf.open(io.BytesIO(one_pdf)) as one:
            pdf.pages.extend(one.pages)
            ok += 1
    return pdf if ok > 0 else None

def merge_segments(segment_paths: List[str], out_file: str) -> None:
    final = pikepdf.Pdf.new()
    for path in segment_paths:
        with pikepdf.open(path) as seg:
            final.pages.extend(seg.pages)
    final.save(out_file, linearize=True)

def clear_cache_automatic() -> None:
    """
    Automatically clear temporary cache and files after processing is complete.
    This helps free up disk space and maintain system performance.
    """
    import shutil
    import tempfile
    
    try:
        # Clear temporary directory contents
        temp_dir = tempfile.gettempdir()
        temp_files = []
        
        # Look for temporary files that might be related to our processing
        for root, dirs, files in os.walk(temp_dir):
            for file in files:
                if file.startswith('segment_') and file.endswith('.pdf'):
                    temp_files.append(os.path.join(root, file))
                elif file.startswith('tmp') and file.endswith('.pdf'):
                    temp_files.append(os.path.join(root, file))
        
        # Remove temporary files
        for temp_file in temp_files:
            try:
                if os.path.exists(temp_file):
                    os.remove(temp_file)
            except Exception:
                pass  # Ignore errors when removing temp files
        
        # Clear Python cache if it exists
        try:
            import __pycache__
            cache_dir = os.path.join(os.path.dirname(__file__), '__pycache__')
            if os.path.exists(cache_dir):
                shutil.rmtree(cache_dir, ignore_errors=True)
        except Exception:
            pass
            
    except Exception:
        pass  # Fail silently to not interrupt the main process

# -------- Token extractor (sync; used in GUI thread via worker thread) ---
def extract_token_from_viewer_sync(viewer_url: str) -> Optional[str]:
    """
    Fetch viewer page and try to extract: token = '...';
    If not found, fetch up to ~20 <script src="..."> files and search there too.
    Returns token string or None.
    """
    try:
        timeout = httpx.Timeout(
            connect=CONNECT_TIMEOUT,
            read=READ_TIMEOUT,
            write=READ_TIMEOUT,
            pool=CONNECT_TIMEOUT,
        )
        headers = {"User-Agent": USER_AGENT}
        with httpx.Client(headers=headers, timeout=timeout, follow_redirects=True) as c:
            r = c.get(viewer_url)
            r.raise_for_status()
            text = r.text

            m = TOKEN_RE.search(text)
            if m:
                return m.group(1)

            # Try raw UUID as fallback if variable assignment not present
            m2 = UUID_RE.search(text)
            if m2:
                return m2.group(0)

            # Scan external scripts
            scripts = re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', text, flags=re.I)
            base_url = str(r.url)
            for src in scripts[:20]:  # cap to be polite
                try:
                    u = urljoin(base_url, src)
                    rs = c.get(u)
                    rs.raise_for_status()
                    ms = TOKEN_RE.search(rs.text) or UUID_RE.search(rs.text)
                    if ms:
                        return ms.group(1) if ms.re is TOKEN_RE else ms.group(0)
                except Exception:
                    continue
    except Exception:
        return None
    return None

# ---------- Core pipeline per document ----------
async def scrape_doc_async(
    base_url: str,
    spec: DocumentSpec,
    concurrency: int,
    segment_size: int,
    cancel_ev: threading.Event,
    log: Callable[[str], None],
    on_overall_progress: Callable[[int, int], None],
    on_segment: Callable[[int, int], None],
) -> bool:
    # Setup HTTP/2 client with full timeout configuration at client-level
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

    total_pages = spec.end_page - spec.start_page + 1
    pages_done = 0

    def page_done_cb(page_no: int, ok: bool):
        nonlocal pages_done
        pages_done += 1
        on_overall_progress(pages_done, total_pages)

    async with httpx.AsyncClient(
        http2=True,
        headers={"User-Agent": USER_AGENT},
        limits=limits,
        timeout=client_timeout,
    ) as client:
        segments: List[str] = []
        with tempfile.TemporaryDirectory() as tmpdir:
            current = spec.start_page
            seg_index = 0
            while current <= spec.end_page:
                if cancel_ev.is_set():
                    log(f"[WARN] Cancelled: {spec.output_filename}")
                    return False

                seg_index += 1
                seg_start = current
                seg_end = min(seg_start + segment_size - 1, spec.end_page)
                on_segment(seg_start, seg_end)
                log(f"[INFO] Segment {seg_index}: downloading {seg_start}–{seg_end}")

                pages_png = await download_chunk_pngs(
                    client, base_url, spec.token,
                    seg_start, seg_end, concurrency,
                    cancel_ev,
                    on_page_done=page_done_cb
                )
                if cancel_ev.is_set():
                    log(f"[WARN] Cancelled: {spec.output_filename}")
                    return False

                ordered = sorted(pages_png.items(), key=lambda kv: kv[0])
                segment_pdf = assemble_segment(ordered)
                ok_pages = sum(1 for _, b in ordered if b)
                fail_pages = (seg_end - seg_start + 1) - ok_pages

                if segment_pdf:
                    seg_path = os.path.join(tmpdir, f"segment_{seg_start}_{seg_end}.pdf")
                    segment_pdf.save(seg_path)
                    segments.append(seg_path)
                    log(f"[INFO] Segment {seg_index}: ✓{ok_pages}  ✗{fail_pages}  -> {seg_path}")
                else:
                    log(f"[WARN] Segment {seg_index}: no successful pages; skipped.")

                current = seg_end + 1

            if not segments:
                log("[ERROR] No pages succeeded; nothing to write.")
                return False

            log("[INFO] Merging segments and linearizing…")
            try:
                merge_segments(segments, spec.output_filename)
            except Exception as e:
                log(f"[ERROR] Merge failed: {e}")
                return False

        log(f"[DONE] Wrote {spec.output_filename}")
        return True


# ------------------------------ Flask Routes ----------------------------
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CTUMP PDF Tool</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #000; 
            color: #fff; 
            padding: 20px;
            line-height: 1.6;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
        }
        h1 { 
            color: #fff; 
            margin-bottom: 30px; 
            font-size: 2em;
        }
        .card { 
            background: #1a1a1a; 
            border-radius: 8px; 
            padding: 20px; 
            margin-bottom: 20px;
            border: 1px solid #333;
        }
        .form-group { 
            margin-bottom: 15px; 
        }
        label { 
            display: block; 
            margin-bottom: 5px; 
            color: #b3b3b3;
            font-weight: 500;
        }
        input, select { 
            width: 100%; 
            padding: 10px; 
            background: #0d0d0d; 
            border: 1px solid #333; 
            color: #fff; 
            border-radius: 4px;
            font-size: 14px;
        }
        button { 
            background: #213448; 
            color: #fff; 
            border: none; 
            padding: 12px 24px; 
            cursor: pointer; 
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
            transition: background 0.2s;
        }
        button:hover { 
            background: #205781; 
        }
        button:disabled { 
            background: #333; 
            cursor: not-allowed;
            opacity: 0.5;
        }
        .btn-secondary { 
            background: #333; 
            margin-left: 10px;
        }
        .btn-secondary:hover { 
            background: #444; 
        }
        .btn-danger { 
            background: #dc3545; 
        }
        .btn-danger:hover { 
            background: #c82333; 
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
        }
        th, td { 
            padding: 12px; 
            text-align: left; 
            border-bottom: 1px solid #333; 
        }
        th { 
            background: #0d0d0d; 
            font-weight: 600;
        }
        tr:hover { 
            background: #222; 
        }
        .progress-bar { 
            width: 100%; 
            height: 30px; 
            background: #333; 
            border-radius: 4px; 
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-fill { 
            height: 100%; 
            background: #22c55e; 
            transition: width 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #000;
            font-weight: bold;
        }
        .logs { 
            background: #000; 
            padding: 15px; 
            height: 300px; 
            overflow-y: auto; 
            font-family: 'Courier New', monospace; 
            font-size: 13px;
            border-radius: 4px;
            border: 1px solid #333;
        }
        .log-info { color: #fff; }
        .log-warn { color: #ffc107; }
        .log-error { color: #dc3545; }
        .log-done { color: #22c55e; }
        .status { 
            display: inline-block; 
            padding: 5px 10px; 
            border-radius: 4px; 
            font-size: 12px;
            font-weight: 500;
        }
        .status-idle { background: #333; }
        .status-running { background: #213448; animation: pulse 2s infinite; }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
        }
        .flex { display: flex; gap: 10px; align-items: center; }
        .flex-end { justify-content: flex-end; }
        .mt-2 { margin-top: 20px; }
        .link { 
            color: #4a9eff; 
            text-decoration: none; 
        }
        .link:hover { 
            text-decoration: underline; 
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 CTUMP PDF Tool</h1>
        
        <!-- Status -->
        <div class="card">
            <div class="flex" style="justify-content: space-between;">
                <div>
                    <strong>Status:</strong> 
                    <span class="status status-{{ status }}">{{ status|upper }}</span>
                </div>
                <div id="segment-info">Segment: {{ segment }}</div>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" id="progress" style="width: {{ progress_pct }}%">
                    {{ progress_pct }}%
                </div>
            </div>
        </div>

        <!-- Add Document Form -->
        <div class="card">
            <h2 style="margin-bottom: 15px;">Add Document</h2>
            <form id="add-form">
                <div class="form-group">
                    <label>Viewer URL (optional, for auto-detect):</label>
                    <input type="text" id="viewer-url" placeholder="Paste viewer URL here...">
                </div>
                <div class="form-group">
                    <label>Token:</label>
                    <input type="text" id="token" required placeholder="Token will be filled after auto-detect">
                </div>
                <div class="flex">
                    <div class="form-group" style="flex: 1;">
                        <label>Start Page:</label>
                        <input type="number" id="start-page" value="1" min="1" required>
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label>End Page:</label>
                        <input type="number" id="end-page" value="1" min="1" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>Output Filename:</label>
                    <input type="text" id="output" placeholder="document.pdf" required>
                </div>
                <div class="flex flex-end">
                    <button type="button" onclick="autoDetectToken()" class="btn-secondary">Auto Detect Token</button>
                    <button type="submit">Add Document</button>
                </div>
            </form>
        </div>

        <!-- Documents List -->
        <div class="card">
            <h2 style="margin-bottom: 15px;">Documents Queue ({{ docs|length }})</h2>
            <table>
                <thead>
                    <tr>
                        <th>Token</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Output</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody id="docs-table">
                    {% for doc in docs %}
                    <tr>
                        <td>{{ doc.token[:20] }}...</td>
                        <td>{{ doc.start_page }}</td>
                        <td>{{ doc.end_page }}</td>
                        <td>
                            {{ doc.output_filename }}
                            {% if doc.output_filename in output_files %}
                            <a href="{{ url_for('download_pdf', filename=doc.output_filename) }}" class="link" target="_blank">📥 Download</a>
                            {% endif %}
                        </td>
                        <td>
                            <button onclick="removeDoc({{ loop.index0 }})" class="btn-secondary" style="padding: 5px 10px; margin: 0;">Remove</button>
                        </td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>

        <!-- Control Buttons -->
        <div class="card">
            <div class="flex flex-end">
                <button onclick="startProcessing()" id="start-btn" {% if is_running %}disabled{% endif %}>Start Processing</button>
                <button onclick="cancelProcessing()" class="btn-danger" id="cancel-btn" {% if not is_running %}disabled{% endif %}>Cancel</button>
                <button onclick="clearDocs()" class="btn-secondary" {% if is_running %}disabled{% endif %}>Clear All</button>
            </div>
        </div>

        <!-- Logs -->
        <div class="card">
            <h2 style="margin-bottom: 15px;">Logs</h2>
            <div class="logs" id="logs">
                {% for log in logs %}
                <div class="log-{{ log.level }}">{{ log.message }}</div>
                {% endfor %}
            </div>
        </div>
    </div>

    <script>
        // Auto-refresh every 2 seconds when processing
        setInterval(() => {
            if (document.querySelector('.status-running')) {
                location.reload();
            }
        }, 2000);

        async function autoDetectToken() {
            const viewerUrl = document.getElementById('viewer-url').value;
            if (!viewerUrl) {
                alert('Please enter a viewer URL first');
                return;
            }
            
            const response = await fetch('/api/detect-token', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({viewer_url: viewerUrl})
            });
            
            const data = await response.json();
            if (data.success) {
                document.getElementById('token').value = data.token;
                alert('Token detected: ' + data.token);
            } else {
                alert('Could not detect token: ' + data.error);
            }
        }

        document.getElementById('add-form').onsubmit = async (e) => {
            e.preventDefault();
            const doc = {
                token: document.getElementById('token').value,
                start_page: parseInt(document.getElementById('start-page').value),
                end_page: parseInt(document.getElementById('end-page').value),
                output_filename: document.getElementById('output').value
            };
            
            await fetch('/api/add-doc', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(doc)
            });
            
            location.reload();
        };

        async function removeDoc(index) {
            await fetch('/api/remove-doc/' + index, {method: 'DELETE'});
            location.reload();
        }

        async function startProcessing() {
            await fetch('/api/start', {method: 'POST'});
            location.reload();
        }

        async function cancelProcessing() {
            await fetch('/api/cancel', {method: 'POST'});
            location.reload();
        }

        async function clearDocs() {
            await fetch('/api/clear', {method: 'POST'});
            location.reload();
        }

        // Auto-scroll logs
        const logs = document.getElementById('logs');
        logs.scrollTop = logs.scrollHeight;
    </script>
</body>
</html>
"""

def add_log(message: str, level: str = "info"):
    """Add a log message to the app state"""
    app_state["logs"].append({
        "message": message,
        "level": level,
        "timestamp": datetime.now().isoformat()
    })
    print(message)  # Also print to console


@app.route('/')
def index():
    """Main page"""
    progress_pct = 0
    if app_state["progress"]["total"] > 0:
        progress_pct = int((app_state["progress"]["current"] / app_state["progress"]["total"]) * 100)
    
    return render_template_string(
        HTML_TEMPLATE,
        docs=app_state["docs"],
        logs=app_state["logs"][-50:],  # Last 50 logs
        status="running" if app_state["is_running"] else "idle",
        progress_pct=progress_pct,
        segment=app_state["progress"]["segment"],
        is_running=app_state["is_running"],
        output_files=app_state["output_files"]
    )


@app.route('/api/detect-token', methods=['POST'])
def detect_token():
    """Auto-detect token from viewer URL"""
    data = request.json
    viewer_url = data.get('viewer_url', '')
    
    if not viewer_url:
        return jsonify({"success": False, "error": "No URL provided"})
    
    add_log(f"[INFO] Detecting token from: {viewer_url}")
    token = extract_token_from_viewer_sync(viewer_url)
    
    if token:
        add_log(f"[INFO] Token detected: {token}")
        return jsonify({"success": True, "token": token})
    else:
        add_log("[WARN] Token not found")
        return jsonify({"success": False, "error": "Token not found"})


@app.route('/api/add-doc', methods=['POST'])
def add_doc():
    """Add a document to the queue"""
    data = request.json
    
    # Validate
    if not data.get('token'):
        return jsonify({"success": False, "error": "Token required"})
    
    start = int(data.get('start_page', 1))
    end = int(data.get('end_page', 1))
    
    if end < start:
        return jsonify({"success": False, "error": "End page must be >= start page"})
    
    output = data.get('output_filename', '').strip()
    if not output:
        return jsonify({"success": False, "error": "Output filename required"})
    
    if not output.lower().endswith('.pdf'):
        output += '.pdf'
    
    doc = DocumentSpec(
        token=data['token'].strip(),
        start_page=start,
        end_page=end,
        output_filename=output
    )
    
    app_state["docs"].append(doc)
    add_log(f"[INFO] Added document: {output} (pages {start}-{end})")
    
    return jsonify({"success": True})


@app.route('/api/remove-doc/<int:index>', methods=['DELETE'])
def remove_doc(index):
    """Remove a document from the queue"""
    if 0 <= index < len(app_state["docs"]):
        doc = app_state["docs"].pop(index)
        add_log(f"[INFO] Removed document: {doc.output_filename}")
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "Invalid index"})


@app.route('/api/clear', methods=['POST'])
def clear_docs():
    """Clear all documents"""
    app_state["docs"].clear()
    add_log("[INFO] Cleared all documents")
    return jsonify({"success": True})


@app.route('/api/start', methods=['POST'])
def start_processing():
    """Start processing documents"""
    if app_state["is_running"]:
        return jsonify({"success": False, "error": "Already running"})
    
    if not app_state["docs"]:
        return jsonify({"success": False, "error": "No documents to process"})
    
    app_state["is_running"] = True
    app_state["cancel_event"].clear()
    app_state["progress"]["current"] = 0
    app_state["progress"]["total"] = sum(d.end_page - d.start_page + 1 for d in app_state["docs"])
    app_state["progress"]["segment"] = "-"
    
    add_log("[INFO] Starting processing...")
    
    def worker():
        try:
            asyncio.run(run_all_docs())
        except Exception as e:
            add_log(f"[ERROR] {e}", "error")
        finally:
            add_log("[INFO] Clearing cache and temporary files...")
            clear_cache_automatic()
            add_log("[DONE] Processing complete", "done")
            app_state["is_running"] = False
    
    threading.Thread(target=worker, daemon=True).start()
    
    return jsonify({"success": True})


@app.route('/api/cancel', methods=['POST'])
def cancel_processing():
    """Cancel processing"""
    app_state["cancel_event"].set()
    add_log("[WARN] Cancel requested by user", "warn")
    return jsonify({"success": True})


@app.route('/download/<path:filename>')
def download_pdf(filename):
    """Serve a generated PDF file"""
    if filename in app_state["output_files"]:
        filepath = app_state["output_files"][filename]
        if os.path.exists(filepath):
            return send_file(filepath, as_attachment=True, download_name=filename)
    return "File not found", 404


async def run_all_docs():
    """Process all documents in the queue"""
    base_url = DEFAULT_BASE_URL
    concurrency = DEFAULT_CONCURRENCY
    segment_size = DEFAULT_SEGMENT_SIZE
    
    for i, spec in enumerate(app_state["docs"], 1):
        if app_state["cancel_event"].is_set():
            break
        
        def on_overall_progress(done_in_doc: int, total_in_doc: int):
            app_state["progress"]["current"] += 1
        
        def on_segment(seg_start: int, seg_end: int):
            app_state["progress"]["segment"] = f"{seg_start}–{seg_end}"
        
        add_log(f"[INFO] Doc {i}/{len(app_state['docs'])}  {spec.output_filename} : {spec.start_page}–{spec.end_page}")
        
        ok = await scrape_doc_async(
            base_url=base_url,
            spec=spec,
            concurrency=concurrency,
            segment_size=segment_size,
            cancel_ev=app_state["cancel_event"],
            log=lambda s: add_log(s, "info" if "[INFO]" in s else "warn" if "[WARN]" in s else "error" if "[ERROR]" in s else "done"),
            on_overall_progress=on_overall_progress,
            on_segment=on_segment,
        )
        
        if ok and os.path.exists(spec.output_filename):
            # Store the output file path for download
            app_state["output_files"][spec.output_filename] = os.path.abspath(spec.output_filename)
        
        if not ok and app_state["cancel_event"].is_set():
            add_log(f"[WARN] Stopped: {spec.output_filename}", "warn")
            break


# ------------------------------- Main -----------------------------------
if __name__ == "__main__":
    add_log("[INFO] CTUMP PDF Tool starting...")
    add_log("[INFO] Open http://localhost:5000 in your browser")
    print("\n" + "="*60)
    print("🚀 CTUMP PDF Tool - Web Interface")
    print("="*60)
    print("Open your browser and navigate to: http://localhost:5000")
    print("Press Ctrl+C to stop the server")
    print("="*60 + "\n")
    app.run(debug=False, host='0.0.0.0', port=5000, threaded=True)
