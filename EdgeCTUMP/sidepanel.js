/**
 * EdgeCTUMP - Sidebar Controller & 4-Tier Auto Page Detector
 * 100% Client-side JavaScript. Works continuously inside Chrome & Edge Side Panel.
 */

// Configuration
const BASE_URL = "https://media.ctump.edu.vn/DocImage.axd";
const CONCURRENCY = 5;
const CHUNK_SIZE = 15;
const RETRY_MAX = 3;
const RETRIABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

// DOM Elements
const $ = (id) => document.getElementById(id);
const statusCard = $("status-card");
const statusEmpty = $("status-empty");
const emptyDesc = $("empty-desc");
const statusFound = $("status-found");
const liveDot = $("live-dot");
const statusTitle = $("status-title");
const dispToken = $("disp-token");
const dispSource = $("disp-source");
const dispTotalPages = $("disp-total-pages");
const rangeStrip = $("range-strip");
const inpStart = $("inp-start");
const inpEnd = $("inp-end");
const inpFilename = $("inp-filename");
const btnDownload = $("btn-download");
const btnCancel = $("btn-cancel");
const btnText = $("btn-text");
const btnRefreshScan = $("btn-refresh-scan");
const progressCard = $("progress-card");
const progressPct = $("progress-pct");
const progressBarFill = $("progress-bar-fill");
const progressPages = $("progress-pages");
const progressSpeed = $("progress-speed");
const msgBox = $("msg-box");

// State
let currentDoc = null;
let abortController = null;
let isDownloading = false;

// Utility functions
function showMessage(text, type = "info") {
  msgBox.textContent = text;
  msgBox.className = `msg-box ${type}`;
  msgBox.style.display = "block";
}

