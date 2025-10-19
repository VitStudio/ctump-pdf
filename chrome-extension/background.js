// Background Service Worker for CTUMP PDF Downloader Extension
// Handles background tasks and extension lifecycle

console.log('CTUMP PDF Downloader service worker started');

// Helper function to normalize API URL by removing trailing slashes
function normalizeApiUrl(url) {
  if (!url) return url;
  // Remove trailing slashes
  return url.replace(/\/+$/, '');
}

// Helper function to safely parse JSON responses with proper error logging
async function safeJsonParse(response, context = '') {
  const contentType = response.headers.get('content-type');
  
  // Log response details for debugging
  console.log(`[${context}] Response status:`, response.status, response.statusText);
  console.log(`[${context}] Content-Type:`, contentType);
  
  // Check if response is actually JSON
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    console.error(`[${context}] Expected JSON but got:`, contentType);
    console.error(`[${context}] Response body (first 500 chars):`, text.substring(0, 500));
    
    // Try to provide a helpful error message
    if (text.includes('<!doctype') || text.includes('<!DOCTYPE')) {
      throw new Error(`Server returned HTML instead of JSON. Is the API server running at the correct URL? Response: ${text.substring(0, 100)}...`);
    } else {
      throw new Error(`Server returned non-JSON response. Content-Type: ${contentType}. Body: ${text.substring(0, 100)}...`);
    }
  }
  
  try {
    const data = await response.json();
    console.log(`[${context}] Parsed JSON successfully:`, data);
    return data;
  } catch (error) {
    console.error(`[${context}] Failed to parse JSON:`, error);
    const text = await response.text();
    console.error(`[${context}] Raw response:`, text);
    throw new Error(`Failed to parse JSON response: ${error.message}`);
  }
}

// Listen for extension installation or updates
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installed');
    // Set default API URL
    chrome.storage.sync.set({ 
      apiUrl: 'http://localhost:5000' 
    });
  } else if (details.reason === 'update') {
    console.log('Extension updated');
  }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);
  
  if (request.action === 'getToken') {
    // Could be used to extract token from page
    handleTokenExtraction(request, sendResponse);
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'processDocument') {
    // Handle document processing request
    handleDocumentProcessing(request, sendResponse);
    return true;
  }
});

// Handle token extraction
async function handleTokenExtraction(request, sendResponse) {
  try {
    // This would communicate with content script to extract token
    sendResponse({ success: true, token: request.token });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Handle document processing
async function handleDocumentProcessing(request, sendResponse) {
  try {
    const { apiUrl, document } = request;
    console.log('[Document Processing] Request:', { apiUrl, document });
    
    // Normalize API URL to prevent double slashes
    const normalizedApiUrl = normalizeApiUrl(apiUrl);
    
    // Call API to add document
    const response = await fetch(`${normalizedApiUrl}/api/add-doc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(document)
    });
    
    const data = await safeJsonParse(response, 'Document Processing');
    sendResponse({ success: data.success, message: data.message });
  } catch (error) {
    console.error('[Document Processing] Error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Keep service worker alive (optional, for long-running operations)
let keepAliveInterval;

function startKeepAlive() {
  keepAliveInterval = setInterval(() => {
    console.log('Service worker keep-alive ping');
  }, 20000); // Ping every 20 seconds
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
}

// Start keep-alive when needed
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'keepAlive') {
    startKeepAlive();
    port.onDisconnect.addListener(stopKeepAlive);
  }
});
