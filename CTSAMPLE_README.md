# CTUMP PDF Tool - Web Interface (ctsample.py)

This is a Flask-based web UI version of the CTUMP PDF converter tool, cloned from `ct_gui.py`.

## Features

- **Web-based Interface**: Access via browser at `http://localhost:5000`
- **Single File Design**: Complete Flask application in one file with embedded HTML
- **Auto Token Detection**: Paste viewer URL to automatically extract token
- **Document Queue Management**: Add, remove, and manage multiple documents
- **Real-time Progress**: Live progress updates with auto-refresh
- **PDF Download**: Download generated PDFs directly from the browser
- **Async Processing**: Background processing with HTTP/2 support
- **Automatic Cache Clearing**: Cleans up temporary files after processing

## Quick Start

### Run the Server

```bash
python3 ctsample.py
```

Then open your browser and navigate to: **http://localhost:5000**

### Auto-Install Dependencies

The application will automatically install required dependencies:
- `flask>=2.0.0` - Web framework
- `httpx[http2]>=0.26` - HTTP client with HTTP/2 support
- `img2pdf>=0.6.0` - Image to PDF converter
- `pikepdf>=9.0` - PDF manipulation library

## Usage

### 1. Add Documents

1. **Viewer URL** (optional): Paste the CTUMP viewer URL
2. Click **"Auto Detect Token"** to extract the token automatically
3. Or manually enter the **Token**
4. Set **Start Page** and **End Page**
5. Enter **Output Filename** (`.pdf` will be added automatically)
6. Click **"Add Document"**

### 2. Process Documents

1. Review your documents in the **"Documents Queue"** table
2. Click **"Start Processing"** to begin
3. Monitor progress in the **Progress bar** and **Logs** section
4. Use **"Cancel"** to stop processing if needed

### 3. Download PDFs

Once processing is complete, a **"📥 Download"** link appears next to each completed document in the queue.

## API Endpoints

The application exposes the following REST API endpoints:

- `GET /` - Main web interface
- `POST /api/detect-token` - Auto-detect token from viewer URL
- `POST /api/add-doc` - Add document to queue
- `DELETE /api/remove-doc/<index>` - Remove document from queue
- `POST /api/clear` - Clear all documents
- `POST /api/start` - Start processing
- `POST /api/cancel` - Cancel processing
- `GET /download/<filename>` - Download generated PDF

## Configuration

Default settings (can be modified in the code):

- **Base URL**: `https://media.ctump.edu.vn/DocImage.axd`
- **Concurrency**: 6 concurrent downloads
- **Segment Size**: 200 pages per segment
- **Server Port**: 5000
- **Server Host**: 0.0.0.0 (accessible from all interfaces)

## UI Design

- **Black theme** with high contrast for minimal distraction
- **Responsive layout** that works on different screen sizes
- **Auto-refresh** every 2 seconds during processing
- **Color-coded logs**:
  - White: INFO messages
  - Yellow: WARN messages  
  - Red: ERROR messages
  - Green: DONE messages

## Differences from ct_gui.py

| Feature | ct_gui.py | ctsample.py |
|---------|-----------|-------------|
| Interface | Tkinter desktop GUI | Flask web interface |
| Access | Local application | Browser-based (local or remote) |
| Manifest | Load/Save JSON files | Not yet implemented |
| Configuration | Editable spinboxes | Fixed defaults (modifiable in code) |
| Multi-user | Single user | Can be accessed by multiple browsers |
| Download | Saves to local disk | Download via browser |

## Browser Compatibility

Tested with:
- Chrome/Chromium
- Firefox
- Safari
- Edge

Modern browsers with JavaScript enabled are required.

## Notes

- This is a **development server** - for production use, deploy with a production WSGI server like Gunicorn
- All documents are processed sequentially, not in parallel
- PDFs are saved to the current working directory by default
- The server binds to `0.0.0.0:5000` making it accessible on the network

## Troubleshooting

### Port Already in Use

If port 5000 is already taken, modify the last line in `ctsample.py`:

```python
app.run(debug=False, host='0.0.0.0', port=5001, threaded=True)
```

### Dependencies Not Installing

Manually install dependencies:

```bash
pip install flask httpx[http2] img2pdf pikepdf
```

### Cannot Access from Another Computer

Make sure:
1. Firewall allows connections on port 5000
2. Server is running with `host='0.0.0.0'`
3. Use the server's IP address, not `localhost`

## License

Same as the parent project - see LICENSE file.
