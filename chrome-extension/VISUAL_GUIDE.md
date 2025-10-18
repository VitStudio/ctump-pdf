# CTUMP PDF Chrome Extension - Visual Guide

## Extension Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Chrome Browser                            │
│                                                                  │
│  ┌───────────────┐         ┌──────────────────────────────┐   │
│  │  Extension    │         │    CTUMP Website             │   │
│  │  Popup UI     │         │  (media.ctump.edu.vn)        │   │
│  │               │         │                               │   │
│  │  [Form]       │         │  Viewer Page                 │   │
│  │  - URL        │         │  - Token: xxx                │   │
│  │  - Token      │  ◄────  │  - Document pages            │   │
│  │  - Pages      │  Auto-  │                               │   │
│  │  - Filename   │  detect │                               │   │
│  │               │         │                               │   │
│  │  [Buttons]    │         └──────────────────────────────┘   │
│  │  - Add Doc    │                      ▲                      │
│  │  - Start      │                      │                      │
│  └───────┬───────┘                      │                      │
│          │                              │                      │
│          │ API Calls                Content Script             │
│          │ (HTTP)                   (Extracts info)            │
│          ▼                              │                      │
│  ┌───────────────┐                      │                      │
│  │  Background   │──────────────────────┘                      │
│  │  Service      │  Message passing                            │
│  │  Worker       │                                              │
│  └───────────────┘                                              │
│                                                                  │
└────────────┬─────────────────────────────────────────────────┘
             │
             │ HTTP Requests
             │ (JSON)
             ▼
    ┌─────────────────────────┐
    │   API Server            │
    │   (Flask - ctsample.py) │
    │   localhost:5000        │
    │                         │
    │   Endpoints:            │
    │   - /api/detect-token   │
    │   - /api/add-doc        │
    │   - /api/start          │
    │   - /download/<file>    │
    │                         │
    └───────────┬─────────────┘
                │
                │ Downloads
                ▼
        ┌───────────────┐
        │  CTUMP Server │
        │  Images       │
        └───────┬───────┘
                │
                ▼
        ┌───────────────┐
        │  PDF Output   │
        │  document.pdf │
        └───────────────┘
```

## Component Interaction

### 1. User Opens Extension Popup

```
User clicks extension icon
         ↓
popup.html loads
         ↓
popup.css styles UI (black & white theme)
         ↓
popup.js initializes
         ↓
Loads saved API URL from chrome.storage
```

### 2. Auto-Fill from Page (Optional)

```
User on CTUMP page
         ↓
content.js extracts token from page
         ↓
User clicks "Fill from Current Page"
         ↓
popup.js reads current tab URL
         ↓
Fills viewer URL and token fields
```

### 3. Auto-Detect Token

```
User pastes viewer URL
         ↓
Clicks "Auto Detect Token"
         ↓
popup.js → POST /api/detect-token
         ↓
API server fetches URL and parses
         ↓
Returns token (if found)
         ↓
popup.js fills token field
```

### 4. Add Document

```
User fills all fields
         ↓
Clicks "Add Document to Queue"
         ↓
popup.js validates input
         ↓
POST /api/add-doc with:
  - token
  - start_page
  - end_page
  - output_filename
         ↓
API adds to internal queue
         ↓
Returns success
         ↓
popup.js shows success message
```

### 5. Start Processing

```
User clicks "Start Processing"
         ↓
popup.js → POST /api/start
         ↓
API server begins async processing:
  - Downloads images from CTUMP
  - Converts to PDF pages
  - Merges into final PDF
         ↓
User can monitor in server logs
         ↓
