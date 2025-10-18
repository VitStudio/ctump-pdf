#!/bin/bash
# Build script for CTUMP PDF Chrome Extension
# Creates a distributable ZIP package

set -e  # Exit on error

EXTENSION_DIR="chrome-extension"
OUTPUT_DIR="dist"
VERSION=$(grep '"version"' chrome-extension/manifest.json | sed 's/.*: "\(.*\)".*/\1/')
OUTPUT_FILE="ctump-pdf-extension-v${VERSION}.zip"

echo "=========================================="
echo "CTUMP PDF Extension Build Script"
echo "=========================================="
echo "Version: ${VERSION}"
echo ""

# Create output directory
mkdir -p "${OUTPUT_DIR}"

# Remove old builds with same version
if [ -f "${OUTPUT_DIR}/${OUTPUT_FILE}" ]; then
    echo "Removing old build: ${OUTPUT_FILE}"
    rm "${OUTPUT_DIR}/${OUTPUT_FILE}"
fi

echo "Creating package..."
cd "${EXTENSION_DIR}"

# Create ZIP with production files only
zip -r "../${OUTPUT_DIR}/${OUTPUT_FILE}" . \
    -x "*.DS_Store" \
    -x ".*" \
    -x "API_EXAMPLES.md" \
    -x "BUILD.md" \
    -x "QUICKSTART.md" \
    -x "__pycache__/*" \
    -x "*.pyc" \
    -q

cd ..

# Get file size
SIZE=$(ls -lh "${OUTPUT_DIR}/${OUTPUT_FILE}" | awk '{print $5}')

echo ""
echo "=========================================="
echo "✓ Build completed successfully!"
echo "=========================================="
echo "Package: ${OUTPUT_DIR}/${OUTPUT_FILE}"
echo "Size: ${SIZE}"
echo ""
echo "Contents:"
unzip -l "${OUTPUT_DIR}/${OUTPUT_FILE}" | tail -n +4 | head -n -2

echo ""
echo "To install:"
echo "1. Open chrome://extensions/"
echo "2. Enable Developer mode"
echo "3. Drag and drop the ZIP file"
echo "   OR extract and click 'Load unpacked'"
echo ""
echo "To publish to Chrome Web Store:"
echo "1. Go to https://chrome.google.com/webstore/devconsole"
echo "2. Upload ${OUTPUT_FILE}"
echo "3. Fill in store listing details"
echo "4. Submit for review"
echo ""
