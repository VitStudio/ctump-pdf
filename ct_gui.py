#!/usr/bin/env python3
"""
CTUMP DocImage -> PDF (Async, Auto-Detect Token)

- Cross-platform Tkinter/ttk GUI (no extra GUI deps)
- Async HTTP/2 downloads (httpx), bounded concurrency
- Segment-wise assembly to keep RAM flat
- img2pdf one-page PDFs (often lossless for PNG/JPEG)
- pikepdf merge + linearize (Fast Web View)
- Robust retries with Retry-After + jitter backoff
- Pure monochrome black and white theme for minimal distraction
- "Add Document" dialog supports pasting viewer URL and auto-detecting token
- Automatic cache clearing after processing completion

Run:
  python ct_gui.py
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

# ------------------------- GUI (Tkinter / ttk) -------------------------
import tkinter as tk
from tkinter import ttk, messagebox, filedialog

# --------------------- Optional auto-install of deps --------------------
def _ensure(pkgs: List[str]) -> None:
    import importlib, subprocess
    for p in pkgs:
        try:
            importlib.import_module(p.split("[")[0])
        except Exception:
            subprocess.check_call([sys.executable, "-m", "pip", "install", p])

# Install third-party deps if missing (you can remove this if you manage deps)
_ensure(["httpx[http2]>=0.26", "img2pdf>=0.6.0", "pikepdf>=9.0"])

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

# ----------------------------- Palette ----------------------------------
PALETTE = {
    "bg":        "#000000",        # Pure black background
    "card":      "#1a1a1a",        # Very dark gray for cards
    "panel":     "#0d0d0d",        # Near black for panels
    "text":      "#ffffff",        # Pure white text
    "muted":     "#b3b3b3",        # Medium gray for secondary text
    "accent":    "#213448",        # White for primary actions
    "accent_hi": "#205781",        # Light gray for hover states
    "ok":        "#22c55e",        # White for success/progress
    "warn":      "#cccccc",        # Light gray for warnings
    "err":       "#ffffff",        # White for errors (high contrast)
    "info":      "#ffffff",        # White for info
    "trough":    "#333333",        # Dark gray for progress trough
    "row_even":  "#1a1a1a",        # Alternating row color
    "row_odd":   "#0d0d0d",        # Alternating row color
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

# ------------------------------ GUI App ---------------------------------
class CtumpGUI(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Tool PDF")
        self.geometry("1000x720")
        self.minsize(920, 640)
        self.configure(bg=PALETTE["bg"])

        # State
        self.docs: List[DocumentSpec] = []
        self.cancel_event = threading.Event()
        self.worker_thread: Optional[threading.Thread] = None
        self.msg_q: "queue.Queue[tuple]" = queue.Queue()
        self.total_pages_all = 0
        self.total_pages_done = 0

        # Style & theme
        self.style = ttk.Style(self)
        try:
            if "clam" in self.style.theme_names():
                self.style.theme_use("clam")
        except Exception:
            pass
        self._init_styles()

        # Top UI
        self._build_controls()
        self._build_docs_table()
        self._build_progress_and_logs()

        # Poll worker->UI message queue
        self.after(100, self._drain_queue)

    # ---------- Styles ----------
    def _init_styles(self):
        # Frames / LabelFrames
        self.style.configure("Color.TFrame", background=PALETTE["bg"])
        self.style.configure("Panel.TFrame", background=PALETTE["panel"])
        self.style.configure("Card.TLabelframe", background=PALETTE["card"], foreground=PALETTE["text"])
        self.style.configure("Card.TLabelframe.Label", background=PALETTE["card"], foreground=PALETTE["text"], font=("Tahoma", 14))

        # Labels
        self.style.configure("TLabel", background=PALETTE["bg"], foreground=PALETTE["text"], font=("Tahoma", 14))
        self.style.configure("Muted.TLabel", background=PALETTE["bg"], foreground=PALETTE["muted"], font=("Tahoma", 14))

        # Buttons
        self.style.configure("Accent.TButton", padding=8, foreground="#ffffff", background=PALETTE["accent"], font=("Tahoma", 14))
        self.style.map("Accent.TButton", background=[("active", PALETTE["accent_hi"])],
                       foreground=[("disabled", "#cccccc")])
        self.style.configure("Neutral.TButton", padding=6, font=("Tahoma", 14))
        self.style.map("Neutral.TButton", background=[("active", PALETTE["panel"])])

        # Progressbar (Monochrome)
        self.style.configure("Green.Horizontal.TProgressbar",
                             troughcolor=PALETTE["trough"],
                             background=PALETTE["ok"],
                             bordercolor=PALETTE["trough"])

        # Treeview
        self.style.configure("Treeview",
                             background=PALETTE["card"],
                             fieldbackground=PALETTE["card"],
                             foreground=PALETTE["text"],
                             bordercolor=PALETTE["panel"],
                             font=("Tahoma", 14))
        self.style.configure("Treeview.Heading",
                             background=PALETTE["panel"],
                             foreground=PALETTE["text"],
                             font=("Tahoma", 14, "bold"))

    # ---------- UI builders ----------
    def _build_controls(self):
        frm = ttk.Frame(self, padding=(10, 10, 10, 0), style="Color.TFrame")
        frm.pack(side=tk.TOP, fill=tk.X)

        ttk.Label(frm, text="Base URL:").grid(row=0, column=0, sticky="w")
        self.base_url_var = tk.StringVar(value=DEFAULT_BASE_URL)
        self.base_url_entry = ttk.Entry(frm, textvariable=self.base_url_var, width=70, font=("Tahoma", 14), state="readonly")
        self.base_url_entry.grid(row=0, column=1, sticky="we", padx=(5, 10))

        ttk.Label(frm, text="Concurrency:").grid(row=0, column=2, sticky="e")
        self.concurrency_var = tk.IntVar(value=DEFAULT_CONCURRENCY)
        self.concurrency_spin = ttk.Spinbox(frm, from_=1, to=64, textvariable=self.concurrency_var, width=6, font=("Tahoma", 14), state="readonly")
        self.concurrency_spin.grid(row=0, column=3, sticky="w", padx=(5, 10))

        ttk.Label(frm, text="Segment size:").grid(row=0, column=4, sticky="e")
        self.segment_var = tk.IntVar(value=DEFAULT_SEGMENT_SIZE)
        self.segment_spin = ttk.Spinbox(frm, from_=20, to=2000, increment=20, textvariable=self.segment_var, width=7, font=("Tahoma", 14), state="readonly")
        self.segment_spin.grid(row=0, column=5, sticky="w")

        frm.grid_columnconfigure(1, weight=1)

        btns = ttk.Frame(self, padding=(10, 6), style="Color.TFrame")
        btns.pack(side=tk.TOP, fill=tk.X)

        self.btn_add = ttk.Button(btns, text="Add Document", style="Neutral.TButton", command=self._add_doc_dialog)
        self.btn_add.pack(side=tk.LEFT, padx=(0, 6))

        self.btn_remove = ttk.Button(btns, text="Remove Selected", style="Neutral.TButton", command=self._remove_selected)
        self.btn_remove.pack(side=tk.LEFT, padx=(0, 6))

        self.btn_load = ttk.Button(btns, text="Load Manifest…", style="Neutral.TButton", command=self._load_manifest)
        self.btn_load.pack(side=tk.LEFT, padx=(0, 6))

        self.btn_save = ttk.Button(btns, text="Save Manifest…", style="Neutral.TButton", command=self._save_manifest)
        self.btn_save.pack(side=tk.LEFT, padx=(0, 6))

        self.btn_start = ttk.Button(btns, text="Start", style="Accent.TButton", command=self._start)
        self.btn_start.pack(side=tk.RIGHT, padx=(6, 0))

        self.btn_cancel = ttk.Button(btns, text="Cancel", style="Accent.TButton", command=self._cancel, state=tk.DISABLED)
        self.btn_cancel.pack(side=tk.RIGHT, padx=(0, 6))

    def _build_docs_table(self):
        frm = ttk.LabelFrame(self, text="Documents", padding=10, style="Card.TLabelframe")
        frm.pack(side=tk.TOP, fill=tk.BOTH, expand=True, padx=10, pady=(0, 10))

        cols = ("token", "start", "end", "output")
        self.tree = ttk.Treeview(frm, columns=cols, show="headings", height=10)
        self.tree.heading("token", text="Token")
        self.tree.heading("start", text="Start Page")
        self.tree.heading("end", text="End Page")
        self.tree.heading("output", text="Output PDF")
        self.tree.column("token", width=320)
        self.tree.column("start", width=100, anchor="center")
        self.tree.column("end", width=100, anchor="center")
        self.tree.column("output", width=320)
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # Zebra rows
        self.tree.tag_configure("odd", background=PALETTE["row_odd"])
        self.tree.tag_configure("even", background=PALETTE["row_even"])

        vsb = ttk.Scrollbar(frm, orient="vertical", command=self.tree.yview)
        vsb.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree.configure(yscrollcommand=vsb.set)

    def _build_progress_and_logs(self):
        frm = ttk.LabelFrame(self, text="Progress", padding=10, style="Card.TLabelframe")
        frm.pack(side=tk.TOP, fill=tk.X, padx=10, pady=(0, 10))

        self.prog = ttk.Progressbar(frm, orient="horizontal", mode="determinate",
                                    length=400, style="Green.Horizontal.TProgressbar")
        self.prog.pack(side=tk.LEFT, fill=tk.X, expand=True)

        self.seg_label = ttk.Label(frm, text="Segment: -", style="Muted.TLabel")
        self.seg_label.pack(side=tk.LEFT, padx=(12, 0))

        logfrm = ttk.LabelFrame(self, text="Logs", padding=10, style="Card.TLabelframe")
        logfrm.pack(side=tk.TOP, fill=tk.BOTH, expand=True, padx=10, pady=(0, 10))

        self.logtxt = tk.Text(logfrm, height=12, wrap="word",
                              bg=PALETTE["bg"], fg=PALETTE["text"],
                              insertbackground=PALETTE["text"], bd=0, highlightthickness=0,
                              font=("Tahoma", 14))
        self.logtxt.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        lsb = ttk.Scrollbar(logfrm, orient="vertical", command=self.logtxt.yview)
        lsb.pack(side=tk.RIGHT, fill=tk.Y)
        self.logtxt.configure(yscrollcommand=lsb.set)

        # Color tags for log levels
        self.logtxt.tag_config("INFO", foreground=PALETTE["info"])
        self.logtxt.tag_config("WARN", foreground=PALETTE["warn"])
        self.logtxt.tag_config("ERROR", foreground=PALETTE["err"])
        self.logtxt.tag_config("DONE", foreground=PALETTE["ok"])
        self.logtxt.tag_config("NEUTRAL", foreground=PALETTE["text"])

    # ---------- Document table helpers ----------
    def _refresh_tree(self):
        for iid in self.tree.get_children():
            self.tree.delete(iid)
        for idx, d in enumerate(self.docs):
            tag = "even" if (idx % 2 == 0) else "odd"
            self.tree.insert("", tk.END, values=(d.token, d.start_page, d.end_page, d.output_filename), tags=(tag,))

    def _add_doc_dialog(self):
        dlg = tk.Toplevel(self)
        dlg.title("Add Document")
        dlg.transient(self)
        dlg.grab_set()
        dlg.configure(bg=PALETTE["bg"])

        # Viewer URL field (for auto-detect)
        ttk.Label(dlg, text="Viewer URL:").grid(row=0, column=0, sticky="e", padx=5, pady=5)
        viewer_var = tk.StringVar()
        ttk.Entry(dlg, textvariable=viewer_var, width=60, font=("Tahoma", 14)).grid(row=0, column=1, sticky="we", padx=5, pady=5)

        # Token field (can paste manually or auto-fill)
        ttk.Label(dlg, text="Token:").grid(row=1, column=0, sticky="e", padx=5, pady=5)
        token_var = tk.StringVar()
        ttk.Entry(dlg, textvariable=token_var, width=60, font=("Tahoma", 14)).grid(row=1, column=1, sticky="w", padx=5, pady=5)

        def auto_detect():
            url = viewer_var.get().strip()
            if not url:
                messagebox.showinfo("Info", "Paste the viewer URL first.", parent=dlg)
                return

            btn_autodetect.configure(state=tk.DISABLED)
            self._log("[INFO] Detecting token from viewer page…")

            def work():
                tok = extract_token_from_viewer_sync(url)
                def finish():
                    btn_autodetect.configure(state=tk.NORMAL)
                    if tok:
                        token_var.set(tok)
                        self._log(f"[INFO] Token detected: {tok}")
                        messagebox.showinfo("Token Found", f"Token:\n{tok}", parent=dlg)
                    else:
                        self._log("[WARN] Token not found in page/scripts.")
                        messagebox.showwarning("Not Found", "Could not find token in the page or scripts.", parent=dlg)
                self.after(0, finish)

            threading.Thread(target=work, daemon=True).start()

        btn_autodetect = ttk.Button(dlg, text="Auto Detect Token", style="Accent.TButton", command=auto_detect)
        btn_autodetect.grid(row=0, column=2, sticky="w", padx=5, pady=5)

        # Start / End / Output
        ttk.Label(dlg, text="Start page:").grid(row=2, column=0, sticky="e", padx=5, pady=5)
        s_var = tk.IntVar(value=1)
        ttk.Spinbox(dlg, from_=1, to=1_000_000, textvariable=s_var, width=10, font=("Tahoma", 14)).grid(row=2, column=1, sticky="w", padx=5, pady=5)

        ttk.Label(dlg, text="End page:").grid(row=3, column=0, sticky="e", padx=5, pady=5)
        e_var = tk.IntVar(value=1)
        ttk.Spinbox(dlg, from_=1, to=1_000_000, textvariable=e_var, width=10, font=("Tahoma", 14)).grid(row=3, column=1, sticky="w", padx=5, pady=5)

        ttk.Label(dlg, text="Output PDF:").grid(row=4, column=0, sticky="e", padx=5, pady=5)
        out_var = tk.StringVar()
        ttk.Entry(dlg, textvariable=out_var, width=60, font=("Tahoma", 14)).grid(row=4, column=1, sticky="w", padx=5, pady=5)

        def browse_save():
            path = filedialog.asksaveasfilename(
                parent=dlg, defaultextension=".pdf",
                filetypes=[("PDF", "*.pdf"), ("All Files", "*.*")]
            )
            if path:
                out_var.set(path)

        ttk.Button(dlg, text="Browse…", style="Neutral.TButton", command=browse_save).grid(row=4, column=2, sticky="w", padx=5, pady=5)

        def on_ok():
            token = token_var.get().strip()
            url = viewer_var.get().strip()

            # Fallback auto-detect if user pasted URL but didn't click button
            if not token and url:
                self._log("[INFO] Auto-detecting token before adding…")
                tok = extract_token_from_viewer_sync(url)
                if tok:
                    token = tok
                    token_var.set(tok)

            s = int(s_var.get())
            e = int(e_var.get())
            out = out_var.get().strip()

            if not token:
                messagebox.showerror("Error", "Token is required (use Auto Detect if you pasted a viewer URL).", parent=dlg)
                return
            if e < s:
                messagebox.showerror("Error", "End page must be >= start page.", parent=dlg)
                return
            if not out:
                messagebox.showerror("Error", "Output PDF path is required.", parent=dlg)
                return
            if not out.lower().endswith(".pdf"):
                out += ".pdf"

            self.docs.append(DocumentSpec(token=token, start_page=s, end_page=e, output_filename=out))
            self._refresh_tree()
            dlg.destroy()

        ttk.Button(dlg, text="Cancel", style="Neutral.TButton", command=dlg.destroy).grid(row=5, column=1, sticky="e", padx=5, pady=10)
        ttk.Button(dlg, text="Add", style="Accent.TButton", command=on_ok).grid(row=5, column=2, sticky="w", padx=5, pady=10)

        dlg.grid_columnconfigure(1, weight=1)

    def _remove_selected(self):
        sel = self.tree.selection()
        if not sel:
            return
        to_remove: List[int] = []
        for iid in sel:
            vals = self.tree.item(iid, "values")
            for idx, d in enumerate(self.docs):
                if (d.token, str(d.start_page), str(d.end_page), d.output_filename) == tuple(map(str, vals)):
                    to_remove.append(idx)
        for idx in sorted(to_remove, reverse=True):
            self.docs.pop(idx)
        self._refresh_tree()

    def _load_manifest(self):
        path = filedialog.askopenfilename(
            parent=self, title="Open Manifest JSON",
            filetypes=[("JSON", "*.json"), ("All Files", "*.*")]
        )
        if not path:
            return
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.docs = []
            for d in data:
                name = str(d["output_filename"]).strip()
                if not name.lower().endswith(".pdf"):
                    name += ".pdf"
                self.docs.append(DocumentSpec(
                    token=str(d["token"]).strip(),
                    start_page=int(d["start_page"]),
                    end_page=int(d["end_page"]),
                    output_filename=name
                ))
            self._refresh_tree()
            self._log("[INFO] Loaded manifest: " + path)
        except Exception as e:
            messagebox.showerror("Error", f"Failed to load manifest:\n{e}", parent=self)

    def _save_manifest(self):
        if not self.docs:
            messagebox.showinfo("Info", "No documents to save.", parent=self)
            return
        path = filedialog.asksaveasfilename(
            parent=self, title="Save Manifest JSON",
            defaultextension=".json",
            filetypes=[("JSON", "*.json"), ("All Files", "*.*")]
        )
        if not path:
            return
        try:
            data = [asdict(d) for d in self.docs]
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            self._log("[INFO] Saved manifest: " + path)
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save manifest:\n{e}", parent=self)

    # ---------- Run / Cancel ----------
    def _start(self):
        if not self.docs:
            messagebox.showinfo("Info", "Please add at least one document.", parent=self)
            return
        try:
            base_url = self.base_url_var.get().strip()
            concurrency = max(1, int(self.concurrency_var.get()))
            segment = max(20, int(self.segment_var.get()))
        except ValueError:
            messagebox.showerror("Error", "Invalid concurrency or segment size.", parent=self)
            return

        self.total_pages_all = sum(d.end_page - d.start_page + 1 for d in self.docs)
        self.total_pages_done = 0
        self.prog.configure(maximum=self.total_pages_all, value=0)
        self.seg_label.configure(text="Segment: -")
        self._log(f"[INFO] Start  base={base_url}  conc={concurrency}  seg={segment}")
        self._toggle_controls(running=True)
        self.cancel_event.clear()

        def worker():
            try:
                asyncio.run(self._run_all(base_url, concurrency, segment))
            except Exception as e:
                self._log(f"[ERROR] {e}")
            finally:
                # Always clear cache, even if there was an error or cancellation
                self._log("[INFO] Clearing cache and temporary files...")
                clear_cache_automatic()
                self._log("[DONE] Cache cleared successfully")
                self.msg_q.put(("done", None))

        self.worker_thread = threading.Thread(target=worker, daemon=True)
        self.worker_thread.start()

    def _cancel(self):
        if self.worker_thread and self.worker_thread.is_alive():
            self.cancel_event.set()
            self._log("[WARN] Cancel requested by user...")

    def _toggle_controls(self, running: bool):
        state_run = tk.DISABLED if running else tk.NORMAL
        state_idle = tk.NORMAL if running else tk.DISABLED
        self.base_url_entry.configure(state=state_run)
        self.concurrency_spin.configure(state=state_run)
        self.segment_spin.configure(state=state_run)
        self.btn_add.configure(state=state_run)
        self.btn_remove.configure(state=state_run)
        self.btn_load.configure(state=state_run)
        self.btn_save.configure(state=state_run)
        self.btn_start.configure(state=state_run)
        self.btn_cancel.configure(state=state_idle)

    # ---------- Async runner ----------
    async def _run_all(self, base_url: str, concurrency: int, segment_size: int):
        for i, spec in enumerate(self.docs, 1):
            if self.cancel_event.is_set():
                break

            def on_overall_progress(done_in_doc: int, total_in_doc: int):
                self.total_pages_done += 1
                self.msg_q.put(("progress", self.total_pages_done))

            def on_segment(seg_start: int, seg_end: int):
                self.msg_q.put(("segment", f"{seg_start}–{seg_end}"))

            self._log(f"[INFO] Doc {i}/{len(self.docs)}  {spec.output_filename} : {spec.start_page}–{spec.end_page}")
            ok = await scrape_doc_async(
                base_url=base_url,
                spec=spec,
                concurrency=concurrency,
                segment_size=segment_size,
                cancel_ev=self.cancel_event,
                log=lambda s: self._log_threadsafe(s),
                on_overall_progress=on_overall_progress,
                on_segment=on_segment,
            )
            if not ok and self.cancel_event.is_set():
                self._log(f"[WARN] Stopped: {spec.output_filename}")
                break

        # Clear cache automatically after processing is complete
        self._log("[INFO] Clearing cache and temporary files...")
        clear_cache_automatic()
        self._log("[DONE] Cache cleared successfully")
        
        self.msg_q.put(("finished", None))

    # ---------- Queue / UI updates ----------
    def _drain_queue(self):
        try:
            while True:
                kind, payload = self.msg_q.get_nowait()
                if kind == "progress":
                    val = int(payload)
                    self.prog['value'] = val
                elif kind == "segment":
                    self.seg_label.configure(text=f"Segment: {payload}")
                elif kind == "log":
                    self._append_log(payload)
                elif kind in ("done", "finished"):
                    self._toggle_controls(running=False)
        except queue.Empty:
            pass
        self.after(100, self._drain_queue)

    # ---------- Logging ----------
    def _log(self, msg: str):
        self._append_log(msg)

    def _log_threadsafe(self, msg: str):
        self.msg_q.put(("log", msg))

    def _append_log(self, msg: str):
        tag = "NEUTRAL"
        if msg.startswith("[INFO]"):
            tag = "INFO"
        elif msg.startswith("[WARN]"):
            tag = "WARN"
        elif msg.startswith("[ERROR]"):
            tag = "ERROR"
        elif msg.startswith("[DONE]"):
            tag = "DONE"
        self.logtxt.insert(tk.END, msg + "\n", tag)
        self.logtxt.see(tk.END)

# ------------------------------- Main -----------------------------------
if __name__ == "__main__":
    try:
        app = CtumpGUI()
        app.mainloop()
    except KeyboardInterrupt:
        print("\n[INTERRUPTED]")