function clearMessage() {
  msgBox.style.display = "none";
  msgBox.textContent = "";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getJitteredDelay(attempt) {
  const base = 400;
  return Math.min(2500, base * Math.pow(2, attempt - 1) + Math.random() * 250);
}

/**
 * Multi-tier scanner injected into all frames of the viewer tab.
 * Extracts tokens, DOM placeholders, toolbar indicators, and script variables.
 */
function scanDocumentFramesMultiTier() {
  let token = null;
  let minPage = null;
  let maxPageFromImages = null;
  let maxPageFromDomIds = null;
  let totalFromToolbar = null;
  let totalFromScript = null;
  let count = 0;

  // Tier 1: Scan image elements and inputs with DocImage.axd
  const imgElements = document.querySelectorAll(
    'input[src*="DocImage.axd"], img[src*="DocImage.axd"], [data-src*="DocImage.axd"]'
  );

  for (const el of imgElements) {
    try {
      const src = el.getAttribute("src") || el.getAttribute("data-src") || "";
      if (!src.includes("DocImage.axd")) continue;

      const url = new URL(src, location.href);
      const t = url.searchParams.get("token");
      const p = parseInt(url.searchParams.get("page"), 10);

      if (t) token = t;
      if (Number.isFinite(p) && p > 0) {
        count++;
        minPage = minPage === null ? p : Math.min(minPage, p);
        maxPageFromImages = maxPageFromImages === null ? p : Math.max(maxPageFromImages, p);
      }
    } catch (_) {}
  }

  // Tier 1b: Scan DOM placeholder IDs (e.g. div_ctlDoc_divPreview_divPage_1..N)
  const pagePlaceholders = document.querySelectorAll(
    '[id*="divPage_"], [id*="divPreview_divPage_"], [id*="Page_"]'
  );
  for (const el of pagePlaceholders) {
    const m = el.id.match(/(?:divPage_|divPreview_divPage_|Page_)(\d+)/i);
    if (m && m[1]) {
      const p = parseInt(m[1], 10);
      if (Number.isFinite(p) && p > 0 && p < 10000) {
        maxPageFromDomIds = maxPageFromDomIds === null ? p : Math.max(maxPageFromDomIds, p);
      }
    }
  }

  // Tier 2: Scan toolbar indicators (e.g. "1 / 68" or lblTotal)
  const toolbarCandidates = document.querySelectorAll(
    '[id*="total" i], [id*="count" i], [id*="lblPage" i], [class*="total" i], span, div'
  );
  for (const el of toolbarCandidates) {
    // Check if element has short text matching a total page pattern
    const text = (el.innerText || el.textContent || "").trim();
    if (text.length > 0 && text.length < 30) {
      const m = text.match(/(?:\/|of|của|trên|tổng số)\s*(\d+)/i) || text.match(/^\s*\/\s*(\d+)\s*$/);
      if (m && m[1]) {
        const num = parseInt(m[1], 10);
        if (num > 1 && num < 10000) {
          totalFromToolbar = totalFromToolbar === null ? num : Math.max(totalFromToolbar, num);
        }
      }
    }
  }

  // Tier 3: Scan <script> blocks inside the viewer for configuration variables
  const scripts = document.querySelectorAll("script");
  for (const s of scripts) {
    const content = s.textContent || "";
    if (content.length > 0 && content.length < 50000) {
      // Look for totalPages = 68, pageCount: 68, etc.
      const m = content.match(
        /(?:totalPages|total_pages|pageCount|page_count|numPages|maxPage|PageCount|TotalPage)\s*[:=]\s*["']?(\d+)["']?/i
      ) || content.match(/["'](?:TotalPages|PageCount|TotalPage)["']\s*:\s*(\d+)/i);

      if (m && m[1]) {
        const num = parseInt(m[1], 10);
        if (num > 1 && num < 10000) {
          totalFromScript = totalFromScript === null ? num : Math.max(totalFromScript, num);
        }
      }

      // Also regex all divPage_(\d+) inside scripts
      const regexAllPages = /divPage_(\d+)/gi;
      let match;
      while ((match = regexAllPages.exec(content)) !== null) {
        const p = parseInt(match[1], 10);
        if (p > 0 && p < 10000) {
          maxPageFromDomIds = maxPageFromDomIds === null ? p : Math.max(maxPageFromDomIds, p);
        }
      }
    }
  }

  return {
    token,
    start: minPage || 1,
    maxPageFromImages,
    maxPageFromDomIds,
    totalFromToolbar,
    totalFromScript,
    count,
  };
}

/**
 * Tier 4: Fast Binary Probe to detect exact last page when viewer uses strict lazy loading
 */
async function probePageExists(page, token, signal) {
  const url = `${BASE_URL}?page=${page}&token=${encodeURIComponent(token)}&zoom=100&format=png`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-128" },
      signal,
    });
    // Server returns 200 (or 206) for valid pages. Out-of-bounds pages return 404, 500, or 400.
    if (res.status === 200 || res.status === 206) {
      const buf = await res.arrayBuffer();
      return buf && buf.byteLength > 0;
    }
    return false;
  } catch (_) {
    return false;
  }
}

async function fastBinaryProbeTotalPages(knownStart, token, signal) {
  // Step 1: Exponential leaps to find upper bound
  let low = knownStart;
  let high = Math.max(knownStart + 10, 20);

  while (high <= 1500) {
    if (signal && signal.aborted) break;
    const ok = await probePageExists(high, token, signal);
    if (ok) {
      low = high;
      high = high * 2;
    } else {
      break;
    }
  }

  // Step 2: Binary search between [low, high]
  let best = low;
  let left = low + 1;
  let right = high - 1;

  while (left <= right) {
    if (signal && signal.aborted) break;
    const mid = Math.floor((left + right) / 2);
    const exists = await probePageExists(mid, token, signal);
    if (exists) {
      best = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return best;
}

/**
 * Render detected document state in Sidebar
 */
function renderDocumentState(doc) {
  currentDoc = doc;
  statusEmpty.style.display = "none";
  statusFound.style.display = "block";
  liveDot.classList.add("active");
  statusTitle.textContent = "ĐÃ KẾT NỐI BÀI GIẢNG";

  dispToken.textContent = `${doc.token.slice(0, 8)}…${doc.token.slice(-4)}`;
  dispSource.textContent = doc.detectionMethod;
  dispTotalPages.textContent = `${doc.end} trang`;

  inpStart.value = doc.start;
  inpStart.min = 1;
  inpStart.max = doc.end;

  inpEnd.value = doc.end;
  inpEnd.min = doc.start;
  inpEnd.max = 9999;

  inpFilename.value = `CTUMP_${doc.start}-${doc.end}.pdf`;

  // Render visual strip
  rangeStrip.innerHTML = "";
  const total = doc.end - doc.start + 1;
  const numTicks = Math.min(total, 60);
  for (let i = 0; i < numTicks; i++) {
    const tick = document.createElement("i");
    if ((i / numTicks) * total < Math.max(doc.count, total)) {
      tick.className = "hit";
    }
    rangeStrip.appendChild(tick);
  }

  btnDownload.disabled = false;
  btnText.textContent = `Tải PDF (${doc.start} → ${doc.end})`;
}

/**
 * Input change handler
 */
function onInputsChanged() {
  const start = parseInt(inpStart.value, 10);
  const end = parseInt(inpEnd.value, 10);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < start) {
    btnDownload.disabled = true;
    btnText.textContent = "Dải trang không hợp lệ";
  } else {
    btnDownload.disabled = false;
    btnText.textContent = `Tải PDF (Trang ${start} → ${end})`;
  }
}

inpStart.addEventListener("input", onInputsChanged);
inpEnd.addEventListener("input", onInputsChanged);

/**
 * Fetch image bytes for a single page
 */
async function fetchPageImage(page, token, signal) {
  const url = `${BASE_URL}?page=${page}&token=${encodeURIComponent(token)}&zoom=100&format=png`;

  for (let attempt = 1; attempt <= RETRY_MAX; attempt++) {
    try {
      const resp = await fetch(url, { signal });

      if (resp.status === 403) {
        throw new Error("TOKEN_EXPIRED");
      }

      if (RETRIABLE_STATUSES.has(resp.status)) {
        if (attempt === RETRY_MAX) {
          throw new Error(`HTTP ${resp.status} (hết lượt thử lại)`);
        }
        await delay(getJitteredDelay(attempt));
        continue;
      }

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const buffer = await resp.arrayBuffer();
      if (!buffer || buffer.byteLength === 0) {
        throw new Error("Dữ liệu trang rỗng");
      }

      return new Uint8Array(buffer);
    } catch (err) {
      if (err.name === "AbortError" || err.message === "TOKEN_EXPIRED") throw err;
      if (attempt === RETRY_MAX) throw err;
      await delay(getJitteredDelay(attempt));
    }
  }
  throw new Error(`Không thể tải trang ${page}`);
}

/**
 * Embed page into PDF document
 */
async function embedPageIntoPdf(pdfDoc, imageBytes) {
  const isPng = imageBytes.length > 4 &&
    imageBytes[0] === 0x89 && imageBytes[1] === 0x50 &&
    imageBytes[2] === 0x4e && imageBytes[3] === 0x47;

  let embedded;
  try {
    embedded = isPng ? await pdfDoc.embedPng(imageBytes) : await pdfDoc.embedJpg(imageBytes);
  } catch (_) {
    embedded = isPng ? await pdfDoc.embedJpg(imageBytes) : await pdfDoc.embedPng(imageBytes);
  }

  const page = pdfDoc.addPage([embedded.width, embedded.height]);
  page.drawImage(embedded, {
    x: 0,
    y: 0,
    width: embedded.width,
    height: embedded.height,
  });
}

/**
 * Download & PDF generation execution (Stream & Dispose Memory pattern)
 */
async function runDownloadPipeline() {
  if (isDownloading) return;

  const startPage = parseInt(inpStart.value, 10);
  const endPage = parseInt(inpEnd.value, 10);
  let filename = (inpFilename.value || `CTUMP_${startPage}-${endPage}.pdf`).trim();
  if (!filename.toLowerCase().endsWith(".pdf")) {
    filename += ".pdf";
  }

  if (!Number.isFinite(startPage) || !Number.isFinite(endPage) || startPage < 1 || endPage < startPage) {
    showMessage("Vui lòng nhập dải trang hợp lệ (Từ trang ≤ Đến trang).", "err");
    return;
  }

  if (!currentDoc || !currentDoc.token) {
    showMessage("Không tìm thấy token bài giảng.", "err");
    return;
  }

  isDownloading = true;
  abortController = new AbortController();
  const signal = abortController.signal;

  clearMessage();
  btnDownload.style.display = "none";
  btnCancel.style.display = "block";
  progressCard.style.display = "block";
  inpStart.disabled = true;
  inpEnd.disabled = true;
  inpFilename.disabled = true;

  const totalPages = endPage - startPage + 1;
  let completedPages = 0;
  const startTime = Date.now();

  function updateProgressUI() {
    const pct = Math.floor((completedPages / totalPages) * 100);
    progressPct.textContent = `${pct}%`;
    progressBarFill.style.width = `${pct}%`;
    progressPages.textContent = `Đã xuất: ${completedPages} / ${totalPages} trang`;

    const elapsed = (Date.now() - startTime) / 1000;
    if (completedPages > 0 && elapsed > 0.5) {
      const speed = (completedPages / elapsed).toFixed(1);
      progressSpeed.textContent = `~${speed} trang/s`;
    }
  }

  try {
    updateProgressUI();
    const pdfDoc = await PDFLib.PDFDocument.create();

    // Process in chunks to prevent memory bloat
    for (let chunkStart = startPage; chunkStart <= endPage; chunkStart += CHUNK_SIZE) {
      if (signal.aborted) break;

      const chunkEnd = Math.min(chunkStart + CHUNK_SIZE - 1, endPage);
      const pagesInChunk = [];
      for (let p = chunkStart; p <= chunkEnd; p++) {
        pagesInChunk.push(p);
      }

      const chunkMap = new Map();
      let activeIdx = 0;

      async function worker() {
        while (activeIdx < pagesInChunk.length) {
          if (signal.aborted) break;
          const idx = activeIdx++;
          const pageNo = pagesInChunk[idx];
          const bytes = await fetchPageImage(pageNo, currentDoc.token, signal);
          chunkMap.set(pageNo, bytes);
        }
      }

      const workers = [];
      const numWorkers = Math.min(CONCURRENCY, pagesInChunk.length);
      for (let w = 0; w < numWorkers; w++) {
        workers.push(worker());
      }
      await Promise.all(workers);

      if (signal.aborted) break;

      // Embed sequentially
      for (const p of pagesInChunk) {
        const imgBytes = chunkMap.get(p);
        if (!imgBytes) throw new Error(`Thiếu dữ liệu của trang ${p}`);

        await embedPageIntoPdf(pdfDoc, imgBytes);

        // Immediate memory disposal
        chunkMap.delete(p);

        completedPages++;
        updateProgressUI();
      }

      chunkMap.clear();
    }

    if (signal.aborted) {
      showMessage("Đã hủy quá trình tải bài giảng.", "info");
      return;
    }

    progressPages.textContent = "Đang đóng gói file PDF…";
    const pdfBytes = await pdfDoc.save();
    const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
    const downloadUrl = URL.createObjectURL(pdfBlob);

    await chrome.downloads.download({
      url: downloadUrl,
      filename: filename,
      saveAs: false,
    });

    setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);
    showMessage(`Đã tải xong ${completedPages} trang! File PDF đã được lưu vào Downloads.`, "ok");
  } catch (err) {
    if (err.name === "AbortError") {
      showMessage("Đã hủy tiến trình tải theo yêu cầu.", "info");
    } else if (err.message === "TOKEN_EXPIRED") {
      showMessage("⚠️ Token đã hết hạn (HTTP 403). Vui lòng nhấn F5 trên trang bài giảng để làm mới token rồi bấm Tải lại!", "err");
    } else {
      showMessage(`Lỗi: ${err.message || err}`, "err");
    }
  } finally {
    isDownloading = false;
    abortController = null;
    btnDownload.style.display = "flex";
    btnCancel.style.display = "none";
    inpStart.disabled = false;
    inpEnd.disabled = false;
    inpFilename.disabled = false;
  }
}

btnDownload.addEventListener("click", runDownloadPipeline);

btnCancel.addEventListener("click", () => {
  if (abortController) abortController.abort();
});

/**
 * Scan active tab and resolve total page count automatically
 */
async function performFullScan() {
  if (isDownloading) return;

  clearMessage();
  statusFound.style.display = "none";
  statusEmpty.style.display = "block";
  liveDot.classList.remove("active");
  emptyDesc.textContent = "Đang quét viewer CTUMP và tự động phát hiện số trang…";
  btnDownload.disabled = true;
  btnText.textContent = "Đang quét trang…";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      emptyDesc.textContent = "Không tìm thấy tab trình duyệt đang hoạt động.";
      return;
    }

    // Execute multi-tier DOM and Script scanner
    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: scanDocumentFramesMultiTier,
    });

    const candidates = [];
    for (const r of injectionResults) {
      const res = r.result;
      if (res && res.token) {
        candidates.push(res);
      }
    }

    if (candidates.length === 0) {
      emptyDesc.innerHTML = "Không tìm thấy bài giảng nào.<br>Hãy mở trang viewer đọc sách CTUMP rồi bấm Quét lại.";
      btnText.textContent = "Chưa tìm thấy bài giảng";
      liveDot.style.background = "var(--err)";
      return;
    }

    // Pick best candidate with token
    const best = candidates[0];

    // Determine total page count from Tiers 1, 2, 3
    let detectedTotal = 1;
    let detectionMethod = "DOM Viewer";

    if (best.totalFromScript && best.totalFromScript > 1) {
      detectedTotal = best.totalFromScript;
      detectionMethod = "Script Configs";
    } else if (best.totalFromToolbar && best.totalFromToolbar > 1) {
      detectedTotal = best.totalFromToolbar;
      detectionMethod = "Thanh công cụ Viewer";
    } else if (best.maxPageFromDomIds && best.maxPageFromDomIds > 1) {
      detectedTotal = best.maxPageFromDomIds;
      detectionMethod = "Khung trang DOM";
    } else if (best.maxPageFromImages && best.maxPageFromImages > 1) {
      detectedTotal = best.maxPageFromImages;
      detectionMethod = "Ảnh đã cuộn";
    }

    // Tier 4: If still <= 2 pages found (strict lazy load without placeholders), run Fast Binary Probe!
    if (detectedTotal <= 2 && best.token) {
      emptyDesc.textContent = "Đang tự động dò tìm chính xác trang cuối cùng (Fast Probe)…";
      try {
        const probed = await fastBinaryProbeTotalPages(best.start, best.token, null);
        if (probed && probed > detectedTotal) {
          detectedTotal = probed;
          detectionMethod = "Dò tìm tự động (Fast Probe)";
        }
      } catch (probeErr) {
        console.warn("Probe error:", probeErr);
      }
    }

    const docSpec = {
      token: best.token,
      start: best.start,
      end: detectedTotal,
      count: best.count,
      detectionMethod,
    };

    renderDocumentState(docSpec);
  } catch (err) {
    emptyDesc.textContent = `Lỗi quét tài liệu: ${err.message || err}`;
    btnText.textContent = "Lỗi kết nối tab";
  }
}

btnRefreshScan.addEventListener("click", performFullScan);

// Tab switch synchronization
chrome.tabs.onActivated.addListener(() => {
  if (!isDownloading) {
    performFullScan();
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!isDownloading && changeInfo.status === "complete" && tab.active) {
    performFullScan();
  }
});

// Run scan when sidebar opens
document.addEventListener("DOMContentLoaded", performFullScan);
