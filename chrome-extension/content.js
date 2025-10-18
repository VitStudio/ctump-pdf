// Content Script for CTUMP PDF Downloader Extension
// Runs on CTUMP pages to extract information

console.log('CTUMP PDF Downloader content script loaded');

// Extract token from current page
function extractTokenFromPage() {
  // Try to get token from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  let token = urlParams.get('token');
  
  if (token) {
    return token;
  }
  
  // Try to find token in page scripts or variables
  const scripts = document.getElementsByTagName('script');
  for (let script of scripts) {
    const content = script.textContent || script.innerText;
    
    // Look for token pattern (UUID format)
    const tokenMatch = content.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (tokenMatch) {
      return tokenMatch[0];
    }
    
    // Look for token in specific variable patterns
    const varMatch = content.match(/token\s*[:=]\s*["']([^"']+)["']/i);
    if (varMatch && varMatch[1]) {
      return varMatch[1];
    }
  }
  
  return null;
}

// Extract document information from page
function extractDocumentInfo() {
  const token = extractTokenFromPage();
  const viewerUrl = window.location.href;
  
  // Try to extract page count or other metadata
  const pageInfo = {
    token: token,
    viewerUrl: viewerUrl,
    currentPage: getCurrentPage(),
    totalPages: getTotalPages()
  };
  
  return pageInfo;
}

// Get current page number from URL or page elements
function getCurrentPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const page = urlParams.get('page');
  return page ? parseInt(page) : 1;
}

// Try to find total pages from page elements
function getTotalPages() {
  // This would need to be adapted based on actual CTUMP page structure
  // Look for pagination elements, page counters, etc.
  
  // Example: look for elements with class or id containing "page" or "total"
  const pageElements = document.querySelectorAll('[class*="page"], [id*="page"]');
  
  for (let elem of pageElements) {
    const text = elem.textContent;
    // Look for patterns like "Page 1 of 50" or "1/50"
    const match = text.match(/(\d+)\s*(?:of|\/)\s*(\d+)/i);
    if (match && match[2]) {
      return parseInt(match[2]);
    }
  }
  
  return null;
}

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractInfo') {
    const info = extractDocumentInfo();
    sendResponse({ success: true, info: info });
  }
  
  if (request.action === 'extractToken') {
    const token = extractTokenFromPage();
    sendResponse({ success: true, token: token });
  }
  
  return true; // Keep message channel open
});

// Auto-notify when token is detected on page load
window.addEventListener('load', () => {
  const token = extractTokenFromPage();
  if (token) {
    console.log('Token detected on page:', token);
    
    // Could send notification to extension
    chrome.runtime.sendMessage({
      action: 'tokenDetected',
      token: token,
      url: window.location.href
    });
  }
});

// Add visual indicator when extension is active (optional)
function addExtensionIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'ctump-pdf-extension-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #213448;
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-family: Tahoma, sans-serif;
    font-size: 12px;
    z-index: 10000;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  `;
  indicator.textContent = '📄 CTUMP PDF Extension Active';
  
  document.body.appendChild(indicator);
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    indicator.style.opacity = '0';
    indicator.style.transition = 'opacity 0.5s';
    setTimeout(() => indicator.remove(), 500);
  }, 3000);
}

// Show indicator if on CTUMP page
if (window.location.href.includes('ctump.edu.vn')) {
  addExtensionIndicator();
}