PDF saved to disk when complete
```

## File Relationships

```
manifest.json
    │
    ├─► Declares background.js (service worker)
    ├─► Declares content.js (runs on CTUMP pages)
    ├─► Declares popup/popup.html (extension popup)
    └─► Declares icons/*.png (extension icons)

popup/popup.html
    ├─► Links popup.css (styling)
    └─► Links popup.js (logic)

popup/popup.js
    ├─► Calls chrome.storage API (save settings)
    ├─► Calls chrome.tabs API (read current tab)
    ├─► Sends HTTP requests to API server
    └─► Updates popup UI based on responses

background.js
    ├─► Listens for chrome.runtime.onInstalled
    ├─► Handles messages from popup/content scripts
    └─► Manages extension lifecycle

content.js
    ├─► Runs on media.ctump.edu.vn pages
    ├─► Extracts tokens from page content
    ├─► Sends messages to background/popup
    └─► Shows visual indicator
```

## Data Flow: Complete Example

```
1. User Opens Extension
   ┌─────────────────┐
   │ Click icon      │
   │ Popup opens     │
   └────────┬────────┘
            ▼
   ┌─────────────────┐
   │ Load saved URL  │
   │ localhost:5000  │
   └────────┬────────┘

2. Configure Document
   ┌─────────────────────────┐
   │ Paste viewer URL        │
   │ Click "Auto Detect"     │
   └────────┬────────────────┘
            ▼
   ┌─────────────────────────┐
   │ API: detect-token       │
   │ → Token: abc-123        │
   └────────┬────────────────┘
            ▼
   ┌─────────────────────────┐
   │ Set pages: 1-10         │
   │ Set filename: doc.pdf   │
   └────────┬────────────────┘

3. Queue Document
   ┌─────────────────────────┐
   │ Click "Add Document"    │
   └────────┬────────────────┘
            ▼
   ┌─────────────────────────┐
   │ Validate input          │
   │ - Token? ✓              │
   │ - Pages? ✓              │
   │ - Filename? ✓           │
   └────────┬────────────────┘
            ▼
   ┌─────────────────────────┐
   │ API: add-doc            │
   │ POST {token, pages...}  │
   └────────┬────────────────┘
            ▼
   ┌─────────────────────────┐
   │ Show success message    │
   │ Clear form              │
   └─────────────────────────┘

4. Process Documents
   ┌─────────────────────────┐
   │ Click "Start Processing"│
   └────────┬────────────────┘
            ▼
   ┌─────────────────────────┐
   │ API: start              │
   │ Processing begins...    │
   └────────┬────────────────┘
            ▼
   ┌─────────────────────────┐
   │ Server downloads images │
   │ → Converts to PDF       │
   │ → Saves to disk         │
   └─────────────────────────┘

5. Get Results
   ┌─────────────────────────┐
   │ Click "View Queue"      │
   │ Opens web interface     │
   └────────┬────────────────┘
            ▼
   ┌─────────────────────────┐
   │ Download PDF            │
   │ doc.pdf ready!          │
   └─────────────────────────┘
```

## State Management

```
┌─────────────────────────────────┐
│ Chrome Storage (Persistent)     │
│ ─────────────────────────────   │
│ • apiUrl: "http://localhost:5000"│
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Popup State (Temporary)         │
│ ─────────────────────────────   │
│ • viewerUrl: ""                 │
│ • token: ""                     │
│ • startPage: 1                  │
│ • endPage: 1                    │
│ • filename: ""                  │
│ • logs: []                      │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ API Server State (External)     │
│ ─────────────────────────────   │
│ • document_queue: []            │
│ • processing: false             │
│ • current_doc: null             │
└─────────────────────────────────┘
```

## Error Handling Flow

```
API Call
   ↓
Try {
   fetch(url, options)
}
   ↓
   ├─► Network Error
   │      ↓
   │   Catch → Show "Cannot reach server"
   │
   ├─► HTTP Error (4xx, 5xx)
   │      ↓
   │   Check response.ok → Show status code
   │
   └─► Success (2xx)
          ↓
       Parse JSON
          ↓
          ├─► JSON Error
          │      ↓
          │   Catch → Show "Invalid response"
          │
          └─► Valid JSON
                 ↓
              Check data.success
                 ↓
                 ├─► false → Show data.message/error
                 │
                 └─► true → Continue with data
```

## UI States

```
Initial State
   ↓
┌──────────────────┐
│ Form: Empty      │
│ Status: Ready... │
│ Buttons: Enabled │
└──────────────────┘

Adding Document
   ↓
┌──────────────────┐
│ Form: Filled     │
│ Status: Adding...│
│ Buttons: Disabled│
└──────────────────┘

Document Added
   ↓
┌──────────────────┐
│ Form: Cleared    │
│ Status: ✓ Added! │
│ Buttons: Enabled │
└──────────────────┘

Error Occurred
   ↓
┌──────────────────┐
│ Form: Preserved  │
│ Status: ✗ Error! │
│ Buttons: Enabled │
└──────────────────┘
```

## Permissions Usage

```
activeTab Permission
   ↓
Used by:
   • popup.js: chrome.tabs.query()
   • To read current tab URL
   • For "Fill from Current Page"

storage Permission
   ↓
Used by:
   • popup.js: chrome.storage.sync
   • To save API server URL
   • Persists across sessions

host_permissions
   ↓
Used by:
   • content.js runs on media.ctump.edu.vn
   • Extracts tokens from page
   • Shows activity indicator
```

## Quick Reference

### Key Files by Function

| Function | File |
|----------|------|
| UI Layout | popup/popup.html |
| Styling | popup/popup.css |
| User Interaction | popup/popup.js |
| Background Tasks | background.js |
| Page Integration | content.js |
| Configuration | manifest.json |
| Icons | icons/*.png |

### Key API Endpoints

| Action | Endpoint |
|--------|----------|
| Test connection | GET / |
| Detect token | POST /api/detect-token |
| Add document | POST /api/add-doc |
| Start processing | POST /api/start |
| Download PDF | GET /download/file.pdf |

### Common User Flows

| Task | Steps |
|------|-------|
| Quick download | 1. Fill from page → 2. Set pages → 3. Add → 4. Start |
| Manual entry | 1. Paste URL → 2. Auto-detect → 3. Set pages → 4. Add |
| Test setup | 1. Enter API URL → 2. Test connection |

---

This visual guide complements the technical documentation and helps users understand how the extension works.
