/**
 * EdgeCTUMP - PDF Downloader (Tài liệu CTUMP)
 * 100% Client-side JavaScript. No Python / No companion server required.
 * Features:
 *  - Professional Branding: "Tài liệu CTUMP"
 *  - 4-Tier Auto Page Detector (Zero-scroll needed)
 *  - Real-time Live Inspection Monitor (Instant token verification & live slide streaming)
 *  - Stream & Dispose Memory Management (Zero leak with rotating object URLs)
 */

// Configuration constants
const BASE_URL = "https://media.ctump.edu.vn/DocImage.axd";
const CONCURRENCY = 5;          // Concurrency limit for simultaneous image downloads
const CHUNK_SIZE = 15;          // Batch size for streaming memory disposal
const RETRY_MAX = 3;            // Max retries for transient network errors
const RETRIABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

// DOM Elements
const $ = (id) => document.getElementById(id);
const statusEmpty = $("status-empty");
const emptyText = $("empty-text");
const statusFound = $("status-found");
const liveDot = $("live-dot");
const scanLabel = $("scan-label");
const lectureTitleBox = $("lecture-title-box");
const dispLectureTitle = $("disp-lecture-title");
const dispToken = $("disp-token");
const dispSource = $("disp-source");
const dispTotalPages = $("disp-total-pages");
const liveThumb = $("live-thumb");
const thumbPlaceholder = $("thumb-placeholder");
const monitorOverlay = $("monitor-overlay");
const previewStatus = $("preview-status");
const previewPageTag = $("preview-page-tag");
const previewDimTag = $("preview-dim-tag");
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
let detectedData = null;
let abortController = null;
let isDownloading = false;
let currentThumbUrl = null;

// Utility: Message display
function showMessage(text, type = "info") {
  msgBox.textContent = text;
  msgBox.className = `msg-box ${type}`;
  msgBox.style.display = "block";
}

function clearMessage() {
  msgBox.style.display = "none";
  msgBox.textContent = "";
}

// Utility: Backoff delay with jitter
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getJitteredDelay(attempt) {
  const base = 400;
  return Math.min(2500, base * Math.pow(2, attempt - 1) + Math.random() * 250);
}

/**
 * Update the live inspection thumbnail, safely revoking the previous ObjectURL
 */
function updateLiveThumbnail(blob, pageNo, width, height, statusText, isError = false) {
  if (currentThumbUrl) {
    URL.revokeObjectURL(currentThumbUrl);
    currentThumbUrl = null;
  }
  currentThumbUrl = URL.createObjectURL(blob);
  liveThumb.src = currentThumbUrl;
  liveThumb.style.display = "block";
  thumbPlaceholder.style.display = "none";
  monitorOverlay.style.display = "flex";

  previewPageTag.textContent = `Trang ${pageNo}`;
  if (width && height) {
    previewDimTag.textContent = `${width} × ${height} px`;
  } else {
    const kb = (blob.size / 1024).toFixed(0);
    previewDimTag.textContent = `${kb} KB`;
  }

  previewStatus.textContent = statusText;
  previewStatus.className = isError ? "status-pill error" : "status-pill";
}

/**
 * Sanitize tab title into a clean, human-readable filename
 */
