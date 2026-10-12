#!/usr/bin/env bash
# Play the site locally at http://localhost:8000 (a double-clicked index.html cannot load the game).
cd "$(dirname "$0")"
echo "Open http://localhost:8000 (Ctrl+C to stop)"
python3 -m http.server 8000
