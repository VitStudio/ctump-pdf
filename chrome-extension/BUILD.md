# Building and Packaging Guide

This guide explains how to package the Chrome extension for distribution.

## For Development

During development, load the unpacked extension directly:

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `chrome-extension` folder
5. Done! Extension is installed for testing

## For Distribution

To distribute the extension, you need to create a `.zip` file or publish to Chrome Web Store.

### Option 1: Create ZIP Package (Manual Distribution)

```bash
cd chrome-extension
zip -r ctump-pdf-extension.zip . -x "*.DS_Store" -x ".*" -x "__pycache__/*" -x "*.pyc"
```

This creates `ctump-pdf-extension.zip` that can be shared with users.

**Users install by:**
1. Download the ZIP file
2. Extract to a folder
3. Open `chrome://extensions/`
4. Enable Developer mode
5. Click "Load unpacked"
6. Select the extracted folder

### Option 2: Publish to Chrome Web Store

For official distribution through Chrome Web Store:

#### Prerequisites

1. **Google Account** with developer registration ($5 one-time fee)
2. **Icons** ready (16x16, 48x48, 128x128) ✓
3. **Screenshots** of the extension in action
4. **Privacy policy** (if collecting data - we don't)

#### Steps

1. **Prepare Package**
   ```bash
   cd chrome-extension
   zip -r ../ctump-pdf-extension-v1.0.0.zip . \
     -x "*.DS_Store" \
     -x ".*" \
     -x "QUICKSTART.md" \
     -x "API_EXAMPLES.md" \
     -x "BUILD.md"
   ```

2. **Go to Chrome Web Store Developer Dashboard**
   - Visit: https://chrome.google.com/webstore/devconsole
   - Sign in with Google Account
   - Pay $5 registration fee (one-time)

3. **Create New Item**
   - Click "New Item"
   - Upload `ctump-pdf-extension-v1.0.0.zip`
   - Fill in required information:
     - **Name**: CTUMP PDF Downloader
     - **Description**: Download documents from CTUMP DocImage as PDF files
     - **Category**: Productivity
     - **Language**: English (or Vietnamese)

4. **Add Store Listing Assets**
   - **Small icon** (128x128): Upload `icons/icon128.png`
   - **Screenshots** (1280x800 or 640x400): Capture extension in action
   - **Detailed description**: Copy from README.md

5. **Privacy**
   - Check "This extension does NOT collect user data"
   - Add privacy practices

6. **Submit for Review**
   - Review all information
   - Click "Submit for review"
   - Wait for approval (usually 1-2 weeks)

### Option 3: Enterprise Distribution (.crx)

For internal distribution in organizations:

```bash
# Package extension with private key
chrome --pack-extension=chrome-extension \
       --pack-extension-key=private-key.pem

# This creates:
# - chrome-extension.crx (installable package)
# - private-key.pem (keep secret!)
```

**Important**: Keep `private-key.pem` secure! It's needed for updates.

## Pre-Distribution Checklist

Before distributing, ensure:

- [ ] All code is tested and working
- [ ] No console errors or warnings
- [ ] Icons are present and correct size
- [ ] README.md is complete and accurate
- [ ] Version number in manifest.json is correct
- [ ] All required permissions are documented
- [ ] API server URL is configurable (not hardcoded)
- [ ] No debug code or console.logs in production
- [ ] Privacy policy is clear (if needed)
- [ ] License information is included

## Version Management

When releasing updates:

1. **Update Version Number**
   ```json
   {
     "manifest_version": 3,
     "name": "CTUMP PDF Downloader",
     "version": "1.0.1",  // Increment this
     ...
   }
   ```

2. **Version Numbering Scheme**
   - `MAJOR.MINOR.PATCH`
   - `1.0.0` = Initial release
   - `1.0.1` = Bug fix
   - `1.1.0` = New feature
   - `2.0.0` = Breaking change

3. **Create Release Notes**
   - Document changes in CHANGELOG.md
   - Note any breaking changes
   - List new features and bug fixes

4. **Tag Release**
   ```bash
   git tag -a v1.0.0 -m "Initial release"
   git push origin v1.0.0
   ```

## File Structure for Distribution

The ZIP package should contain:

```
ctump-pdf-extension/
├── manifest.json         # Required
├── background.js         # Required
├── content.js            # Required
├── popup/
│   ├── popup.html       # Required
│   ├── popup.css        # Required
│   └── popup.js         # Required
├── icons/
│   ├── icon16.png       # Required
│   ├── icon48.png       # Required
│   └── icon128.png      # Required
└── README.md            # Recommended (shown in Chrome Web Store)
```

**Exclude from package:**
- `.git/` directory
- `.DS_Store` files
- `QUICKSTART.md` (development-only)
- `API_EXAMPLES.md` (development-only)
- `BUILD.md` (this file)
- Any test files or scripts
- `*.pyc` or `__pycache__/`

## Screenshots for Chrome Web Store

Capture screenshots showing:

1. **Extension popup** with form filled out
2. **Auto-detect token** feature in action
3. **Document added** success message
4. **Settings/configuration** screen
5. **Integration** with CTUMP page (if applicable)

Screenshot requirements:
- Format: PNG or JPEG
- Size: 1280x800 or 640x400 (preferred)
- At least 1 screenshot required
- Maximum 5 screenshots recommended

## Promotional Assets (Optional)

For better visibility in Chrome Web Store:

- **Small promotional tile**: 440x280 PNG
- **Large promotional tile**: 920x680 PNG
- **Marquee promotional tile**: 1400x560 PNG

These are optional but help with discoverability.

## Testing Before Release

1. **Clean Install Test**
   - Remove existing installation
   - Install from ZIP package
   - Test all features fresh

2. **Cross-Browser Test** (if targeting multiple browsers)
   - Chrome (primary)
   - Edge (Chromium)
   - Brave
   - Opera

3. **API Integration Test**
   - Test with actual API server
   - Try different scenarios:
     - Valid token
     - Invalid token
     - Network errors
     - Server offline

4. **Edge Cases**
   - Empty forms
   - Invalid inputs
   - Very large page ranges
   - Special characters in filenames

## Distribution Channels

### 1. Chrome Web Store (Recommended)
- Official distribution
- Automatic updates
- User trust
- Costs $5 one-time fee

### 2. GitHub Releases
- Free hosting
- Version control
- Community trust
- Requires manual installation

### 3. Direct Download
- Your own website
- Complete control
- No review process
- Requires user trust

### 4. Enterprise Policy
- For organizations
- Centralized deployment
- No user installation needed
- Requires admin access

## Update Distribution

When releasing updates:

### Chrome Web Store
1. Increment version in manifest.json
2. Create new ZIP package
3. Upload to Chrome Web Store dashboard
4. Users get automatic updates

### Manual Distribution
1. Announce new version
2. Provide download link
3. Users manually update by:
   - Downloading new ZIP
   - Removing old version
   - Installing new version

## Troubleshooting Distribution

### ZIP Package Issues
- **"Manifest file is missing"**: Ensure manifest.json is in root of ZIP
- **"Invalid manifest"**: Validate JSON syntax
- **"Missing icons"**: Check all icon paths are correct

### Chrome Web Store Rejection
Common reasons:
- Requesting unnecessary permissions
- Unclear privacy policy
- Poor description or screenshots
- Code quality issues
- Security vulnerabilities

### Installation Issues
- **"Package is invalid"**: Check manifest.json format
- **"Cannot read extension"**: Ensure all files are included
- **"Permissions warning"**: Document why each permission is needed

## Security Considerations

Before distribution:

1. **No hardcoded secrets** or API keys
2. **Validate all user input** before sending to API
3. **Use HTTPS** for all network requests
4. **Minimal permissions** requested
5. **No external dependencies** that could be compromised
6. **Content Security Policy** is set appropriately

## Legal Considerations

1. **License**: Choose appropriate license (see LICENSE file)
2. **Copyright**: Ensure all assets are owned or properly licensed
3. **Privacy**: Clear privacy policy if collecting any data
4. **Terms of Service**: If integrating with third-party APIs

## Support

After distribution:

1. **Monitor reviews** in Chrome Web Store
2. **Respond to user feedback** promptly
3. **Track issues** on GitHub
4. **Provide documentation** and help resources
5. **Regular updates** for bug fixes and improvements

## Resources

- [Chrome Extension Publishing](https://developer.chrome.com/docs/webstore/publish/)
- [Manifest V3 Documentation](https://developer.chrome.com/docs/extensions/mv3/)
- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- [Extension Development Best Practices](https://developer.chrome.com/docs/extensions/mv3/practices/)

---

For questions about building or distributing, see the main [README.md](README.md).
