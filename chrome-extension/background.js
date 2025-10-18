// Background Service Worker for CTUMP PDF Downloader Extension
// Handles background tasks and extension lifecycle

console.log('CTUMP PDF Downloader service worker started');

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
    
    // Call API to add document
    const response = await fetch(`${apiUrl}/api/add-doc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(document)
    });
    
    const data = await response.json();
    sendResponse({ success: data.success, message: data.message });
  } catch (error) {
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
