# British Reverse Auction in Logistics RFQ System

A real-time logistics freight procurement platform where freight buyers issue RFQs and suppliers compete through live reverse bidding. Built with Role-Based Access Control (RBAC), anti-sniping dynamic time extensions, multi-attribute winner ranking, and real-time WebSocket state synchronization.

---

## 📑 System Documentation & Architecture Deliverables

Visual architecture and data model documentation are located in [`docs/`](./docs):

- **High-Level Design (HLD):** [`docs/hld.html`](./docs/hld.html) — System context, 5-stage procurement lifecycle, RBAC security, and concurrency guarantees.
- **Database Schema Design:** [`docs/schema_design.html`](./docs/schema_design.html) — Relational ER diagram with explicit multiplicities (`1:1`, `1:N`), table definitions, and data integrity invariants.

---

## 🚀 How to Deploy

The platform can be deployed via **Docker Compose**, **local shell script**, or **cloud hosting (Railway / Render / AWS EC2)**.

### Method 1: Docker Compose (Recommended for Production & Cloud VMs)
The repository includes a production-ready `docker-compose.yml` orchestrating PostgreSQL 15, Redis 7, the FastAPI backend, and Nginx serving the React frontend:

```bash
# 1. Clone repository and navigate to root
git clone <repo-url>
cd Logistics_bidding_System

# 2. Build and start all containers in detached mode
docker compose up --build -d

# 3. Seed demo data inside the container
docker compose exec backend python seed.py --reset
```

- **Frontend Application:** `http://localhost:3000`
- **Backend API & Swagger Docs:** `http://localhost:8000/docs`

---

### Method 2: Local Native Run (macOS / Linux / WSL)
Run both backend and frontend concurrently with automatic environment setup:

```bash
# 1. Make startup script executable and run
chmod +x start.sh
./start.sh
```

`start.sh` automatically seeds demo accounts, starts the FastAPI server on port 8000, and launches Vite frontend on port 3000.

---

### Method 3: Cloud Deployment (Railway / Render / Render + Supabase)
1. **Database:** Provision a managed PostgreSQL instance (e.g. Supabase, Neon, or Railway Postgres).
2. **Backend Service:**
   - Build context: `/backend`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Set environment variables:
     - `DATABASE_URL`: `postgresql+asyncpg://<user>:<pwd>@<host>:<port>/<db>`
     - `DATABASE_URL_SYNC`: `postgresql://<user>:<pwd>@<host>:<port>/<db>`
     - `JWT_SECRET`: `<secure-random-string>`
3. **Frontend Service:**
   - Build context: `/frontend`
   - Build Command: `npm run build`
   - Publish Directory: `dist`
   - Environment variable: `VITE_API_URL=https://<your-backend-domain>`

---

## 🎯 How to Load Demo Data for Demonstration

The system provides **three convenient ways** to load and reset demonstration data at any time:

### Way 1: 1-Click In-App Reset (Zero CLI Needed)
- On the **Sign In Page (`http://localhost:3000/login`)**:
  - Click **"🔄 Reset / Reload Demo Data"** at the bottom of the demo accounts box.
- Inside the **App Navigation Bar**:
  - Click the **"Reset Demo Data"** button in the top navigation header anytime.
  - Automatically re-initializes all auctions with fresh active countdowns!

### Way 2: CLI Shortcut Script
From the repository root, run:
```bash
chmod +x seed.sh
./seed.sh
```

---

### 🔑 Pre-Loaded Demo Accounts

All demo accounts share the password: **`password123`**

| Role | Email | Company / Full Name | Capabilities |
| :--- | :--- | :--- | :--- |
| **BUYER** | `buyer@gocomet.com` | GoComet Freight Procurement | Create RFQs, configure anti-sniping rules, invite suppliers |
| **BUYER** | `buyer1@test.com` | Rajesh Sharma (Apex Logistics) | Manage cargo shipments & view audit timelines |
| **SUPPLIER** | `maersk@shipping.com` | A.P. Moller - Maersk | Submit ocean freight rates, monitor L1/L2 rank |
| **SUPPLIER** | `hapag@shipping.com` | Hapag-Lloyd Logistics | Live underbidding & dynamic extension trigger testing |
| **SUPPLIER** | `msc@shipping.com` | MSC Mediterranean Shipping | Multi-attribute quote submission & transit time bidding |
| **SUPPLIER** | `supplier1@test.com` | FastTrack Express Logistics | Active reverse bidding on coastal routes |

*(1-click login buttons for all these accounts are available on the Sign-In page)*.

---

### 📦 Pre-Configured Demo Auctions