function sanitizeLectureTitle(rawTitle) {
  if (!rawTitle) return "";
  let clean = rawTitle
    .replace(/ - (?:Trường Đại học Y Dược Cần Thơ|CTUMP|Thư viện số.*)$/i, "")
    .replace(/ - Media CTUMP$/i, "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim();
  clean = clean.replace(/\s+/g, "_");
  return clean.slice(0, 50);
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
      const m = content.match(
        /(?:totalPages|total_pages|pageCount|page_count|numPages|maxPage|PageCount|TotalPage)\s*[:=]\s*["']?(\d+)["']?/i
      ) || content.match(/["'](?:TotalPages|PageCount|TotalPage)["']\s*:\s*(\d+)/i);

      if (m && m[1]) {
        const num = parseInt(m[1], 10);
        if (num > 1 && num < 10000) {
          totalFromScript = totalFromScript === null ? num : Math.max(totalFromScript, num);
        }
      }

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
  let low = knownStart;
  let high = Math.max(knownStart + 10, 20);

  // Exponential leap
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

  // Binary search
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
 * Fetch image bytes for a single page with retry and token expiration detection
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
 * Verify and preview the initial page to prove the token is live and content exists
 */
async function verifyAndPreviewInitialPage(page, token) {
  previewStatus.textContent = "Đang kiểm tra token…";
  previewStatus.className = "status-pill";
  liveThumb.style.display = "none";
  thumbPlaceholder.style.display = "flex";

  try {
    const bytes = await fetchPageImage(page, token, null);
    const blob = new Blob([bytes], { type: "image/png" });

    // Load into Image to inspect natural dimensions
    const tempImg = new Image();
    const tempUrl = URL.createObjectURL(blob);
    tempImg.onload = () => {
      updateLiveThumbnail(blob, page, tempImg.naturalWidth, tempImg.naturalHeight, "Token hợp lệ ✓", false);
      URL.revokeObjectURL(tempUrl);
    };
    tempImg.onerror = () => {
      updateLiveThumbnail(blob, page, null, null, "Đã nạp ảnh ✓", false);
      URL.revokeObjectURL(tempUrl);
    };
    tempImg.src = tempUrl;
  } catch (err) {
    if (err.message === "TOKEN_EXPIRED") {
      previewStatus.textContent = "Token hết hạn ✗";
      previewStatus.className = "status-pill error";
      thumbPlaceholder.innerHTML = `<span style="color:var(--err)">⚠️ Token đã hết hạn (403).<br>Nhấn F5 trên bài giảng để làm mới!</span>`;
      btnDownload.disabled = true;
      btnText.textContent = "Token hết hạn (Nhấn F5)";
    } else {
      previewStatus.textContent = "Lỗi nạp ảnh ✗";
      previewStatus.className = "status-pill error";
      thumbPlaceholder.innerHTML = `<span style="color:var(--err)">Không thể nạp ảnh trang ${page}: ${err.message}</span>`;
    }
  }
}

/**
 * Render detected document information in popup
 */
function renderDetected(data) {
  detectedData = data;
  statusEmpty.style.display = "none";
  statusFound.style.display = "block";
  liveDot.classList.add("active");
  scanLabel.textContent = "ĐÃ KẾT NỐI BÀI GIẢNG";

  // Lecture title display
  if (data.lectureTitle) {
    lectureTitleBox.style.display = "block";
    dispLectureTitle.textContent = data.lectureTitle;
  } else {
    lectureTitleBox.style.display = "none";
  }

  dispToken.textContent = `${data.token.slice(0, 8)}…${data.token.slice(-4)}`;
  dispSource.textContent = data.detectionMethod || "Tự động";
  dispTotalPages.textContent = `${data.end} trang`;

  inpStart.value = data.start;
  inpStart.min = 1;
  inpStart.max = data.end;

  inpEnd.value = data.end;
  inpEnd.min = data.start;
  inpEnd.max = 9999;

  // Build smart default filename
  const prefix = data.lectureSlug ? `${data.lectureSlug}_` : "CTUMP_";
  inpFilename.value = `${prefix}Trang_${data.start}-${data.end}.pdf`;

  // Render visual strip
  rangeStrip.innerHTML = "";
  const total = data.end - data.start + 1;
  const numTicks = Math.min(total, 50);
  for (let i = 0; i < numTicks; i++) {
    const tick = document.createElement("i");
    if ((i / numTicks) * total < Math.max(data.count, total)) {
      tick.className = "hit";
    }
    rangeStrip.appendChild(tick);
  }

  btnDownload.disabled = false;
  btnText.textContent = `Tải bài giảng (${data.start} → ${data.end})`;

  // Trigger initial live preview verification
  verifyAndPreviewInitialPage(data.start, data.token);
}

/**
 * Update button label on input change
 */
function updateButtonLabel() {
  const start = parseInt(inpStart.value, 10);
  const end = parseInt(inpEnd.value, 10);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < start) {
    btnDownload.disabled = true;
    btnText.textContent = "Dải trang không hợp lệ";
  } else {
    btnDownload.disabled = false;
    btnText.textContent = `Tải bài giảng (${start} → ${end})`;
  }
}

inpStart.addEventListener("input", updateButtonLabel);
inpEnd.addEventListener("input", updateButtonLabel);

/**
 * Embed image data into PDF document, detecting PNG vs JPEG
 */
async function embedImageIntoPdf(pdfDoc, imageBytes) {
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
 * Execute downloading and PDF generation directly in popup (Stream & Dispose)
 */
async function executeDownload() {
  if (isDownloading) return;

  const startPage = parseInt(inpStart.value, 10);
  const endPage = parseInt(inpEnd.value, 10);
  let filename = (inpFilename.value || `CTUMP_${startPage}-${endPage}.pdf`).trim();
  if (!filename.toLowerCase().endsWith(".pdf")) {
    filename += ".pdf";
  }

  if (!Number.isFinite(startPage) || !Number.isFinite(endPage) || startPage < 1 || endPage < startPage) {
    showMessage("Vui lòng nhập dải trang hợp lệ (Trang bắt đầu ≤ Trang kết thúc).", "err");
    return;
  }

  if (!detectedData || !detectedData.token) {
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

  function updateProgress() {
    const pct = Math.floor((completedPages / totalPages) * 100);
    progressPct.textContent = `${pct}%`;
    progressBarFill.style.width = `${pct}%`;
    progressPages.textContent = `Đã xuất: ${completedPages} / ${totalPages} trang`;

    const elapsedSec = (Date.now() - startTime) / 1000;
    if (completedPages > 0 && elapsedSec > 0.5) {
      const speed = (completedPages / elapsedSec).toFixed(1);
      progressSpeed.textContent = `~${speed} trang/s`;
    }
  }

  try {
    updateProgress();
    const pdfDoc = await PDFLib.PDFDocument.create();

    // Process pages in sequential chunks to bound memory usage
    for (let chunkStart = startPage; chunkStart <= endPage; chunkStart += CHUNK_SIZE) {
      if (signal.aborted) break;

      const chunkEnd = Math.min(chunkStart + CHUNK_SIZE - 1, endPage);
      const pageNumbers = [];
      for (let p = chunkStart; p <= chunkEnd; p++) {
        pageNumbers.push(p);
      }

      const chunkBuffers = new Map();
      let activeIndex = 0;

      async function poolWorker() {
        while (activeIndex < pageNumbers.length) {
          if (signal.aborted) break;
          const idx = activeIndex++;
          const p = pageNumbers[idx];
          const imgBytes = await fetchPageImage(p, detectedData.token, signal);
          chunkBuffers.set(p, imgBytes);

          // Update real-time monitor thumbnail with the freshly fetched slide!
          try {
            const pageBlob = new Blob([imgBytes], { type: "image/png" });
            updateLiveThumbnail(pageBlob, p, null, null, `Đang xử lý trang ${p}…`, false);
          } catch (_) {}
        }
      }

      const workers = [];
      const numWorkers = Math.min(CONCURRENCY, pageNumbers.length);
      for (let w = 0; w < numWorkers; w++) {
        workers.push(poolWorker());
      }
      await Promise.all(workers);

      if (signal.aborted) break;

      // Embed each page in sequential order into pdfDoc
      for (const p of pageNumbers) {
        const imgBytes = chunkBuffers.get(p);
        if (!imgBytes) throw new Error(`Thiếu dữ liệu của trang ${p}`);

        await embedImageIntoPdf(pdfDoc, imgBytes);

        // Memory cleanup: immediately delete reference from map
        chunkBuffers.delete(p);

        completedPages++;
        updateProgress();
      }

      chunkBuffers.clear();
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
    previewStatus.textContent = "Đã xuất PDF ✓";
    showMessage(`Đã tải thành công ${completedPages} trang! File PDF đã được lưu vào thư mục Downloads.`, "ok");
  } catch (err) {
    if (err.name === "AbortError") {
      showMessage("Đã hủy quá trình tải bài giảng.", "info");
    } else if (err.message === "TOKEN_EXPIRED") {
      previewStatus.textContent = "Token hết hạn ✗";
      previewStatus.className = "status-pill error";
      showMessage("⚠️ Token bài giảng đã hết hạn (HTTP 403). Vui lòng nhấn F5 trên trang bài giảng để làm mới token rồi bấm Tải lại!", "err");
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

btnDownload.addEventListener("click", executeDownload);

btnCancel.addEventListener("click", () => {
  if (abortController) abortController.abort();
});

/**
 * Scan active tab and resolve total page count automatically
 */
async function performPopupScan() {
  if (isDownloading) return;

  clearMessage();
  statusFound.style.display = "none";
  statusEmpty.style.display = "block";
  liveDot.classList.remove("active");
  emptyText.textContent = "Đang kết nối bài giảng và kiểm tra số trang…";
  btnDownload.disabled = true;
  btnText.textContent = "Đang quét trang…";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      emptyText.textContent = "Không tìm thấy tab trình duyệt đang hoạt động.";
      return;
    }

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
      emptyText.innerHTML = "Không tìm thấy bài giảng nào.<br>Hãy mở trang đọc sách trong viewer CTUMP rồi bấm Quét lại.";
      btnText.textContent = "Chưa tìm thấy bài giảng";
      liveDot.style.background = "var(--err)";
      return;
    }

    const best = candidates[0];

    // Extract lecture title from tab title
    const lectureTitle = tab.title ? tab.title.replace(/ - (?:Trường Đại học Y Dược Cần Thơ|CTUMP|Thư viện số.*)$/i, "").trim() : "";
    const lectureSlug = sanitizeLectureTitle(lectureTitle);

    // Determine total page count from Tiers 1, 2, 3
    let detectedTotal = 1;
    let detectionMethod = "DOM Viewer";

    if (best.totalFromScript && best.totalFromScript > 1) {
      detectedTotal = best.totalFromScript;
      detectionMethod = "Script Configs";
    } else if (best.totalFromToolbar && best.totalFromToolbar > 1) {
      detectedTotal = best.totalFromToolbar;
      detectionMethod = "Thanh công cụ";
    } else if (best.maxPageFromDomIds && best.maxPageFromDomIds > 1) {
      detectedTotal = best.maxPageFromDomIds;
      detectionMethod = "Khung trang DOM";
    } else if (best.maxPageFromImages && best.maxPageFromImages > 1) {
      detectedTotal = best.maxPageFromImages;
      detectionMethod = "Ảnh đã cuộn";
    }

    // Tier 4: Fast Binary Probe if <= 2 pages found
    if (detectedTotal <= 2 && best.token) {
      emptyText.textContent = "Đang tự động dò tìm trang cuối (Fast Probe)…";
      try {
        const probed = await fastBinaryProbeTotalPages(best.start, best.token, null);
        if (probed && probed > detectedTotal) {
          detectedTotal = probed;
          detectionMethod = "Dò tìm tự động (Probe)";
        }
      } catch (probeErr) {
        console.warn("Probe error:", probeErr);
      }
    }

    renderDetected({
      token: best.token,
      start: best.start,
      end: detectedTotal,
      count: best.count,
      detectionMethod,
      lectureTitle,
      lectureSlug,
    });
  } catch (err) {
    emptyText.textContent = `Lỗi quét bài giảng: ${err.message || err}`;
    btnText.textContent = "Lỗi kết nối bài giảng";
  }
}

if (btnRefreshScan) {
  btnRefreshScan.addEventListener("click", performPopupScan);
}

// Clean up object URLs on unload
window.addEventListener("unload", () => {
  if (currentThumbUrl) {
    URL.revokeObjectURL(currentThumbUrl);
  }
});

// Auto-run scanner on DOM load
document.addEventListener("DOMContentLoaded", performPopupScan);
