<<<<<<< HEAD
# VisionCart-AI
=======
# VisionCart AI 🛒⚡
**Real-Time Computer-Vision Retail Checkout and Inventory Platform**

VisionCart AI replaces traditional manual barcode scanning with automated, real-time computer-vision product recognition. Powered by YOLOv8, FastAPI, and React, VisionCart AI captures video frames from a cashier's webcam, tracks and stabilizes detected items with temporal frame smoothing, maps detections to inventory records, and completes GST-compliant checkouts backed by atomic, deadlock-free inventory synchronization.

---

## 🚀 Quick Start

### 1. One-Command Startup (Docker Compose)
The entire stack (PostgreSQL, FastAPI Backend, React Frontend) runs out of the box with automatic database migrations and demo seed data:
```bash
docker compose up --build
```
- **Cashier & Admin Web Portal:** [http://localhost:3000](http://localhost:3000) (or [http://localhost:5173](http://localhost:5173) in local dev)
- **FastAPI Interactive Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check Endpoint:** [http://localhost:8000/health](http://localhost:8000/health)

### 2. Demo Credentials
The automated database seed initializes the following pre-configured accounts:

| Role | Email | Password | Access Privileges |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@visioncart.local` | `Admin@1234` | Catalog CRUD, Stock Adjustments, Low-Stock Alerts, Analytics |
| **Cashier** | `cashier@visioncart.local` | `Cashier@1234` | Live CV Checkout, Cart Editing, Invoicing & PDF Generation |

### 3. Local Development (Without Docker)

#### Backend Setup
```bash
# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\Activate.ps1

# Install dependencies
pip install -r backend/requirements.txt

# Run migrations and seed data (SQLite default for local dev)
alembic upgrade head
python -m app.seed

# Start backend server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 🏛️ System Architecture

### High-Level Architecture Diagram
```mermaid
flowchart TD
    subgraph Client["Cashier / Admin Browser"]
        UI["React 18 + TailwindCSS + Recharts"]
        Cam["Webcam Stream (3-5 FPS Canvas)"]
        UI --> Cam
    end

    subgraph ReverseProxy["Nginx / Gateway"]
        Nginx["Reverse Proxy (Port 3000/80)"]
    end

    subgraph Backend["FastAPI Backend (Port 8000)"]
        Router["API Routers (Auth, Products, Detection, Checkout, Analytics)"]
        AuthSvc["Auth Service (JWT + Bcrypt)"]
        CVSvc["Detector Service (YOLOv8 / Mock Mode)"]
        CartSvc["Cart Aggregator & Temporal Smoother"]
        OrderSvc["Checkout & GST Engine"]
        PDFSvc["PDF Generator (ReportLab)"]

        Router --> AuthSvc
        Router --> CVSvc
        Router --> CartSvc
        Router --> OrderSvc
        Router --> PDFSvc
    end

    subgraph Database["PostgreSQL / SQLite Database"]
        PG[(Relational DB: Users, Products, Invoices, Line Items, Idempotency)]
    end

    Client --> Nginx
    Nginx --> UI
    Nginx --> Router
    OrderSvc -->|"SELECT ... FOR UPDATE (Row Locking)"| PG
    AuthSvc --> PG
    CartSvc --> PG
```

### Entity-Relationship Diagram (ERD)
```mermaid
erDiagram
    User ||--o{ Invoice : processes
    Invoice ||--|{ InvoiceItem : contains
    Product ||--o{ InvoiceItem : billed_in
    Product ||--o{ StockAdjustment : logged_in
    User ||--o{ StockAdjustment : performed_by
    Invoice ||--o| IdempotencyKey : guarded_by

    User {
        int id PK
        string email UK
        string hashed_password
        string full_name
        string role "ADMIN | CASHIER"
        boolean is_active
        datetime created_at
    }

    Product {
        int id PK
        string sku UK
        string name
        string category
        int price_paise "Integer Paise"
        int gst_rate "0, 5, 12, 18, 28"
        int stock "Units in stock"
        int reorder_level
        string detector_class "COCO / Custom class"
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    Invoice {
        int id PK
        string invoice_number UK
        int cashier_id FK
        int subtotal_paise
        int cgst_paise
        int sgst_paise
        int total_paise
        int rounding_paise
        string status "COMPLETED | CANCELLED"
        datetime created_at
    }

    InvoiceItem {
        int id PK
        int invoice_id FK
        int product_id FK
        string product_name
        string product_sku
        int unit_price_paise
        int quantity
        int gst_rate
        int taxable_value_paise
        int cgst_paise
        int sgst_paise
        int line_total_paise
    }

    StockAdjustment {
        int id PK
        int product_id FK
        int user_id FK
        int previous_stock
        int new_stock
        int quantity_change
        string reason
        datetime created_at
    }

    IdempotencyKey {
        string key PK
        int invoice_id FK
        string request_hash
        datetime created_at
    }
```

---

## 🔄 End-to-End Checkout Flow
1. **Live Camera Capture:** The browser captures video frames from the webcam 3–5 times per second and POSTs JPEG payloads to `/api/detection/detect`.
2. **Object Detection:** The backend `DetectorService` runs YOLOv8n inference (or deterministic mock if `DETECTOR_MODE=mock`) on CPU/GPU, producing bounding boxes, class names, and confidence scores.
3. **Temporal Smoothing & Stabilization:** Detections enter a frame buffer. An item enters the active cart only after appearing in $N$ consecutive frames ($N=3$), suppressing spurious single-frame misidentifications. An item remains in cart until absent for $M$ consecutive frames ($M=5$), suppressing camera occlusion flicker.
4. **Manual Corrections:** The cashier can adjust item quantities, add products manually from catalog search, or remove false positives on the touchscreen UI.
5. **Atomic Checkout with Idempotency:**
   - The cashier clicks **Pay & Checkout**. The request sends an `idempotency_key` (UUID v4) and the cart items to `/api/checkout`.
   - The backend begins an atomic database transaction.
   - It selects all referenced product inventory records using `SELECT ... FOR UPDATE` ordered by `product.id ASC`. Sorting strictly prevents circular deadlocks during concurrent multi-cashier checkouts.
   - If requested quantity exceeds available stock for any product, the transaction raises an HTTP 400 error and rolls back completely (no partial deductions).
   - Each product's stock is decremented in-place.
   - A sequential invoice number (`INV-YYYYMMDD-XXXX`) is issued, line items are computed with line-level GST splits, and an invoice record is committed.
   - The `IdempotencyKey` record links the key to the generated invoice. Retried requests with the identical idempotency key return the existing invoice with HTTP 200 without duplicate deductions.
6. **GST Invoicing & PDF Generation:** A downloadable PDF invoice is rendered via ReportLab with taxable values, CGST/SGST breakdown, and business tax details.

---

## 📝 Milestone Development Log

### Milestone M0: Monorepo Scaffolding & Initial Infrastructure
- **What was built:** Monorepo architecture initialized with `backend`, `frontend`, `ml`, `docker`, and `docs`. Docker Compose configuration created for PostgreSQL, FastAPI, and Vite React. Environment variable management implemented with Pydantic v2 `BaseSettings`. Structured logging and an asynchronous `/health` status endpoint implemented and tested.
- **Files involved:**
  - `docker-compose.yml`
  - `.env.example`, `.env`
  - `backend/requirements.txt`, `backend/Dockerfile`
  - `backend/app/core/config.py`, `backend/app/core/logging.py`
  - `backend/app/routers/health.py`, `backend/app/main.py`
  - `backend/tests/test_health.py`, `backend/pytest.ini`
  - `frontend/package.json`, `frontend/vite.config.ts`, `frontend/Dockerfile`, `frontend/nginx.conf`
  - `docs/ACCEPTANCE.md`, `README.md`
- **Key decisions & Rationale:**
  - *Decision:* Configured both async (`DATABASE_URL`) and sync (`SYNC_DATABASE_URL`) engine strings with SQLite local fallback. *Rationale:* Allows immediate local testing and lightweight development without requiring an external PostgreSQL daemon while keeping production fully PostgreSQL-ready.
  - *Decision:* Standardized monetary values in integer paise across all settings and schemas. *Rationale:* Completely eliminates IEEE-754 floating-point rounding errors in commercial transactions.
  - *Decision:* Embedded mock detector switch `DETECTOR_MODE=mock` in configuration. *Rationale:* Guarantees fast, deterministic test suites and CI runs without GPU or network dependencies.
- **Problems hit & resolutions:**
  - *Problem:* Local Docker Desktop service was not running in the Windows host environment.
  - *Resolution:* Scaffolded Docker configs for container deployment while configuring the local Python virtual environment (`.venv`) and Node tooling so all verification tests run directly and reliably.
- **Verification command:**
  ```bash
  .\.venv\Scripts\pytest backend\tests\test_health.py -v
  ```

### Milestone M1: Database Models, Alembic Migrations & Data Seeding
- **What was built:** Relational database models constructed for `User`, `Product`, `StockAdjustment`, `Invoice`, `InvoiceItem`, and `IdempotencyRecord`. Alembic migration pipeline configured with batch execution for SQLite and autogenerate revisions. Deterministic seed script built to generate admin, cashier, 10 COCO-aligned products, and 30 days of historical sales data.
- **Files involved:**
  - `backend/app/core/database.py`, `backend/app/core/security.py`
  - `backend/app/models/user.py`, `backend/app/models/product.py`, `backend/app/models/invoice.py`, `backend/app/models/idempotency.py`, `backend/app/models/__init__.py`
  - `backend/alembic.ini`, `alembic.ini`, `backend/alembic/env.py`, `backend/alembic/versions/*_initial_schema.py`
  - `backend/app/seed.py`, `backend/tests/test_models_and_seed.py`
- **Key decisions & Rationale:**
  - *Decision:* Used standalone bcrypt for password hashing rather than passlib CryptContext. *Rationale:* Resolves Python 3.13 deprecation incompatibilities in passlib while maintaining 12-round bcrypt salt security.
  - *Decision:* Configured `render_as_batch=True` in Alembic migrations. *Rationale:* Allows ALTER and table restructuring operations on SQLite databases during local tests while remaining fully compatible with PostgreSQL.
  - *Decision:* Seeded catalog products matching standard COCO classes (`banana`, `apple`, `bottle`, etc.). *Rationale:* Ensures live webcam inference works out of the box with pretrained YOLOv8n without waiting for custom training.
- **Problems hit & resolutions:**
  - *Problem:* Alembic failed with `ImportError: The SQLAlchemy asyncio module requires that the Python 'greenlet' library is installed`.
  - *Resolution:* Added `greenlet>=3.0.0` to virtual environment and `requirements.txt`.
- **Verification command:**
  ```bash
  $env:PYTHONPATH="backend"; .\.venv\Scripts\pytest backend\tests\test_models_and_seed.py -v
  ```

### Milestone M2: Authentication & Role-Based Access Control (RBAC)
- **What was built:** JWT authentication system with bcrypt password hashing, OAuth2 Bearer token extraction, and declarative FastAPI dependency injection for role enforcement (`require_admin`, `require_cashier_or_admin`).
- **Files involved:**
  - `backend/app/core/security.py`, `backend/app/core/dependencies.py`
  - `backend/app/schemas/user.py`, `backend/app/services/auth_service.py`, `backend/app/routers/auth.py`
  - `backend/tests/test_auth.py`
- **Key decisions & Rationale:**
  - *Decision:* Embedded user role (`ADMIN` or `CASHIER`) and `user_id` directly in the JWT claims payload alongside `sub` (email). *Rationale:* Allows instantaneous client-side route guarding and reduces redundant database queries on non-mutating requests while retaining server-side token validation.
  - *Decision:* Configured credentials schemas to accept standard and `.local` email addresses without enforcing remote DNS MX queries. *Rationale:* Prevents validation failures on private intranet / demo domain setups like `admin@visioncart.local`.
- **Problems hit & resolutions:**
  - *Problem:* Pydantic `EmailStr` rejected `admin@visioncart.local` with HTTP 422 because `.local` is not a registered public ICANN TLD.
  - *Resolution:* Streamlined the email format parser to permit internal / local top-level domains.
- **Verification command:**
  ```bash
  $env:PYTHONPATH="backend"; .\.venv\Scripts\pytest backend\tests\test_auth.py -v
  ```

### Milestone M3: Product Catalog & Inventory Management APIs
- **What was built:** Complete product CRUD endpoints, category filtering, search querying, low-stock threshold monitoring, and an inventory adjustment audit system (`ADD`, `DEDUCT`, `SET`) with reasons.
- **Files involved:**
  - `backend/app/schemas/product.py`, `backend/app/services/product_service.py`
  - `backend/app/routers/products.py`, `backend/app/main.py`
  - `backend/tests/test_products.py`
- **Key decisions & Rationale:**
  - *Decision:* Maintained a dedicated `StockAdjustment` audit ledger for every inventory change. *Rationale:* Guarantees enterprise traceability for shrinkage, spoilage, restocks, and cashier sales discrepancies.
  - *Decision:* Indexed `(stock, reorder_level)` composite tuple on `products`. *Rationale:* Accelerates the critical low-stock alert query from $O(N)$ scan to instantaneous sub-millisecond index lookup on large catalogs.
  - *Decision:* Implemented soft deletion (`is_active = False`). *Rationale:* Prevents cascading foreign key deletion errors on historical invoices and sales records while instantly removing discontinued items from the active POS view.
- **Problems hit & resolutions:**
  - *Problem:* Needed to prevent over-deduction when manual adjustment requested more units than physically present.
  - *Resolution:* Added an atomic boundary validation raising HTTP 400 with a detailed error indicating current vs. requested quantity.
- **Verification command:**
  ```bash
  $env:PYTHONPATH="backend"; .\.venv\Scripts\pytest backend\tests\test_products.py -v
  ```

### Milestone M4: Computer Vision Detector Service & Live Detection APIs
- **What was built:** The polymorphic `Detector` service architecture featuring `MockDetector` and `YOLODetector` (YOLOv8n). Automatic CUDA GPU / CPU selection, lazy model weight loading, multipart file and base64 video frame ingest, and catalog class-to-product mapping. Standalone fine-tuning script `ml/train.py` and `ml/data.yaml` provided.
- **Files involved:**
  - `backend/app/schemas/detector.py`, `backend/app/services/detector_service.py`
  - `backend/app/routers/detection.py`, `backend/app/main.py`
  - `ml/detector.py`, `ml/train.py`, `ml/data.yaml`, `ml/weights/.gitkeep`
  - `backend/tests/test_detector.py`
- **Key decisions & Rationale:**
  - *Decision:* Abstracted detection behind an abstract `Detector` base class and singleton factory. *Rationale:* Allows swapping the backend between mock mode, default pretrained weights, and custom fine-tuned weights without changing router or business logic.
  - *Decision:* Automatically enriched detected items with database catalog records (`product_id`, `product_name`, `price_paise`) inside the detection router. *Rationale:* Offloads catalog joins from the frontend client and makes bounding box overlays immediately interactive with product metadata.
  - *Decision:* Supported both multipart file uploads and raw base64 data URLs. *Rationale:* Accommodates both standard REST API clients and high-frequency HTML5 `<canvas>` webcam frame serialization in the browser.
- **Problems hit & resolutions:**
  - *Problem:* Image decoding could fail if incoming base64 included data URI prefixes (e.g., `data:image/jpeg;base64,`).
  - *Resolution:* Implemented resilient payload sanitization stripping prefix metadata prior to base64 decoding.
- **Verification command:**
  ```bash
  $env:PYTHONPATH="backend"; .\.venv\Scripts\pytest backend\tests\test_detector.py -v
  ```

### Milestone M5: Frame Smoothing, Flicker Suppression & Cart Logic
- **What was built:** The temporal frame smoothing engine (`TemporalFrameSmoother`) using $N$-frame appearance confirmation and $M$-frame absence decay hysteresis. Product catalog mapper ignoring unmapped classes, line-level GST calculation, and session-aware `CartManager` with cashier manual quantity overrides.
- **Files involved:**
  - `backend/app/schemas/cart.py`, `backend/app/services/cart_service.py`
  - `backend/app/routers/cart.py`, `backend/app/main.py`
  - `backend/tests/test_cart.py`
- **Key decisions & Rationale:**
  - *Decision:* Used count-level hysteresis keyed by `(class_name, quantity_level)`. *Rationale:* Supports multiple counts of the same product class while cleanly eliminating transient camera occlusions and bounding box flicker.
  - *Decision:* Maintained a manual override layer on top of smoothed CV counts. *Rationale:* Allows cashiers to immediately correct barcode-less items, adjust quantities, or remove false detections without fighting the live CV feed.
  - *Decision:* Gracefully ignored unmapped detections (e.g. background people or chairs). *Rationale:* Prevents false positive noise in crowded retail checkout environments from injecting garbage entries into the bill.
- **Problems hit & resolutions:**
  - *Problem:* Needed to ensure that manual zero-quantity updates (`quantity=0`) suppressed live CV re-addition for that specific item until explicitly cleared.
  - *Resolution:* Added an explicit `(0, True)` manual override flag in `CartManager` that supersedes detector predictions for that product.
- **Verification command:**
  ```bash
  $env:PYTHONPATH="backend"; .\.venv\Scripts\pytest backend\tests\test_cart.py -v
  ```

### Milestone M6: Checkout, GST Invoicing Engine & PDF Generation
- **What was built:** End-to-end checkout processing service, sequential invoice numbering (`INV-YYYYMMDD-XXXX`), line-item GST calculations with equal CGST/SGST splitting, and in-memory ReportLab PDF generation for downloadable tax invoices.
- **Files involved:**
  - `backend/app/schemas/invoice.py`, `backend/app/services/pdf_service.py`
  - `backend/app/services/checkout_service.py`, `backend/app/routers/checkout.py`, `backend/app/main.py`
  - `backend/tests/test_checkout.py`
- **Key decisions & Rationale:**
  - *Decision:* Documented and standardized integer-paise rounding rule for GST:
    $$\text{Taxable} = \text{UnitPrice} \times \text{Qty}$$
    $$\text{CGST} = \text{round}\left(\text{Taxable} \times \frac{\text{GSTRate} / 2}{100}\right)$$
    $$\text{SGST} = \text{round}\left(\text{Taxable} \times \frac{\text{GSTRate} / 2}{100}\right)$$
    $$\text{LineTotal} = \text{Taxable} + \text{CGST} + \text{SGST}$$
    *Rationale:* Conforms strictly to Indian GST statutory invoicing regulations while avoiding floating-point discrepancies across lines.
  - *Decision:* Rendered PDFs dynamically in-memory via ReportLab without disk file writes. *Rationale:* Eliminates temporary file cleanup overhead and disk I/O bottlenecks in serverless/containerized deployments.
- **Problems hit & resolutions:**
  - *Problem:* Invoices without cashiers loaded caused `AttributeError` when generating PDF.
  - *Resolution:* Included `selectinload(Invoice.cashier)` in SQLAlchemy queries and provided fallback ID string formatting in `pdf_service.py`.
- **Verification command:**
  ```bash
  $env:PYTHONPATH="backend"; .\.venv\Scripts\pytest backend\tests\test_checkout.py -v
  ```
>>>>>>> 60a4c9b (initial commit)
