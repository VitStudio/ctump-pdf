# Quick Start Guide - CTUMP PDF Chrome Extension

This guide will help you get started with the Chrome Extension in under 5 minutes.

## Prerequisites

✅ Google Chrome browser (version 88+)  
✅ Python 3.7+ installed  
✅ CTUMP PDF repository cloned

## Step 1: Start the API Server

```bash
cd /path/to/ctump-pdf
python ctsample.py
```

You should see:
```
 * Running on http://0.0.0.0:5000
```

**Keep this terminal open!** The server must be running for the extension to work.

## Step 2: Install the Extension

1. Open Chrome and go to: **chrome://extensions/**

2. Toggle **Developer mode** ON (top-right corner)

3. Click **"Load unpacked"**

4. Navigate to the `chrome-extension` folder inside this repository

5. Click **"Select Folder"**

6. ✅ You should now see "CTUMP PDF Downloader" in your extensions list

## Step 3: Use the Extension

### Method 1: Quick Download from CTUMP Page

1. **Navigate** to a CTUMP document viewer page  
   (e.g., `https://media.ctump.edu.vn/...`)

2. **Click** the extension icon in your Chrome toolbar  
   (📄 PDF icon)

3. **Click** "Fill from Current Page"  
   - The viewer URL and token are auto-filled

4. **Set** page range (Start: 1, End: 10, etc.)

5. **Enter** output filename (e.g., `my-document`)

6. **Click** "Add Document to Queue"

7. **Click** "Start Processing"

8. **Wait** for processing to complete  
   (Check API server terminal for progress)

### Method 2: Manual Entry

1. **Click** the extension icon

2. **Test connection** first (optional but recommended)

3. **Paste** viewer URL (if you have it)

4. **Click** "Auto Detect Token"

5. **Set** page range and filename

6. **Click** "Add Document to Queue"

7. **Click** "Start Processing"

## Step 4: Get Your PDF

PDFs are saved in the same directory where you ran `ctsample.py`.

To download via browser:
1. Click "View Queue" in the extension
2. Find your document in the web interface
3. Click the download link

## Troubleshooting

### ❌ "Connection failed"
- **Check**: Is `ctsample.py` running?
- **Check**: Is the API URL correct? (default: `http://localhost:5000`)
- **Try**: Click "Test Connection" button

### ❌ "Token not detected"
- **Check**: Is the viewer URL correct?
- **Try**: Copy URL from browser address bar
- **Try**: Enter token manually

### ❌ Extension not showing
- **Check**: Is it enabled in chrome://extensions/?
- **Try**: Refresh the extension (click 🔄 button)
- **Try**: Restart Chrome

### ❌ "Cannot add document"
- **Check**: Is token filled in?
- **Check**: Is filename provided?
- **Check**: Is page range valid? (start ≤ end, both ≥ 1)

## Tips for Best Results

✨ **Keep the server running** while using the extension

✨ **Test connection** before adding documents

✨ **Start with small page ranges** (1-10) to test

✨ **Check server logs** in the terminal for detailed progress

✨ **Use meaningful filenames** to organize your PDFs

## Next Steps

- Read [chrome-extension/README.md](README.md) for detailed documentation
- Check [CTSAMPLE_README.md](../CTSAMPLE_README.md) for API server details
- See main [README.md](../README.md) for desktop GUI alternative

## Quick Reference

| Action | Shortcut |
|--------|----------|
| Open extension | Click toolbar icon |
| Fill from page | "Fill from Current Page" button |
| Auto-detect token | "Auto Detect Token" button |
| Test API server | "Test Connection" button |
| View queue | "View Queue" button (opens web UI) |
| Clear form | "Clear Form" button |

---

**Happy downloading! 📄**

For more help, see the full documentation in [README.md](README.md).
