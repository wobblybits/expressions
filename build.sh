#!/bin/bash

# Function to create manifest when needed
create_manifest() {
    while true; do
        if [ -f "dist/server-fns.js" ] && [ ! -f ".vinxi/build/server-fns/_server/.vite/manifest.json" ]; then
            mkdir -p .vinxi/build/server-fns/_server/.vite
            echo '{}' > .vinxi/build/server-fns/_server/.vite/manifest.json
            echo "Created missing manifest.json"
            break
        fi
        sleep 0.1
    done
}

# Start monitoring in background
create_manifest &
MONITOR_PID=$!

# Run the build
npx vinxi build
BUILD_EXIT_CODE=$?

# Clean up background process
kill $MONITOR_PID 2>/dev/null

exit $BUILD_EXIT_CODE