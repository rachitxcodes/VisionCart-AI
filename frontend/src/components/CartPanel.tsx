import React, { useState, useEffect } from 'react';
import { CartSummary, Product } from '../types';
import { productsApi } from '../api/products';
import { ShoppingBag, Plus, Minus, Trash2, ArrowRight, AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';

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

  const handleManualAdd = () => {
    if (!selectedProductId) return;
    const existing = cart.items.find((i) => i.product_id === Number(selectedProductId));
    const newQty = existing ? existing.quantity + 1 : 1;
    onUpdateQuantity(Number(selectedProductId), newQty);
    setSelectedProductId('');
  };

  const formatRupees = (paise: number) => {
    return (paise / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-full shadow-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-semibold text-sm text-white flex items-center gap-1.5">
              <span>Customer Cart</span>
              {cart.total_items_count > 0 && (
                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-indigo-500/30">
                  {cart.total_items_count} units
                </span>
              )}
            </h2>
          </div>
        </div>

        {cart.items.length > 0 && (
          <button
            onClick={onClearCart}
            disabled={isCheckingOut}
            className="text-xs text-slate-400 hover:text-rose-400 flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-rose-950/40 border border-slate-700/60 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Cart</span>
          </button>
        )}
      </div>

      {/* Manual Product Add Bar */}
      <div className="p-3 bg-slate-950/40 border-b border-slate-800 flex items-center gap-2">
        <select
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value ? Number(e.target.value) : '')}
          disabled={isLoadingCatalog || isCheckingOut}
          className="flex-1 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="">+ Add manual item from catalog...</option>
          {catalog.map((prod) => (
            <option key={prod.id} value={prod.id}>
              {prod.name} (₹{(prod.price_paise / 100).toFixed(2)}) - Stock: {prod.stock}
            </option>
          ))}
        </select>
        <button
          onClick={handleManualAdd}
          disabled={!selectedProductId || isCheckingOut}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white disabled:text-slate-500 rounded-xl text-xs font-semibold flex items-center space-x-1 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add</span>
        </button>
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 divide-y divide-slate-800/50">
        {cart.items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <div className="w-12 h-12 rounded-xl bg-slate-800/60 flex items-center justify-center mb-3 text-slate-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-400">Your cart is empty</p>
            <p className="text-xs text-slate-500 max-w-xs mt-1">
              Hold products in front of the camera or manually select from the dropdown above to add items.
            </p>
          </div>
        ) : (
          cart.items.map((item) => (
            <div
              key={item.product_id}
              className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-200 truncate">{item.product_name}</p>
                <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                  <span className="font-mono text-slate-500">{item.product_sku}</span>
                  <span>•</span>
                  <span>{formatRupees(item.unit_price_paise)} ea</span>
                  <span>•</span>
                  <span className="text-indigo-400">GST {item.gst_rate}%</span>
                </div>
              </div>

              {/* Quantity Controls */}
              <div className="flex items-center space-x-1.5 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => onUpdateQuantity(item.product_id, item.quantity - 1)}
                  disabled={isCheckingOut}
                  className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors disabled:opacity-50"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-7 text-center font-bold text-white text-xs">{item.quantity}</span>
                <button
                  onClick={() => onUpdateQuantity(item.product_id, item.quantity + 1)}
                  disabled={isCheckingOut}
                  className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors disabled:opacity-50"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {/* Line Total & Remove */}
              <div className="text-right flex items-center space-x-2">
                <span className="font-bold text-white text-xs whitespace-nowrap">
                  {formatRupees(item.line_total_paise)}
                </span>
                <button
                  onClick={() => onRemoveItem(item.product_id)}
                  disabled={isCheckingOut}
                  className="text-slate-500 hover:text-rose-400 p-1 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Error Banner */}
      {checkoutError && (
        <div className="m-3 p-3 bg-rose-950/80 border border-rose-800/80 rounded-xl text-xs text-rose-200 flex items-start space-x-2 shadow-lg">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Checkout Failed</p>
            <p className="text-[11px] text-rose-300 mt-0.5">{checkoutError}</p>
          </div>
        </div>
      )}

      {/* GST Calculation & Summary Box */}
      <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-2">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Taxable Value (Subtotal)</span>
          <span>{formatRupees(cart.subtotal_paise)}</span>
        </div>
        <div className="flex justify-between text-xs text-slate-400">
          <span>CGST (Central Tax)</span>
          <span>{formatRupees(cart.cgst_total_paise)}</span>
        </div>
        <div className="flex justify-between text-xs text-slate-400">
          <span>SGST (State Tax)</span>
          <span>{formatRupees(cart.sgst_total_paise)}</span>
        </div>
        {cart.rounding_paise !== 0 && (
          <div className="flex justify-between text-xs text-slate-400">
            <span>Rounding</span>
            <span>{formatRupees(cart.rounding_paise)}</span>
          </div>
        )}

        <div className="border-t border-slate-800 pt-2 flex justify-between items-baseline">
          <span className="text-sm font-bold text-white">Grand Total</span>
          <span className="text-xl font-extrabold text-emerald-400">
            {formatRupees(cart.grand_total_paise)}
          </span>
        </div>

        {/* Checkout Button */}
        <button
          onClick={onCheckout}
          disabled={cart.items.length === 0 || isCheckingOut}
          className="w-full mt-3 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-800 disabled:to-slate-800 text-white disabled:text-slate-500 flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 disabled:shadow-none transition-all hover:scale-[1.01]"
        >
          {isCheckingOut ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Processing Transaction...</span>
            </>
          ) : (
            <>
              <span>Pay & Generate Tax Invoice</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

