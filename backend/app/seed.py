import random
import datetime
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import SyncSessionLocal, Base, sync_engine
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.product import Product, StockAdjustment
from app.models.invoice import Invoice, InvoiceItem
from app.models.idempotency import IdempotencyRecord


def seed_database(db: Session = None) -> None:
    """Populate database with default admin, cashier, COCO-mapped products, and 30-day historical invoices."""
    close_session = False
    if db is None:
        # Create all tables if not already existing
        Base.metadata.create_all(bind=sync_engine)
        db = SyncSessionLocal()
        close_session = True

    try:
        # 1. Seed Admin and Cashier Users
        admin_user = db.query(User).filter(User.email == settings.SEED_ADMIN_EMAIL).first()
        if not admin_user:
            admin_user = User(
                email=settings.SEED_ADMIN_EMAIL,
                hashed_password=hash_password(settings.SEED_ADMIN_PASSWORD),
                full_name="VisionCart Administrator",
                role=UserRole.ADMIN.value,
                is_active=True,
            )
            db.add(admin_user)
            db.flush()
            print(f"[Seed] Created Admin user: {settings.SEED_ADMIN_EMAIL}")

        cashier_user = db.query(User).filter(User.email == settings.SEED_CASHIER_EMAIL).first()
        if not cashier_user:
            cashier_user = User(
                email=settings.SEED_CASHIER_EMAIL,
                hashed_password=hash_password(settings.SEED_CASHIER_PASSWORD),
                full_name="VisionCart Cashier 1",
                role=UserRole.CASHIER.value,
                is_active=True,
            )
            db.add(cashier_user)
            db.flush()
            print(f"[Seed] Created Cashier user: {settings.SEED_CASHIER_EMAIL}")

        # 2. Seed COCO-Mapped Product Catalog
        demo_products = [
            {
                "sku": "PRD-BAN-001",
                "name": "Fresh Organic Banana",
                "category": "Fruits",
                "price_paise": 6000,  # ₹60.00
                "gst_rate": 0,
                "stock": 150,
                "reorder_level": 30,
                "detector_class": "banana",
            },
            {
                "sku": "PRD-APP-002",
                "name": "Shimla Red Apple",
                "category": "Fruits",
                "price_paise": 18000,  # ₹180.00
                "gst_rate": 0,
                "stock": 120,
                "reorder_level": 25,
                "detector_class": "apple",
            },
            {
                "sku": "PRD-ORG-003",
                "name": "Nagpur Sweet Orange",
                "category": "Fruits",
                "price_paise": 9000,  # ₹90.00
                "gst_rate": 0,
                "stock": 100,
                "reorder_level": 20,
                "detector_class": "orange",
            },
            {
                "sku": "PRD-BOT-004",
                "name": "Mineral Water Bottle 1L",
                "category": "Beverages",
                "price_paise": 4000,  # ₹40.00
                "gst_rate": 18,
                "stock": 200,
                "reorder_level": 40,
                "detector_class": "bottle",
            },
            {
                "sku": "PRD-CUP-005",
                "name": "Ceramic Coffee Mug",
                "category": "Crockery",
                "price_paise": 25000,  # ₹250.00
                "gst_rate": 12,
                "stock": 60,
                "reorder_level": 15,
                "detector_class": "cup",
            },
            {
                "sku": "PRD-SND-006",
                "name": "Artisan Club Sandwich",
                "category": "Bakery & Snacks",
                "price_paise": 12000,  # ₹120.00
                "gst_rate": 5,
                "stock": 45,
                "reorder_level": 10,
                "detector_class": "sandwich",
            },
            {
                "sku": "PRD-DON-007",
                "name": "Glazed Chocolate Donut",
                "category": "Bakery & Snacks",
                "price_paise": 7500,  # ₹75.00
                "gst_rate": 18,
                "stock": 50,
                "reorder_level": 15,
                "detector_class": "donut",
            },
            {
                "sku": "PRD-CAK-008",
                "name": "Red Velvet Pastry Cake",
                "category": "Bakery & Snacks",
                "price_paise": 35000,  # ₹350.00
                "gst_rate": 18,
                "stock": 35,
                "reorder_level": 10,
                "detector_class": "cake",
            },
            {
                "sku": "PRD-BWL-009",
                "name": "Porcelain Salad Bowl",
                "category": "Crockery",
                "price_paise": 32000,  # ₹320.00
                "gst_rate": 12,
                "stock": 6,  # Below reorder level (15) to trigger low stock alert
                "reorder_level": 15,
                "detector_class": "bowl",
            },
            {
                "sku": "PRD-PIZ-010",
                "name": "Farmhouse Veggie Pizza (M)",
                "category": "Prepared Foods",
                "price_paise": 39900,  # ₹399.00
                "gst_rate": 5,
                "stock": 4,  # Below reorder level (12) to trigger low stock alert
                "reorder_level": 12,
                "detector_class": "pizza",
            },
        ]

        created_products = []
        for p_data in demo_products:
            prod = db.query(Product).filter(Product.sku == p_data["sku"]).first()
            if not prod:
                prod = Product(**p_data)
                db.add(prod)
                db.flush()
                # Log initial stock adjustment
                adj = StockAdjustment(
                    product_id=prod.id,
                    user_id=admin_user.id,
                    previous_stock=0,
                    new_stock=prod.stock,
                    quantity_change=prod.stock,
                    reason="INITIAL_CATALOG_SEED",
                )
                db.add(adj)
            created_products.append(prod)

        db.commit()
        print(f"[Seed] Verified {len(created_products)} demo catalog products.")

        # 3. Seed 30 Days of Historical Invoices for Analytics Dashboard
        existing_invoices_count = db.query(Invoice).count()
        if existing_invoices_count < 10:
            print("[Seed] Generating 30 days of synthetic historical sales data...")
            random.seed(42)  # Deterministic seed for repeatable analytics figures
            now = datetime.datetime.now(datetime.timezone.utc)
            invoice_counter = 1

            for day_offset in range(30, 0, -1):
                day_date = now - datetime.timedelta(days=day_offset)
                # 2 to 6 orders per day
                daily_orders = random.randint(2, 6)
                for _ in range(daily_orders):
                    # Random time during business hours (9 AM to 9 PM)
                    order_hour = random.randint(9, 20)
                    order_minute = random.randint(0, 59)
                    order_second = random.randint(0, 59)
                    order_timestamp = day_date.replace(
                        hour=order_hour, minute=order_minute, second=order_second
                    )

                    # Select 1 to 4 distinct products
                    selected_products = random.sample(created_products, k=random.randint(1, 4))
                    inv_subtotal = 0
                    inv_cgst = 0
                    inv_sgst = 0
                    line_items_data = []

                    for prod in selected_products:
                        qty = random.randint(1, 3)
                        taxable = prod.price_paise * qty
                        half_rate = prod.gst_rate / 2.0
                        cgst = round(taxable * (half_rate / 100.0))
                        sgst = round(taxable * (half_rate / 100.0))
                        line_tot = taxable + cgst + sgst

                        inv_subtotal += taxable
                        inv_cgst += cgst
                        inv_sgst += sgst

                        line_items_data.append({
                            "product_id": prod.id,
                            "product_name": prod.name,
                            "product_sku": prod.sku,
                            "unit_price_paise": prod.price_paise,
                            "quantity": qty,
                            "gst_rate": prod.gst_rate,
                            "taxable_value_paise": taxable,
                            "cgst_paise": cgst,
                            "sgst_paise": sgst,
                            "line_total_paise": line_tot,
                        })

                    inv_total = inv_subtotal + inv_cgst + inv_sgst
                    inv_num = f"INV-{order_timestamp.strftime('%Y%m%d')}-{invoice_counter:04d}"
                    invoice_counter += 1

                    invoice = Invoice(
                        invoice_number=inv_num,
                        cashier_id=cashier_user.id,
                        subtotal_paise=inv_subtotal,
                        cgst_paise=inv_cgst,
                        sgst_paise=inv_sgst,
                        total_paise=inv_total,
                        rounding_paise=0,
                        status="COMPLETED",
                        created_at=order_timestamp,
                    )
                    db.add(invoice)
                    db.flush()

                    for item_data in line_items_data:
                        item = InvoiceItem(
                            invoice_id=invoice.id,
                            **item_data
                        )
                        db.add(item)

            db.commit()
            print(f"[Seed] Successfully seeded 30 days of historical invoices ({invoice_counter - 1} invoices).")
        else:
            print(f"[Seed] Found {existing_invoices_count} existing invoices, skipping historical generation.")

    except Exception as exc:
        db.rollback()
        print(f"[Seed] Error during seeding: {exc}")
        raise
    finally:
        if close_session:
            db.close()


if __name__ == "__main__":
    seed_database()

