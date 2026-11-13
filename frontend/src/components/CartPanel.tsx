import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CartSummary, Product } from '../types';
import { productsApi } from '../api/products';
import { Plus, Minus, Trash2, AlertCircle, HelpCircle } from 'lucide-react';

interface CartPanelProps {
  cart: CartSummary;
  onUpdateQuantity: (productId: number, quantity: number) => void;
  onRemoveItem: (productId: number) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  isCheckingOut: boolean;
  checkoutError: string | null;
}

export const CartPanel: React.FC<CartPanelProps> = ({
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onCheckout,
  isCheckingOut,
  checkoutError,
}) => {
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [stockWarning, setStockWarning] = useState<string | null>(null);

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        setIsLoadingCatalog(true);
        const prods = await productsApi.list();
        setCatalog(prods.filter((p) => p.is_active));
      } catch (err) {
        console.error('Failed to load product catalog for manual add:', err);
      } finally {
        setIsLoadingCatalog(false);
      }
    };
    fetchCatalog();
  }, []);

  const getProductMaxStock = (productId: number): number => {
    const prod = catalog.find((p) => p.id === productId);
    if (prod) return prod.stock;
    const item = cart.items.find((i) => i.product_id === productId);
    if (item && item.available_stock !== undefined && item.available_stock !== null) {
      return item.available_stock;
    }
    return 999;
  };

  const handleManualAdd = () => {
    if (!selectedProductId) return;
    const maxStock = getProductMaxStock(Number(selectedProductId));
    const prod = catalog.find((p) => p.id === Number(selectedProductId));
    const existing = cart.items.find((i) => i.product_id === Number(selectedProductId));
    const newQty = existing ? existing.quantity + 1 : 1;

    if (newQty > maxStock) {
      setStockWarning(`Only ${maxStock} units of "${prod?.name || 'this item'}" available in stock.`);
      return;
    }

    setStockWarning(null);
    onUpdateQuantity(Number(selectedProductId), newQty);
    setSelectedProductId('');
  };

  const handleIncrement = (productId: number, currentQty: number) => {
    const maxStock = getProductMaxStock(productId);
    const prod = catalog.find((p) => p.id === productId);
    const name = prod?.name || cart.items.find((i) => i.product_id === productId)?.product_name || 'Item';

    if (currentQty + 1 > maxStock) {
      setStockWarning(`Only ${maxStock} in stock for "${name}".`);
      return;
    }

    setStockWarning(null);
    onUpdateQuantity(productId, currentQty + 1);
  };

  const formatRupees = (paise: number) => {
    return (paise / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    });
  };

  const todayDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="receipt-paper border border-counter-grey receipt-torn-bottom rounded-t-panel flex flex-col h-full shadow-sm text-ink font-body">
      {/* Receipt Shop Header */}
      <div className="p-4 border-b border-counter-grey bg-paper/60 flex items-start justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-heading font-bold text-base text-ink tracking-tight">VisionCart</span>
            <span className="text-[11px] text-ink-muted">· Store Counter</span>
          </div>
          <p className="text-xs text-ink-muted mt-0.5">{todayDate}</p>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            to="/guide#guide-4"
            className="text-ink-muted hover:text-ink p-1 rounded-control hover:bg-counter-light transition-colors"
            title="Cart guide"
          >
            <HelpCircle className="w-4 h-4" />
          </Link>
          {cart.items.length > 0 && (
            <button
              onClick={onClearCart}
              disabled={isCheckingOut}
              className="text-xs text-ink-muted hover:text-signal flex items-center space-x-1 px-2 py-1 rounded-control hover:bg-signal-tint transition-colors disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Manual Product Search / Catalog Bar */}
      <div className="p-3 border-b border-counter-grey bg-paper flex items-center gap-2">
        <select
          value={selectedProductId}
          onChange={(e) => {
            setSelectedProductId(e.target.value ? Number(e.target.value) : '');
            setStockWarning(null);
          }}
          disabled={isLoadingCatalog || isCheckingOut}
          className="flex-1 bg-surface border border-counter-grey rounded-control px-3 py-2 text-xs text-ink focus:outline-none focus:border-primary"
        >
          <option value="">Search or select product from catalog...</option>
          {catalog.map((prod) => (
            <option key={prod.id} value={prod.id}>
              {prod.name} (₹{(prod.price_paise / 100).toFixed(2)}) · {prod.stock} in stock
            </option>
          ))}
        </select>
        <button
          onClick={handleManualAdd}
          disabled={!selectedProductId || isCheckingOut}
          className="px-3.5 py-2 bg-surface hover:bg-counter-light border border-counter-grey disabled:opacity-40 text-ink rounded-control text-xs font-semibold flex items-center space-x-1 transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-primary" />
          <span>Add</span>
        </button>
      </div>

      {/* Insufficient Stock Warning */}
      {stockWarning && (
        <div className="mx-3 mt-3 p-2.5 bg-signal-tint border border-signal/20 rounded-control text-xs text-signal flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-signal flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block">Stock limit</span>
            <span className="text-[11px] text-signal">{stockWarning}</span>
          </div>
          <button
            onClick={() => setStockWarning(null)}
            className="text-signal hover:text-red-900 text-xs px-1 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Receipt Line Items List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[160px]">
        {cart.items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-ink-muted">
            <p className="text-sm font-medium text-ink">Receipt is empty</p>
            <p className="text-xs text-ink-muted max-w-xs mt-1.5 leading-relaxed">
              Hold an item up to the camera or search the catalog below.
            </p>
          </div>
        ) : (
          cart.items.map((item) => {
            const maxStock = getProductMaxStock(item.product_id);
            const isAtMax = item.quantity >= maxStock;

            return (
              <div
                key={item.product_id}
                className="animate-receipt-item flex items-center justify-between gap-3 text-xs border-b border-counter-grey/60 pb-2.5 last:border-b-0"
              >
                {/* Item Details */}
                <div className="flex-1 min-w-0 pr-1">
                  <p className="font-medium text-ink truncate text-sm">{item.product_name}</p>
                  <div className="flex items-center space-x-2 text-[11px] text-ink-muted font-mono tabular-nums mt-0.5">
                    <span>{formatRupees(item.unit_price_paise)} ea</span>
                    <span>·</span>
                    <span>GST {item.gst_rate}%</span>
                  </div>
                </div>

                {/* 44px Accessible Touch Stepper */}
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => {
                      setStockWarning(null);
                      onUpdateQuantity(item.product_id, item.quantity - 1);
                    }}
                    disabled={isCheckingOut}
                    aria-label={`Decrease quantity of ${item.product_name}`}
                    className="min-w-[40px] min-h-[40px] rounded-control border border-counter-grey bg-paper hover:bg-counter-light text-ink flex items-center justify-center transition-colors disabled:opacity-40"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <span className="w-8 text-center font-mono tabular-nums font-bold text-sm text-ink">
                    {item.quantity}
                  </span>

                  <button
                    onClick={() => handleIncrement(item.product_id, item.quantity)}
                    disabled={isCheckingOut || isAtMax}
                    aria-label={`Increase quantity of ${item.product_name}`}
                    className={`min-w-[40px] min-h-[40px] rounded-control border flex items-center justify-center transition-colors ${
                      isAtMax
                        ? 'border-counter-grey/60 bg-counter-light text-ink-muted/40 cursor-not-allowed'
                        : 'border-counter-grey bg-paper hover:bg-counter-light text-ink'
                    }`}
                    title={isAtMax ? `Stock limit reached (${maxStock})` : 'Increase quantity'}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Line Total in Tabular Mono */}
                <div className="text-right pl-1 min-w-[70px]">
                  <span className="font-mono tabular-nums font-semibold text-ink text-sm block">
                    {formatRupees(item.line_total_paise)}
                  </span>
                  <button
                    onClick={() => {
                      setStockWarning(null);
                      onRemoveItem(item.product_id);
                    }}
                    disabled={isCheckingOut}
                    className="text-[11px] text-ink-muted hover:text-signal transition-colors disabled:opacity-40 mt-0.5"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Checkout Error */}
      {checkoutError && (
        <div className="mx-4 mb-2 p-3 bg-signal-tint border border-signal/20 rounded-control text-xs text-signal flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-signal flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Checkout error</p>
            <p className="text-[11px] text-signal mt-0.5 leading-relaxed">{checkoutError}</p>
          </div>
        </div>
      )}

      {/* Dashed divider */}
      <div className="border-t border-dashed border-counter-grey mx-4" />

      {/* Receipt Financial Totals (DM Mono, Tabular Numerals) */}
      <div className="p-4 space-y-1.5 font-mono tabular-nums text-xs bg-paper/40">
        <div className="flex justify-between text-ink-muted">
          <span>Taxable value</span>
          <span>{formatRupees(cart.subtotal_paise)}</span>
        </div>
        <div className="flex justify-between text-ink-muted">
          <span>CGST</span>
          <span>{formatRupees(cart.cgst_total_paise ?? cart.cgst_paise ?? 0)}</span>
        </div>
        <div className="flex justify-between text-ink-muted">
          <span>SGST</span>
          <span>{formatRupees(cart.sgst_total_paise ?? cart.sgst_paise ?? 0)}</span>
        </div>
        {cart.rounding_paise !== 0 && (
          <div className="flex justify-between text-ink-muted">
            <span>Rounding</span>
            <span>{formatRupees(cart.rounding_paise)}</span>
          </div>
        )}

        <div className="border-t border-counter-grey pt-2 mt-2 flex justify-between items-baseline font-body">
          <span className="text-base font-heading font-bold text-ink">Total</span>
          <span className="text-2xl font-mono tabular-nums font-bold text-primary">
            {formatRupees(cart.grand_total_paise ?? cart.total_paise ?? 0)}
          </span>
        </div>

        {/* Full-width bottle green action button */}
        <button
          onClick={onCheckout}
          disabled={cart.items.length === 0 || isCheckingOut}
          className="w-full mt-3 py-3.5 px-4 rounded-control font-semibold text-sm bg-primary hover:bg-primary-hover disabled:bg-counter-grey disabled:text-ink-muted text-white flex items-center justify-center space-x-2 transition-colors shadow-sm disabled:cursor-not-allowed"
        >
          <span>
            {isCheckingOut
              ? 'Processing sale...'
              : cart.items.length === 0
              ? 'Add an item to continue'
              : 'Take payment'}
          </span>
        </button>
      </div>
    </div>
  );
};
