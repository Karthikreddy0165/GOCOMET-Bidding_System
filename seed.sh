#!/bin/bash

# British Reverse Auction RFQ Platform - Seed / Reset Demo Data

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

if [ -d "$PROJECT_ROOT/.venv" ]; then
    PYTHON_BIN="$PROJECT_ROOT/.venv/bin/python"
else
    PYTHON_BIN="python3"
fi

echo "=========================================================="
echo " Seeding / Resetting British Auction Demo Data..."
echo "=========================================================="

cd "$PROJECT_ROOT/backend"
PYTHONPATH=. $PYTHON_BIN seed.py --reset

echo "=========================================================="
echo " Demo Data Ready!"
echo " Logins (Password: password123):"
echo "  - Buyer:    buyer@gocomet.com"
echo "  - Supplier: maersk@shipping.com"
echo "  - Supplier: hapag@shipping.com"
echo "  - Supplier: msc@shipping.com"
echo "=========================================================="
