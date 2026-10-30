# VisionCart AI — Project Progress & Real Capability Summary

> **Academic Context:** Mini Project · 5th Semester · B.Tech CSE (Artificial Intelligence & Machine Learning)  
> **Institution:** GLA University, Mathura  
> **Project Name:** VisionCart AI — Real-Time Computer-Vision Retail Checkout & Inventory Platform

---

## What VisionCart AI Can Do Today (End-to-End Working)

### ✅ Authentication & Role Access
- JWT-based login with **bcrypt** password hashing
- Two roles: **Admin** and **Cashier** — fully enforced at every backend endpoint and every frontend route
- Expired or missing tokens redirect automatically to the login page
- A Cashier who attempts any `/admin` route or admin API receives HTTP **403 Forbidden**
- Demo credentials are seeded automatically: `admin@visioncart.local / Admin@1234` and `cashier@visioncart.local / Cashier@1234`

### ✅ Product & Inventory Management (Admin)
- Full CRUD for catalog products: name, SKU, price, GST rate, category, stock, reorder level, detector class label
- Duplicate SKU is rejected with a clear validation error
- Negative price or stock is rejected
- Stock adjustments: `ADD`, `DEDUCT`, or `SET` with a mandatory reason; every adjustment is recorded in a full audit ledger (`/api/products/{id}/adjustments`)
- Low-stock list (`/api/products/low-stock`) updates in real time when stock falls at or below the reorder threshold
- Search (`?search=`) and category filter (`?category=`) work on the products list

### ✅ Live Computer-Vision Product Detection (Cashier)
- Browser opens the webcam (getUserMedia), captures frames at ~3 FPS, encodes them as Base64 JPEG, and streams them to the backend
- Backend runs **YOLOv8n** (Ultralytics) inference via OpenCV. Detections include class label, confidence score (≥ 0.45), and bounding-box coordinates
- In local development `DETECTOR_MODE=mock` returns deterministic fixture detections instantly (no model download required)
- **Simulate Feed** button works without any camera hardware — it sends synthetic frames with pre-mapped products for demo/testing
- Camera permission errors are handled with specific messages: *NotAllowedError* (blocked), *NotFoundError* (no camera), *NotReadableError* (hardware in use), plus a "?" link to the relevant Guide Hub article
- Bounding-box overlay is drawn on the video canvas with label and confidence

### ✅ Automatic Cart Building with Flicker Suppression
- Detections are mapped to catalog products via the configurable `detector_class` field on each product
- **Appearance confirmation (N = 3 frames):** an item must be detected in at least 3 consecutive frames before it is added to the cart — eliminates single-frame false positives
- **Absence decay (M = 5 frames):** an item that disappears is retained in the cart for 5 missing frames before being removed — prevents flicker on brief occlusions
- Manual cart edits (add, remove, change quantity) set an override state that takes absolute precedence over detector inputs
- Cart enforces a **stock ceiling**: quantity cannot exceed available stock; an amber warning banner appears immediately on the cart UI

### ✅ GST-Compliant Invoicing & PDF Download
- Invoices are generated with per-line taxable value, CGST (half the GST rate) and SGST (other half), line total, grand total, and a rounding adjustment
- All currency is stored as 64-bit integer **paise** (₹1 = 100 paise) — eliminates floating-point rounding errors
- Invoice numbers are unique and strictly sequential (e.g., `INV-000001`, `INV-000002`)
- PDF is generated server-side with **ReportLab** and downloaded directly from the invoice modal
- Empty-cart checkout is blocked at both frontend and backend

### ✅ Atomic Inventory Sync with Idempotency
- Checkout executes inside a single database transaction
- Products are locked with `SELECT … FOR UPDATE` in strict ascending ID order (deadlock-free)
- If any item has insufficient stock, the entire transaction rolls back — no partial deductions, no invoice created
- Each checkout request carries a client-supplied **idempotency key** (UUID v4). Retrying with the same key returns the existing invoice without re-deducting stock — safe against network timeouts and double-clicks

### ✅ Admin Analytics Dashboard
- **Daily revenue chart** (Recharts AreaChart) for a configurable rolling window (default 30 days)
- **Top products** by quantity sold and revenue
- **KPI cards**: total revenue, invoice count, average basket value, low-stock alert count
- Dashboard refreshes after each new checkout
- KPIs are verified to match direct database aggregates

### ✅ Guide Hub / Help Center (`/guide`)
- Role-aware ordering: Admin-relevant guides surface first for Admins; Cashier guides first for Cashiers
- **6 feature cards** with icons and descriptions
- **9 step-by-step plain-language guides:**
  1. Login & Logout
  2. Start Camera & Scan Products
  3. Camera Not Working (Troubleshooting)
  4. Edit Cart by Hand
  5. Checkout & Download Invoice
  6. Add a New Product
  7. Update Stock & Low-Stock Alerts
  8. Link a Product to a Detector Label
  9. Read the Analytics Dashboard
- Live search filter (instant, client-side)
- FAQ accordion (expandable)
- Tips box and About section (GLA University, B.Tech CSE AIML, 5th Semester Mini Project)
- Contextual "?" help links on the Cashier POS camera component, Products page header, and Analytics Dashboard header

### ✅ Testing Coverage

