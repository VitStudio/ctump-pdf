// Popup JavaScript for CTUMP PDF Downloader Extension
// Handles UI interactions and API calls

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
    
    // Create detailed error for UI display
    const errorDetails = {
      status: response.status,
      statusText: response.statusText,
      contentType: contentType,
      responseBody: text
    };
    
    // Try to provide a helpful error message
    if (text.includes('<!doctype') || text.includes('<!DOCTYPE')) {
      const error = new Error(`Server returned HTML instead of JSON. Is the API server running at the correct URL?`);
      error.details = errorDetails;
      throw error;
    } else {
      const error = new Error(`Server returned non-JSON response.`);
      error.details = errorDetails;
      throw error;
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
    
    const parseError = new Error(`Failed to parse JSON response: ${error.message}`);
    parseError.details = {
      status: response.status,
      statusText: response.statusText,
      contentType: contentType,
      responseBody: text
    };
    throw parseError;
  }
}

// Load saved API URL on popup open
document.addEventListener('DOMContentLoaded', async () => {
  const result = await chrome.storage.sync.get(['apiUrl']);
  if (result.apiUrl) {
    document.getElementById('apiUrl').value = result.apiUrl;
  }
  
  // Try to auto-fill from current page if it's a CTUMP page
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab.url && tab.url.includes('ctump.edu.vn')) {
    logMessage('CTUMP page detected', 'info');
  }
});

// Save API URL when changed
document.getElementById('apiUrl').addEventListener('change', async (e) => {
  await chrome.storage.sync.set({ apiUrl: e.target.value });
});

// Test API connection
document.getElementById('testConnection').addEventListener('click', async () => {
  const apiUrl = normalizeApiUrl(document.getElementById('apiUrl').value);
  logMessage('Testing connection...', 'info');
  console.log('[Test Connection] Testing API at:', apiUrl);
  
  try {
    const response = await fetch(`${apiUrl}/`, {
      method: 'GET',
      mode: 'cors'
    });
    
    console.log('[Test Connection] Response received:', response.status, response.statusText);
    
    if (response.ok) {
      showStatus('Connection successful!', 'success');
      logMessage('✓ API server is reachable', 'success');
      logMessage(`  ↳ Status: ${response.status} ${response.statusText}`, 'success');
    } else {
      showStatus(`Connection failed: ${response.status}`, 'error');
      logMessage(`✗ Server returned ${response.status}`, 'error');
      logMessage(`  ↳ Status: ${response.status} ${response.statusText}`, 'error');
    }
  } catch (error) {
    console.error('[Test Connection] Connection error:', error);
    showStatus('Connection failed: ' + error.message, 'error');
    logDetailedError('Test Connection', error, {
      url: `${apiUrl}/`,
      status: error.details?.status,
      statusText: error.details?.statusText,
      contentType: error.details?.contentType,
      responseBody: error.details?.responseBody
    });
  }
});

// Auto-detect token from viewer URL
document.getElementById('autoDetect').addEventListener('click', async () => {
  const viewerUrl = document.getElementById('viewerUrl').value.trim();
  
  if (!viewerUrl) {
    showStatus('Please enter a viewer URL', 'error');
    return;
  }
  
  const apiUrl = normalizeApiUrl(document.getElementById('apiUrl').value);
  logMessage('Auto-detecting token...', 'info');
  console.log('[Auto Detect] Requesting token detection for URL:', viewerUrl);
  
  try {
    const response = await fetch(`${apiUrl}/api/detect-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ viewer_url: viewerUrl })
    });
    
    const data = await safeJsonParse(response, 'Auto Detect Token');
    
    if (data.success && data.token) {
      document.getElementById('token').value = data.token;
      showStatus('Token detected successfully!', 'success');
      logMessage(`✓ Token: ${data.token}`, 'success');
    } else {
      showStatus('Failed to detect token', 'error');
      logMessage('✗ ' + (data.message || 'Token not found'), 'error');
    }
  } catch (error) {
    console.error('[Auto Detect] Error:', error);
    showStatus('Error: ' + error.message, 'error');
    logDetailedError('Auto Detect Token', error, {
      url: `${apiUrl}/api/detect-token`,
      status: error.details?.status,
      statusText: error.details?.statusText,
      contentType: error.details?.contentType,
      responseBody: error.details?.responseBody
    });
  }
});

// Add document to queue
document.getElementById('addDocument').addEventListener('click', async () => {
  const token = document.getElementById('token').value.trim();
  const startPage = parseInt(document.getElementById('startPage').value);
  const endPage = parseInt(document.getElementById('endPage').value);
  const filename = document.getElementById('filename').value.trim();
  
  // Validation
  if (!token) {
    showStatus('Please enter a token', 'error');
    return;
  }
  
  if (!filename) {
    showStatus('Please enter a filename', 'error');
    return;
  }
  
  if (startPage < 1 || endPage < 1 || startPage > endPage) {
    showStatus('Invalid page range', 'error');
    return;
  }
  
  const apiUrl = normalizeApiUrl(document.getElementById('apiUrl').value);
  logMessage(`Adding document: ${filename}...`, 'info');
  console.log('[Add Document] Request:', { token, startPage, endPage, filename });
  
  try {
    const response = await fetch(`${apiUrl}/api/add-doc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: token,
        start_page: startPage,
        end_page: endPage,
        output_filename: filename.endsWith('.pdf') ? filename : filename + '.pdf'
      })
    });
    
    const data = await safeJsonParse(response, 'Add Document');
    
    if (data.success) {
      showStatus('Document added to queue!', 'success');
      logMessage(`✓ Added: ${filename} (pages ${startPage}-${endPage})`, 'success');
      
      // Clear form after successful add
      document.getElementById('token').value = '';
      document.getElementById('startPage').value = '1';
      document.getElementById('endPage').value = '1';
      document.getElementById('filename').value = '';
      document.getElementById('viewerUrl').value = '';
    } else {
      showStatus('Failed to add document', 'error');
      logMessage('✗ ' + (data.message || 'Unknown error'), 'error');
    }
  } catch (error) {
    console.error('[Add Document] Error:', error);
    showStatus('Error: ' + error.message, 'error');
    logDetailedError('Add Document', error, {
      url: `${apiUrl}/api/add-doc`,
      status: error.details?.status,
      statusText: error.details?.statusText,
      contentType: error.details?.contentType,
      responseBody: error.details?.responseBody
    });
  }
});

