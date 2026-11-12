#!/bin/sh
# Builds the Chrome Web Store upload zip with only the extension files.
set -e
cd "$(dirname "$0")"
V=$(sed -n 's/.*"version": "\(.*\)".*/\1/p' manifest.json)
rm -f "gator-eyes-extension-$V.zip"
zip -qr "gator-eyes-extension-$V.zip" manifest.json background.js content.js popup.html popup.js rundowns.js ribbon.js icons
echo "gator-eyes-extension-$V.zip"
