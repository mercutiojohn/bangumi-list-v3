#!/bin/sh

COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo "Building with commit hash: $COMMIT_HASH"

npm install
npm run prisma:generate -w packages/server
npm run build -w packages/server

VITE_COMMIT_HASH=$COMMIT_HASH API_HOST=http://127.0.0.1:3001 npm run build -w packages/client_v2