// Start processing
document.getElementById('startProcessing').addEventListener('click', async () => {
  const apiUrl = normalizeApiUrl(document.getElementById('apiUrl').value);
  logMessage('Starting processing...', 'info');
  console.log('[Start Processing] Sending start request to:', apiUrl);
  
  try {
    const response = await fetch(`${apiUrl}/api/start`, {
      method: 'POST'
    });
    
    const data = await safeJsonParse(response, 'Start Processing');
    
    if (data.success) {
      showStatus('Processing started!', 'success');
      logMessage('✓ Processing queue started', 'success');
      logMessage('Check the API server logs for progress', 'info');
    } else {
      showStatus('Failed to start processing', 'error');
      logMessage('✗ ' + (data.message || 'Unknown error'), 'error');
    }
  } catch (error) {
    console.error('[Start Processing] Error:', error);
    showStatus('Error: ' + error.message, 'error');
    logDetailedError('Start Processing', error, {
      url: `${apiUrl}/api/start`,
      status: error.details?.status,
      statusText: error.details?.statusText,
      contentType: error.details?.contentType,
      responseBody: error.details?.responseBody
    });
  }
});

// View queue (open API server in new tab)
document.getElementById('viewQueue').addEventListener('click', () => {
  const apiUrl = normalizeApiUrl(document.getElementById('apiUrl').value);
  chrome.tabs.create({ url: apiUrl });
});

// Fill from current page
document.getElementById('fillFromPage').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (tab.url && tab.url.includes('ctump.edu.vn')) {
    document.getElementById('viewerUrl').value = tab.url;
    logMessage('✓ Filled viewer URL from current page', 'info');
    
    // Try to extract token from URL if present
    const urlParams = new URLSearchParams(new URL(tab.url).search);
    const token = urlParams.get('token');
    if (token) {
      document.getElementById('token').value = token;
      logMessage('✓ Token extracted from URL', 'success');
    }
  } else {
    showStatus('Current page is not a CTUMP page', 'error');
  }
});

// Clear form
document.getElementById('clearForm').addEventListener('click', () => {
  document.getElementById('viewerUrl').value = '';
  document.getElementById('token').value = '';
  document.getElementById('startPage').value = '1';
  document.getElementById('endPage').value = '1';
  document.getElementById('filename').value = '';
  document.getElementById('status').textContent = '';
  logMessage('Form cleared', 'info');
});

// Helper functions
function showStatus(message, type = 'info') {
  const statusEl = document.getElementById('connectionStatus');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  
  // Auto-clear after 5 seconds
  setTimeout(() => {
    statusEl.textContent = '';
    statusEl.className = 'status';
  }, 5000);
}

function logMessage(message, type = 'info') {
  const statusEl = document.getElementById('status');
  const timestamp = new Date().toLocaleTimeString();
  const prefix = type === 'success' ? '✓' : type === 'error' ? '✗' : '•';
  
  const logEntry = `[${timestamp}] ${prefix} ${message}\n`;
  statusEl.textContent = logEntry + statusEl.textContent;
  
  // Limit log size
  const lines = statusEl.textContent.split('\n');
  if (lines.length > 20) {
    statusEl.textContent = lines.slice(0, 20).join('\n');
  }
}

// Enhanced logging function to display detailed error information in UI
function logDetailedError(context, error, details = {}) {
  const timestamp = new Date().toLocaleTimeString();
  
  // Log main error message
  logMessage(`${context}: ${error.message}`, 'error');
  
  // Log individual details if provided
  if (details.status) {
    logMessage(`  ↳ Status: ${details.status} ${details.statusText || ''}`, 'error');
  }
  if (details.contentType) {
    logMessage(`  ↳ Content-Type: ${details.contentType}`, 'error');
  }
  if (details.responseBody) {
    const preview = details.responseBody.substring(0, 100);
    logMessage(`  ↳ Response: ${preview}${details.responseBody.length > 100 ? '...' : ''}`, 'error');
  }
  if (details.url) {
    logMessage(`  ↳ URL: ${details.url}`, 'error');
  }
  
  // Also log to console for developers
  console.error(`[${context}]`, error, details);
}
