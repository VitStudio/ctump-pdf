# API Integration Examples

This document provides examples of how to integrate with the CTUMP PDF API from the Chrome extension or other applications.

## Table of Contents

- [API Endpoints](#api-endpoints)
- [JavaScript Examples](#javascript-examples)
- [cURL Examples](#curl-examples)
- [Response Format](#response-format)

## API Endpoints

All endpoints are relative to the base URL (default: `http://localhost:5000`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Main web interface |
| `/api/detect-token` | POST | Auto-detect token from viewer URL |
| `/api/add-doc` | POST | Add document to processing queue |
| `/api/remove-doc/<index>` | DELETE | Remove document from queue |
| `/api/clear` | POST | Clear all documents from queue |
| `/api/start` | POST | Start processing documents |
| `/api/cancel` | POST | Cancel processing |
| `/download/<filename>` | GET | Download generated PDF |

## JavaScript Examples

### 1. Test Connection

```javascript
async function testConnection(apiUrl) {
  try {
    const response = await fetch(`${apiUrl}/`, {
      method: 'GET',
      mode: 'cors'
    });
    
    if (response.ok) {
      console.log('✓ API server is reachable');
      return true;
    } else {
      console.error('✗ Server returned', response.status);
      return false;
    }
  } catch (error) {
    console.error('✗ Connection failed:', error.message);
    return false;
  }
}

// Usage
testConnection('http://localhost:5000');
```

### 2. Auto-Detect Token

```javascript
async function detectToken(apiUrl, viewerUrl) {
  const response = await fetch(`${apiUrl}/api/detect-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ viewer_url: viewerUrl })
  });
  
  const data = await response.json();
  
  if (data.success && data.token) {
    console.log('Token detected:', data.token);
    return data.token;
  } else {
    console.error('Failed to detect token:', data.error || data.message);
    return null;
  }
}

