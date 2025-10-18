// Popup JavaScript for CTUMP PDF Downloader Extension
// Handles UI interactions and API calls

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
  const apiUrl = document.getElementById('apiUrl').value;
  logMessage('Testing connection...', 'info');
  
  try {
    const response = await fetch(`${apiUrl}/`, {
      method: 'GET',
      mode: 'cors'
    });
    
    if (response.ok) {
      showStatus('Connection successful!', 'success');
      logMessage('✓ API server is reachable', 'success');
    } else {
      showStatus(`Connection failed: ${response.status}`, 'error');
      logMessage(`✗ Server returned ${response.status}`, 'error');
    }
  } catch (error) {
    showStatus('Connection failed: ' + error.message, 'error');
    logMessage('✗ Cannot reach API server. Make sure it is running.', 'error');
  }
});

// Auto-detect token from viewer URL
document.getElementById('autoDetect').addEventListener('click', async () => {
  const viewerUrl = document.getElementById('viewerUrl').value.trim();
  
  if (!viewerUrl) {
    showStatus('Please enter a viewer URL', 'error');
    return;
  }
  
  const apiUrl = document.getElementById('apiUrl').value;
  logMessage('Auto-detecting token...', 'info');
  
  try {
    const response = await fetch(`${apiUrl}/api/detect-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ viewer_url: viewerUrl })
    });
    
    const data = await response.json();
    
    if (data.success && data.token) {
      document.getElementById('token').value = data.token;
      showStatus('Token detected successfully!', 'success');
      logMessage(`✓ Token: ${data.token}`, 'success');
    } else {
      showStatus('Failed to detect token', 'error');
      logMessage('✗ ' + (data.message || 'Token not found'), 'error');
    }
  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
    logMessage('✗ Failed to detect token', 'error');
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
  
  const apiUrl = document.getElementById('apiUrl').value;
  logMessage(`Adding document: ${filename}...`, 'info');
  
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
    
    const data = await response.json();
    
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
    showStatus('Error: ' + error.message, 'error');
    logMessage('✗ Failed to add document', 'error');
  }
});

// Start processing
document.getElementById('startProcessing').addEventListener('click', async () => {
  const apiUrl = document.getElementById('apiUrl').value;
  logMessage('Starting processing...', 'info');
  
  try {
    const response = await fetch(`${apiUrl}/api/start`, {
      method: 'POST'
    });
    
    const data = await response.json();
    
    if (data.success) {
      showStatus('Processing started!', 'success');
      logMessage('✓ Processing queue started', 'success');
      logMessage('Check the API server logs for progress', 'info');
    } else {
      showStatus('Failed to start processing', 'error');
      logMessage('✗ ' + (data.message || 'Unknown error'), 'error');
    }
  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
    logMessage('✗ Failed to start processing', 'error');
  }
});

// View queue (open API server in new tab)
document.getElementById('viewQueue').addEventListener('click', () => {
  const apiUrl = document.getElementById('apiUrl').value;
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
