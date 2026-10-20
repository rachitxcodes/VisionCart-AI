# VisionCart AI - Functional Acceptance Checklist

Status Legend:
- [ ] Not yet verified
- [x] Verified and passing

---

## 1. Authentication & Role-Based Access Control (RBAC)
- [x] Cashier and Admin login via JWT (/api/auth/login)
- [x] Token validation and auto-logout on expiration
- [x] Role protection: Cashier blocked from /admin routes and endpoints (HTTP 403)
- [x] Role protection: Admin has access to all management routes and endpoints
- [x] Password hashing with bcrypt, no plain text passwords stored

## 2. Product & Inventory Management (Admin)
- [x] Product CRUD (Create, Read, Update, Delete)
- [x] Fields supported: name, SKU, price (in paise), GST rate (0%, 5%, 12%, 18%, 28%), category, stock, reorder level, detector class label
- [x] Stock adjustments (Add / Deduct / Set) with reason tracking
- [x] Low-stock threshold alerts and low-stock list endpoint

## 3. Live Product Recognition (Cashier)
- [x] Browser webcam integration captures live frames (3-5 FPS)
- [x] Backend detector processes JPEG frames via YOLO or Mock mode
- [x] Bounding boxes, class names, and confidence scores returned
- [x] Detections visually overlaid on live video feed with canvas/SVG

## 4. Automatic Cart Building & Smoothing
- [x] Detections mapped to catalog products via `detector_class`
- [x] Temporal frame smoothing: Item added to cart only after $N$ consecutive appearances
- [x] Flicker suppression: Item removed from active detection only after $M$ frames of absence
- [x] Cashier can manually adjust quantities, add products, or remove items

## 5. Checkout & GST-Compliant Invoicing
- [x] GST calculation per line item: Taxable Value, CGST (rate/2), SGST (rate/2), Total
- [x] Documented rounding rule for fractional paise
- [x] Unique sequential invoice number generation (e.g. `INV-YYYYMMDD-XXXX`)
- [x] Professional PDF invoice generation and download

## 6. Atomic Inventory Sync & Idempotency
- [x] Invoice creation and stock deduction executed in ONE atomic database transaction
- [x] Row-level locking with `SELECT ... FOR UPDATE` sorted by Product ID to prevent deadlocks
- [x] Insufficient stock triggers clean rollback with HTTP 400 and itemized error message
- [x] Idempotency key prevents double billing and duplicate stock deductions on retries

## 7. Admin Analytics Dashboard
- [x] Daily revenue and invoice count trends
- [x] Top-selling products by quantity and revenue
- [x] Average Basket Value (ABV) calculation
- [x] Interactive Recharts visualizations
- [x] Low-stock alert cards with 1-click reorder indicators

## 8. One-Command Startup & DevOps
- [x] `docker compose up` starts Postgres, Backend, and Frontend cleanly
- [x] Automatic database migration applied on startup
- [x] Demo seed script initializes default users (Admin & Cashier), catalog, and 30-day historical data
- [x] CI pipeline validates backend tests (pytest), frontend build, and Docker builds