// Usage
const token = await detectToken(
  'http://localhost:5000',
  'https://media.ctump.edu.vn/viewer?token=abc-123'
);
```

### 3. Add Document to Queue

```javascript
async function addDocument(apiUrl, document) {
  const response = await fetch(`${apiUrl}/api/add-doc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: document.token,
      start_page: document.startPage,
      end_page: document.endPage,
      output_filename: document.filename
    })
  });
  
  const data = await response.json();
  
  if (data.success) {
    console.log('✓ Document added to queue');
    return true;
  } else {
    console.error('✗ Failed to add document:', data.message);
    return false;
  }
}

// Usage
await addDocument('http://localhost:5000', {
  token: '12345678-1234-1234-1234-123456789abc',
  startPage: 1,
  endPage: 10,
  filename: 'my-document.pdf'
});
```

### 4. Start Processing

```javascript
async function startProcessing(apiUrl) {
  const response = await fetch(`${apiUrl}/api/start`, {
    method: 'POST'
  });
  
  const data = await response.json();
  
  if (data.success) {
    console.log('✓ Processing started');
    return true;
  } else {
    console.error('✗ Failed to start processing:', data.message);
    return false;
  }
}

// Usage
await startProcessing('http://localhost:5000');
```

### 5. Complete Workflow Example

```javascript
async function downloadDocument(apiUrl, viewerUrl, startPage, endPage, filename) {
  try {
    // 1. Test connection
    console.log('Testing connection...');
    const connected = await testConnection(apiUrl);
    if (!connected) {
      throw new Error('Cannot connect to API server');
    }
    
    // 2. Detect token
    console.log('Detecting token...');
    const token = await detectToken(apiUrl, viewerUrl);
    if (!token) {
      throw new Error('Failed to detect token');
    }
    
    // 3. Add document
    console.log('Adding document to queue...');
    const added = await addDocument(apiUrl, {
      token: token,
      startPage: startPage,
      endPage: endPage,
      filename: filename
    });
    if (!added) {
      throw new Error('Failed to add document');
    }
    
    // 4. Start processing
    console.log('Starting processing...');
    const started = await startProcessing(apiUrl);
    if (!started) {
      throw new Error('Failed to start processing');
    }
    
    console.log('✓ Document queued for processing!');
    console.log('Check the API server logs for progress.');
    
    return true;
  } catch (error) {
    console.error('Error:', error.message);
    return false;
  }
}

// Usage
downloadDocument(
  'http://localhost:5000',
  'https://media.ctump.edu.vn/viewer?page=1&token=abc-123',
  1,
  20,
  'my-document.pdf'
);
```

## cURL Examples

### Test Connection

```bash
curl http://localhost:5000/
```

### Auto-Detect Token

```bash
curl -X POST http://localhost:5000/api/detect-token \
  -H "Content-Type: application/json" \
  -d '{
    "viewer_url": "https://media.ctump.edu.vn/viewer?token=abc-123"
  }'
```

### Add Document

```bash
curl -X POST http://localhost:5000/api/add-doc \
  -H "Content-Type: application/json" \
  -d '{
    "token": "12345678-1234-1234-1234-123456789abc",
    "start_page": 1,
    "end_page": 10,
    "output_filename": "my-document.pdf"
  }'
```

### Remove Document

```bash
curl -X DELETE http://localhost:5000/api/remove-doc/0
```

### Clear All Documents

```bash
curl -X POST http://localhost:5000/api/clear
```

### Start Processing

```bash
curl -X POST http://localhost:5000/api/start
```

### Cancel Processing

```bash
curl -X POST http://localhost:5000/api/cancel
```

### Download PDF

```bash
curl -O http://localhost:5000/download/my-document.pdf
```

## Response Format

All API endpoints return JSON responses with the following format:

### Success Response

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error description",
  "message": "User-friendly error message"
}
```

### Detect Token Response

```json
{
  "success": true,
  "token": "12345678-1234-1234-1234-123456789abc"
}
```

## Error Handling

Always wrap API calls in try-catch blocks:

```javascript
try {
  const response = await fetch(`${apiUrl}/api/add-doc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(document)
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || data.message || 'Unknown error');
  }
  
  // Success!
  return data;
} catch (error) {
  console.error('API Error:', error.message);
  // Handle error appropriately
}
```

## CORS Considerations

If accessing the API from a different origin, ensure CORS is configured:

```javascript
// The API server should have CORS enabled
// When calling from extension, use mode: 'cors'
fetch(url, {
  method: 'POST',
  mode: 'cors',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});
```

## Rate Limiting

Currently, there's no rate limiting on the API, but be respectful:
- Don't spam requests
- Wait for processing to complete before starting another batch
- Test with small page ranges first

## Best Practices

1. **Always test connection first** before attempting operations
2. **Validate input** before sending to API (page ranges, token format, etc.)
3. **Handle errors gracefully** with user-friendly messages
4. **Use appropriate timeouts** for long-running operations
5. **Check server logs** for detailed debugging information
6. **Start with small batches** when testing (1-10 pages)

## Integration with Chrome Extension

The Chrome extension uses these patterns:

```javascript
// From popup.js
document.getElementById('addDocument').addEventListener('click', async () => {
  const token = document.getElementById('token').value.trim();
  const apiUrl = document.getElementById('apiUrl').value;
  
  try {
    const response = await fetch(`${apiUrl}/api/add-doc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: token,
        start_page: parseInt(document.getElementById('startPage').value),
        end_page: parseInt(document.getElementById('endPage').value),
        output_filename: document.getElementById('filename').value
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showStatus('Document added!', 'success');
    } else {
      showStatus('Failed: ' + (data.message || 'Unknown error'), 'error');
    }
  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
  }
});
```

## Further Reading

- [Chrome Extension README](README.md)
- [API Server Documentation](../CTSAMPLE_README.md)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [Fetch API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)

---

For more examples and documentation, see the source code in `popup/popup.js`.