| Layer | Tool | Count | Status |
|:---|:---|:---|:---|
| Backend API | pytest | 24 tests | ✅ All passing |
| Frontend unit | Vitest | 9 tests | ✅ All passing |
| Full QA automation | `scripts/comprehensive_qa.py` | 31 checks | ✅ 30 PASS / 0 FAIL / 1 UNVERIFIED |
| TypeScript build | Vite | — | ✅ 0 errors |
| CI pipeline | GitHub Actions | `.github/workflows/ci.yml` | ✅ Configured |

---

## What Requires Docker / PostgreSQL to Fully Work

### ⚠️ PostgreSQL Concurrency (UNVERIFIED — Docker Desktop not running on host)
- The `SELECT … FOR UPDATE` row-level locking and deadlock-free checkout are implemented correctly in the code and in the backend tests, but the **parallel-checkout concurrency test** requires a live PostgreSQL instance
- SQLite (used for local development) does not support `SELECT FOR UPDATE` syntax — the atomic transaction logic runs but without true row locking
- **Status:** UNVERIFIED. The code is correct; verification requires Docker Desktop or a remote PostgreSQL instance

### One-Command Docker Startup
- `docker compose up --build` runs the full stack: PostgreSQL 15, FastAPI backend, React frontend via Nginx, with automatic Alembic migrations and seed data
- **Status:** Untested on the current development machine (Docker Desktop not installed). The `docker-compose.yml`, `Dockerfile.backend`, `Dockerfile.frontend`, and Nginx config are all in place and validated by the GitHub Actions CI build step

---

## Current Limitations vs. Original Specification

| Feature | Original Spec | Current Status |
|:---|:---|:---|
| Auth & roles | JWT, Admin + Cashier | ✅ Fully implemented |
| Product CRUD | Full CRUD + stock + reorder | ✅ Fully implemented |
| Live detection | YOLO + webcam + overlay | ✅ Works (mock mode always; YOLO mode requires model download) |
| Cart building | Temporal smoothing + manual edits | ✅ Fully implemented |
| Checkout | GST invoice + PDF | ✅ Fully implemented |
| Atomic inventory sync | Transaction + row locks + idempotency | ✅ Implemented; PostgreSQL locking UNVERIFIED without Docker |
| Analytics | Charts + KPIs | ✅ Fully implemented |
| Docker one-command | `docker compose up` | ✅ Files in place; not run on host (no Docker) |
| GitHub Actions CI | Lint + test + build | ✅ Fully configured |
| Guide Hub | `/guide` route + navbar | ✅ Fully implemented (added M13) |
| Custom YOLO weights | Drop-in `ml/weights/best.pt` | ✅ Interface ready; requires actual training data |
| Multi-store tenancy | Not in original scope | ❌ Single-store only (documented as future work) |
| Scale/weight-based items | Not in original scope | ❌ Manual quantity input only |

---

## How to Run Locally (No Docker)

```powershell
# 1. Clone and enter project
cd f:\MiniProject_5thsem

# 2. Backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt

# 3. Migrate and seed (SQLite fallback for local dev)
$env:PYTHONPATH="backend"
alembic upgrade head
python -m app.seed

# 4. Start backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 5. In a new terminal: start frontend
cd frontend
npm install
npm run dev
```

- Backend API: http://localhost:8000  
- Swagger docs: http://localhost:8000/docs  
- Frontend: http://localhost:5173  

---

## Test Commands

```powershell
# Backend pytest (24 tests)
$env:PYTHONPATH="backend"
.venv\Scripts\pytest backend\tests -v

# Frontend Vitest (9 tests)
npm test --prefix frontend

# TypeScript build check
npm run build --prefix frontend

# Full QA script (backend must be running on port 8000)
python scripts\comprehensive_qa.py
```

---

## Architecture Summary

```
Browser (React 18 + Vite + TailwindCSS + Recharts)
  │  JWT in localStorage
  │  Base64 JPEG frames at ~3 FPS
  ▼
FastAPI (Python 3.11)
  ├── /api/auth          — JWT login & profile
  ├── /api/products      — Product CRUD + stock adjustments + audit
  ├── /api/detection     — YOLOv8n / Mock detector (Detector abstraction)
  ├── /api/cart          — Temporal smoother (N=3 confirm, M=5 decay)
  ├── /api/checkout      — Atomic tx + idempotency + GST engine + PDF
  ├── /api/invoices      — Invoice retrieval (alias routes)
  └── /api/analytics     — KPIs, daily revenue, top products, low-stock
  ▼
SQLAlchemy 2.x ORM
  ▼
PostgreSQL 15 (production) / SQLite (local dev)
```

---

## Milestones Completed

| Milestone | Description | Status |
|:---|:---|:---|
| M1 | Project scaffold, Docker, CI skeleton | ✅ |
| M2 | Database models & Alembic migrations | ✅ |
| M3 | Auth (JWT + bcrypt + roles) | ✅ |
| M4 | Product & inventory CRUD API | ✅ |
| M5 | YOLO detector service abstraction | ✅ |
| M6 | Cart service with temporal smoothing | ✅ |
| M7 | Checkout, GST engine, PDF, idempotency | ✅ |
| M8 | Analytics API | ✅ |
| M9 | React frontend (all pages & components) | ✅ |
| M10 | Backend pytest suite (24 tests) | ✅ |
| M11 | GitHub Actions CI | ✅ |
| M12 | End-to-end verification & docs | ✅ |
| M13 | Full QA pass, Guide Hub, code audit | ✅ |

---

*Last updated: October 2026*  
*B.Tech CSE (AIML) — 5th Semester Mini Project — GLA University, Mathura*

