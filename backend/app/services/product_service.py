from typing import List, Optional
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.product import Product, StockAdjustment
from app.schemas.product import ProductCreate, ProductUpdate, StockAdjustmentCreate


class ProductService:
    @staticmethod
    async def get_products(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        category: Optional[str] = None,
        active_only: bool = True,
    ) -> List[Product]:
        query = select(Product)
        if active_only:
            query = query.filter(Product.is_active == True)
        if category:
            query = query.filter(Product.category == category)
        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    Product.name.ilike(search_pattern),
                    Product.sku.ilike(search_pattern),
                    Product.detector_class.ilike(search_pattern),
                )
            )
        query = query.order_by(Product.name.asc()).offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def get_low_stock_products(db: AsyncSession) -> List[Product]:
        """Retrieve products whose current stock is less than or equal to reorder level."""
        query = (
            select(Product)
            .filter(Product.is_active == True)
            .filter(Product.stock <= Product.reorder_level)
            .order_by(Product.stock.asc())
        )
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def get_product_by_id(db: AsyncSession, product_id: int) -> Optional[Product]:
        result = await db.execute(select(Product).filter(Product.id == product_id))
        return result.scalars().first()

    @staticmethod
    async def get_product_by_sku(db: AsyncSession, sku: str) -> Optional[Product]:
        result = await db.execute(select(Product).filter(Product.sku == sku))
        return result.scalars().first()

    @staticmethod
    async def get_product_by_detector_class(
        db: AsyncSession, detector_class: str
    ) -> Optional[Product]:
        result = await db.execute(
            select(Product)
            .filter(Product.detector_class == detector_class)
            .filter(Product.is_active == True)
        )
        return result.scalars().first()

    @classmethod
    async def create_product(
        cls, db: AsyncSession, product_in: ProductCreate, user_id: int
    ) -> Product:
        existing = await cls.get_product_by_sku(db, product_in.sku)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product with SKU '{product_in.sku}' already exists.",
            )

        product = Product(
            name=product_in.name,
            sku=product_in.sku,
            category=product_in.category,
            price_paise=product_in.price_paise,
            gst_rate=product_in.gst_rate,
            stock=product_in.stock,
            reorder_level=product_in.reorder_level,
            detector_class=product_in.detector_class.lower() if product_in.detector_class else None,
            is_active=product_in.is_active,
        )
        db.add(product)
        await db.flush()

        # Log initial stock adjustment if stock > 0
        if product.stock > 0:
            adj = StockAdjustment(
                product_id=product.id,
                user_id=user_id,
                previous_stock=0,
                new_stock=product.stock,
                quantity_change=product.stock,
                reason="INITIAL_PRODUCT_CREATION",
            )
            db.add(adj)

        await db.commit()
        await db.refresh(product)
        return product

    @classmethod
    async def update_product(
        cls,
        db: AsyncSession,
        product: Product,
        product_in: ProductUpdate,
        user_id: int,
    ) -> Product:
        update_data = product_in.model_dump(exclude_unset=True)

        if "sku" in update_data and update_data["sku"] != product.sku:
            existing = await cls.get_product_by_sku(db, update_data["sku"])
            if existing and existing.id != product.id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Product with SKU '{update_data['sku']}' already exists.",
                )

        if "detector_class" in update_data and update_data["detector_class"]:
            update_data["detector_class"] = update_data["detector_class"].lower()

        # Handle direct stock update if provided
        if "stock" in update_data and update_data["stock"] != product.stock:
            new_stock = update_data["stock"]
            adj = StockAdjustment(
                product_id=product.id,
                user_id=user_id,
                previous_stock=product.stock,
                new_stock=new_stock,
                quantity_change=new_stock - product.stock,
                reason="DIRECT_PRODUCT_UPDATE",
            )
            db.add(adj)

        for field, value in update_data.items():
            setattr(product, field, value)

        await db.commit()
        await db.refresh(product)
        return product

    @classmethod
    async def adjust_stock(
        cls,
        db: AsyncSession,
        product: Product,
        adjustment_in: StockAdjustmentCreate,
        user_id: int,
    ) -> Product:
        prev_stock = product.stock
        action = adjustment_in.action
        qty = adjustment_in.quantity

        if action == "ADD":
            new_stock = prev_stock + qty
            qty_change = qty
        elif action == "DEDUCT":
            if prev_stock < qty:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot deduct {qty} units; only {prev_stock} units available in stock.",
                )
            new_stock = prev_stock - qty
            qty_change = -qty
        elif action == "SET":
            new_stock = qty
            qty_change = new_stock - prev_stock
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid stock adjustment action: {action}",
            )

        product.stock = new_stock
        adj = StockAdjustment(
            product_id=product.id,
            user_id=user_id,
            previous_stock=prev_stock,
            new_stock=new_stock,
            quantity_change=qty_change,
            reason=adjustment_in.reason,
        )
        db.add(adj)
        await db.commit()
        await db.refresh(product)
        return product

    @staticmethod
    async def delete_product(db: AsyncSession, product: Product) -> bool:
        # Soft delete by marking inactive
        product.is_active = False
        await db.commit()
        return True

    @staticmethod
    async def get_product_adjustments(
        db: AsyncSession, product_id: int
    ) -> List[StockAdjustment]:
        query = (
            select(StockAdjustment)
            .filter(StockAdjustment.product_id == product_id)
            .order_by(StockAdjustment.created_at.desc())
        )
        result = await db.execute(query)
        return list(result.scalars().all())