Resetting demo data loads 4 realistic logistics procurement scenarios:

1. **`RFQ-2026-MUM-ROT-01` — Active Main British Auction (Closes in ~45 mins)**
   - *Route:* Nhava Sheva (JNPT) to Rotterdam Port (50x 40ft High-Cube).
   - *Status:* **ACTIVE** with 3 live competing quotes (Hapag L1 at ₹46,000, MSC L2 at ₹49,000, Maersk L3 at ₹51,000).
2. **`RFQ-2026-CHN-SIN-02` — Dynamic Anti-Sniping Test Auction (Closes in ~7 mins)**
   - *Route:* Chennai Harbor to Singapore Jurong Island (30x 20ft ISO Tanks).
   - *Status:* **ACTIVE in Trigger Window**. Submitting a quote immediately demonstrates the dynamic **+5 min extension** in real-time!
3. **`RFQ-2026-MUN-DXB-03` — Upcoming Scheduled Auction**
   - *Route:* Mundra Port to Jebel Ali (100x 40ft Reefer Pharma Grade).
   - *Status:* **SCHEDULED** to open tomorrow.
4. **`RFQ-2026-CCU-CTG-04` — Historical Completed Auction**
   - *Route:* Kolkata Haldia to Chittagong Coastal Barge Haulage.
   - *Status:* **CLOSED / AWARDED** to Maersk with full audit log and winning quote.

---

## 🏗️ Core Architecture & Business Rules

### 1. Unified Web Application with RBAC
Rather than running disconnected websites, the platform runs as a single web application where access and navigation are governed by user roles:
- **`BUYER`**: Issues RFQs, configures auction rules (start time, duration, forced close ceiling, trigger window, and increment duration), invites suppliers, and reviews the audit log.
- **`SUPPLIER`**: Enters the supplier bidding platform. Submits landed freight quote breakdowns, enters transit times, tracks live countdowns, and monitors real-time rank positions (L1, L2, etc.).

### 2. Multi-Attribute Winner Ranking
Freight procurement decisions evaluate both price and delivery speed:
1. **Primary (Lowest Landed Cost):** `total_amount = freight + origin_charge + destination_charge`. Lowest quote is L1.
2. **Tie-Breaker 1 (Shorter Transit Time):** If two competing suppliers quote the exact same total landed cost, the supplier offering shorter transit duration wins the tie.
3. **Tie-Breaker 2 (Submission Timestamp):** If both price and transit duration are identical, the earlier submitted bid takes priority.

### 3. Dynamic Anti-Sniping Extensions & Forced Close Cap
- **Trigger Window ($X$):** Monitors bidding activity within the configured window before close (e.g. last 10 minutes).
- **Extension Increment ($Y$):** Automatically extends the deadline when an eligible bid arrives (e.g. +5 minutes).
- **Forced Close Ceiling:** Absolute hard stop set by the buyer. Extensions are strictly clamped: `new_close = min(current_close + increment, forced_close)`. Bidding terminates deterministically.

### 4. Concurrency & Information Security
- **Pessimistic Row Lock:** Each incoming bid executes `SELECT ... FOR UPDATE` on the auction record inside a database transaction, eliminating double-extension race conditions.
- **Single-Supplier Duplicate Guard:** A supplier cannot submit the identical quote amount twice in the same auction.
- **Unique Active Auction Names:** Partial unique constraint prevents duplicate active auctions with the same name.
- **Information Asymmetry:** The forced close ceiling and internal trigger window are hidden from supplier queries to prevent last-second sniping.

---

## 🧪 Automated Test Suite

All 9 end-to-end integration test cases pass:

```bash
cd backend
PYTHONPATH=. ../.venv/bin/pytest tests/test_british_auction.py -v
```

1. `test_create_rfq_and_british_auction`: RFQ and Auction entity lifecycle.
2. `test_supplier_bidding_and_leaderboard`: Landed quote calculation and rank assignments.
3. `test_multi_attribute_tie_breaking`: Shorter transit time breaking price ties.
4. `test_duplicate_bid_prevention`: Rejection of identical bid amounts from the same supplier.
5. `test_anti_sniping_extension_triggered`: Extension applied when bid arrives in trigger window.
6. `test_extension_outside_window_not_triggered`: Standard bids outside window do not extend deadline.
7. `test_forced_close_ceiling_enforced`: Safeguard prevents extensions past buyer's ceiling.
8. `test_closed_auction_rejects_bids`: Sealed bids rejected after auction conclusion.
9. `test_pessimistic_locking_concurrency`: Concurrent bids handled deterministically without race conditions.
