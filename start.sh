#!/bin/bash

# British Reverse Auction Platform - Startup Script

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "=========================================================="
echo " Starting British Reverse Auction RFQ Platform"
echo "=========================================================="

# Check Python environment
if [ -d "$PROJECT_ROOT/.venv" ]; then
    PYTHON_BIN="$PROJECT_ROOT/.venv/bin/python"
    UVICORN_BIN="$PROJECT_ROOT/.venv/bin/uvicorn"
else
    PYTHON_BIN="python3"
    UVICORN_BIN="uvicorn"
fi

# Function to handle cleanup on exit
cleanup() {
    echo ""
    echo "Stopping all services..."
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 1. Seed Database with Demo Accounts
echo "Ensuring demo accounts and sample auctions are seeded..."
cd "$PROJECT_ROOT/backend"
PYTHONPATH=. $PYTHON_BIN seed.py

# 2. Start Backend API
echo "Starting Backend API on http://localhost:8000..."
PYTHONPATH=. $UVICORN_BIN app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# 2. Start Frontend App
echo "Starting Frontend Web App on http://localhost:3000..."
cd "$PROJECT_ROOT/frontend"
npm run dev -- --port 3000 &
FRONTEND_PID=$!

echo "=========================================================="
echo " All services running:"
echo " - Backend API:     http://localhost:8000"
echo " - API Docs:        http://localhost:8000/docs"
echo " - Web Platform:    http://localhost:3000"
echo " - HLD Visual:      file://$PROJECT_ROOT/docs/hld.html"
echo " - Schema Visual:   file://$PROJECT_ROOT/docs/schema_design.html"
echo "=========================================================="
echo "Press Ctrl+C to shut down all services."

# Wait for background processes
wait

