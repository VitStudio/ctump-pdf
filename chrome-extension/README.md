# CTUMP PDF Downloader - Chrome Extension

A Chrome extension for easily downloading documents from CTUMP DocImage as PDF files using Manifest V3.

## Features

- **Manifest V3 Compliant**: Uses the latest Chrome extension manifest version
- **Easy API Integration**: Connects to the CTUMP PDF API server (ctsample.py)
- **Auto Token Detection**: Automatically extract tokens from CTUMP viewer URLs
- **Quick Actions**: Fill form data from current CTUMP page
- **Simple Interface**: Clean black and white UI consistent with the desktop app
- **Document Queue**: Add multiple documents before processing
- **Connection Testing**: Verify API server availability

## Installation

### Prerequisites

1. **API Server Running**: Make sure the CTUMP PDF API server is running:
   ```bash
   python ctsample.py
   # Server will start at http://localhost:5000
   ```

### Install Extension in Chrome

1. **Open Chrome Extensions Page**:
   - Navigate to `chrome://extensions/`
   - Or click Menu (⋮) → More Tools → Extensions

2. **Enable Developer Mode**:
   - Toggle the "Developer mode" switch in the top right corner

3. **Load Extension**:
   - Click "Load unpacked"
   - Navigate to the `chrome-extension` folder in this repository
   - Select the folder and click "Select Folder"

4. **Verify Installation**:
   - You should see "CTUMP PDF Downloader" in your extensions list
   - The extension icon should appear in your Chrome toolbar

## Usage

### Basic Workflow

1. **Click the Extension Icon** in Chrome toolbar
2. **Configure API Server** (first time only):
   - Enter API URL (default: `http://localhost:5000`)
   - Click "Test Connection" to verify

3. **Add a Document**:
   - **Option A - Auto-detect from URL**:
     - Paste CTUMP viewer URL in "Viewer URL" field
     - Click "Auto Detect Token"
   - **Option B - Fill from current page**:
     - Navigate to a CTUMP document page
     - Click "Fill from Current Page"
   - **Option C - Manual entry**:
     - Enter token manually

4. **Configure Document**:
   - Set Start Page and End Page
   - Enter Output Filename
   - Click "Add Document to Queue"

5. **Process Documents**:
   - Click "Start Processing" to begin conversion
   - Click "View Queue" to see all documents in the API server

### Quick Actions

- **Test Connection**: Verify API server is reachable
- **Auto Detect Token**: Extract token from viewer URL
- **Fill from Current Page**: Auto-fill fields when on a CTUMP page
- **Clear Form**: Reset all form fields
- **View Queue**: Open API server interface in new tab

## API Server Endpoints Used

The extension communicates with these API endpoints:

- `GET /` - Main interface (for connection testing)
- `POST /api/detect-token` - Auto-detect token from viewer URL
- `POST /api/add-doc` - Add document to processing queue
- `POST /api/start` - Start processing documents

## Permissions

The extension requires these permissions:

- **activeTab**: To read current tab URL when on CTUMP pages
- **storage**: To save API server URL settings
- **host_permissions**: Access to `https://media.ctump.edu.vn/*` for content script injection

## Architecture

### Files Structure

```
chrome-extension/
├── manifest.json           # Extension configuration (Manifest V3)
├── background.js          # Service worker for background tasks
├── content.js             # Content script for CTUMP pages
├── popup/
│   ├── popup.html        # Extension popup UI
│   ├── popup.css         # Styling (black & white theme)
│   └── popup.js          # Popup logic and API calls
└── icons/
    ├── icon16.png        # 16x16 icon
    ├── icon48.png        # 48x48 icon
    └── icon128.png       # 128x128 icon
```

### Component Details

#### manifest.json
- Manifest V3 configuration
- Declares permissions and host permissions
- Configures service worker and content scripts

#### background.js (Service Worker)
- Handles extension lifecycle events
- Manages background tasks
- Processes messages from popup and content scripts

#### content.js (Content Script)
- Runs on CTUMP pages (`https://media.ctump.edu.vn/*`)
- Extracts tokens and document information from pages
- Shows visual indicator when active

#### popup.js
- Main UI logic
- API communication
- Form validation and submission

## Development

### Testing the Extension

1. Make changes to extension files
2. Go to `chrome://extensions/`
3. Click the refresh icon (🔄) on the extension card
4. Test your changes

### Debugging

- **Popup**: Right-click extension icon → "Inspect popup"
- **Background Script**: Click "Inspect views: service worker" on extension card
- **Content Script**: Open DevTools on CTUMP page, check Console

### Common Issues

#### Connection Failed
- Verify API server is running: `python ctsample.py`
- Check API URL in extension settings
- Ensure no firewall blocking localhost:5000

#### Token Not Detected
- Verify viewer URL is correct
- Try manual token entry
- Check content script is running (look for indicator on page)

#### Extension Not Loading
- Check manifest.json for syntax errors
- Verify all referenced files exist
- Check Chrome DevTools console for errors

## Customization

### Change API Server URL

Default is `http://localhost:5000`. To use a different server:
1. Click extension icon
2. Enter new URL in "API Server URL" field
3. It will be saved automatically

### Modify Theme

Edit `popup/popup.css` to change colors and styling. Current theme:
- Background: `#000000` (black)
- Text: `#ffffff` (white)
- Accent: `#213448` (navy blue)
- Cards: `#1a1a1a` (dark gray)

## API Integration Guide

### For Developers

The extension makes REST API calls to the Flask server. Example:

```javascript
// Auto-detect token
const response = await fetch(`${apiUrl}/api/detect-token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ viewer_url: viewerUrl })
});
const data = await response.json();

// Add document
const response = await fetch(`${apiUrl}/api/add-doc`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: token,
    start_page: startPage,
    end_page: endPage,
    output_filename: filename
  })
});
```

### Expected API Responses

All endpoints return JSON:
```json
{
  "success": true,
  "message": "Operation completed",
  "data": {}
}
```

## Security

- No sensitive data stored in extension
- API calls use HTTPS when connecting to production servers
- Token only stored temporarily in form fields
- No data sent to third-party servers

## Browser Compatibility

- **Chrome**: Version 88+ (Manifest V3 support)
- **Edge**: Version 88+ (Chromium-based)
- **Brave**: Version 1.20+
- **Opera**: Version 74+

## Troubleshooting

### Extension Icon Not Showing
- Check if extension is enabled in `chrome://extensions/`
- Try disabling and re-enabling the extension

### Cannot Add Document
- Verify token is valid (UUID format)
- Check page range (start ≤ end, both ≥ 1)
- Ensure filename is provided

### API Server Not Responding
- Start the server: `python ctsample.py`
- Check server logs for errors
- Verify correct port (default: 5000)

## Contributing

To contribute to the extension:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

Same as the main CTUMP PDF project. See LICENSE file.

## Credits

Built for easy integration with CTUMP PDF Downloader API.
Based on the CTUMP PDF converter tool by VitStudio.

## Support

For issues or questions:
1. Check the main README.md
2. Review API server documentation (CTSAMPLE_README.md)
3. Open an issue on GitHub

---

**Note**: This extension is for educational and research purposes. Please comply with CTUMP university regulations when using.
