import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CameraFeed } from '../components/CameraFeed';
import { CartPanel } from '../components/CartPanel';
import { InvoiceModal } from '../components/InvoiceModal';
import { cartApi } from '../api/cart';
import { checkoutApi } from '../api/checkout';
import { CartSummary, DetectionItem, Invoice } from '../types';

const INITIAL_CART: CartSummary = {
  items: [],
  subtotal_paise: 0,
  cgst_total_paise: 0,
  sgst_total_paise: 0,
  rounding_paise: 0,
  grand_total_paise: 0,
  total_items_count: 0,
};

export const CashierPage: React.FC = () => {
  const [cart, setCart] = useState<CartSummary>(INITIAL_CART);
  const [sessionId] = useState<string>(() => `pos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  const [isProcessingCart, setIsProcessingCart] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  // Fetch initial cart from backend
  const fetchCart = useCallback(async () => {
    try {
      const currentCart = await cartApi.getCart(sessionIdRef.current);
      setCart(currentCart);
    } catch (err) {
      console.error('Failed to fetch cart:', err);
    }
  }, []);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // Handle live detections from CameraFeed
  const handleDetections = useCallback(async (detections: DetectionItem[]) => {
    if (isCheckingOut) return;
    try {
      setIsProcessingCart(true);
      const updatedCart = await cartApi.syncDetections(sessionIdRef.current, detections);
      setCart(updatedCart);
    } catch (err) {
      console.error('Failed to sync detections to cart:', err);
    } finally {
      setIsProcessingCart(false);
    }
  }, [isCheckingOut]);

  // Manual quantity updates
  const handleUpdateQuantity = async (productId: number, quantity: number) => {
    setCheckoutError(null);
    try {
      setIsProcessingCart(true);
      const updatedCart = await cartApi.updateItem(sessionId, productId, quantity);
      setCart(updatedCart);
    } catch (err: any) {
      console.error('Failed to update item quantity:', err);
    } finally {
      setIsProcessingCart(false);
    }
  };

  // Manual item removal
  const handleRemoveItem = async (productId: number) => {
    setCheckoutError(null);
    try {
      setIsProcessingCart(true);
      const updatedCart = await cartApi.removeItem(sessionId, productId);
      setCart(updatedCart);
    } catch (err: any) {
      console.error('Failed to remove item:', err);
    } finally {
      setIsProcessingCart(false);
    }
  };

  // Clear cart
  const handleClearCart = async () => {
    setCheckoutError(null);
    try {
      setIsProcessingCart(true);
      await cartApi.clearCart(sessionId);
      setCart(INITIAL_CART);
    } catch (err: any) {
      console.error('Failed to clear cart:', err);
    } finally {
      setIsProcessingCart(false);
    }
  };

  // Checkout execution with UUID idempotency key
  const handleCheckout = async () => {
    if (cart.items.length === 0 || isCheckingOut) return;
    setCheckoutError(null);
    setIsCheckingOut(true);

    try {
      const idempotencyKey = `chk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const payload = {
        session_id: sessionId,
        idempotency_key: idempotencyKey,
        items: cart.items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
      };

      const invoice = await checkoutApi.processCheckout(payload);
      setCompletedInvoice(invoice);
      setIsInvoiceModalOpen(true);
      setCart(INITIAL_CART);
    } catch (err: any) {
      console.error('Checkout failed:', err);
      const message =
        err.response?.data?.detail ||
        'Checkout failed due to a server error. Please try again.';
      setCheckoutError(message);
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleCloseInvoiceModal = () => {
    setIsInvoiceModalOpen(false);
    setCompletedInvoice(null);
    fetchCart();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Page Title */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Cashier Checkout Station</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time automated object recognition POS • Session: <span className="font-mono text-indigo-400">{sessionId}</span>
          </p>
        </div>
      </div>

      {/* Main Grid: Left = Video Feed, Right = Cart Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Camera / CV Feed */}
        <div className="lg:col-span-7 space-y-4">
          <CameraFeed
            onDetections={handleDetections}
            isProcessingCart={isProcessingCart}
          />

          {/* Quick Shortcuts / Tips */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-400">
            <h4 className="font-semibold text-slate-300 mb-1">POS Operator Guide:</h4>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400">
              <li>Place items in the camera view to automatically identify them.</li>
              <li>Temporal smoothing suppresses transient bounding box flicker.</li>
              <li>Use the right-hand panel to adjust quantities, remove items, or add items manually.</li>
              <li>Transactions are atomic with GST invoice generation and instant stock deduction.</li>
            </ul>
          </div>
        </div>

        {/* Dynamic Cart & Checkout */}
        <div className="lg:col-span-5 h-[calc(100vh-10rem)] sticky top-20">
          <CartPanel
            cart={cart}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onClearCart={handleClearCart}
            onCheckout={handleCheckout}
            isCheckingOut={isCheckingOut}
            checkoutError={checkoutError}
          />
        </div>
      </div>

      {/* Success Tax Invoice Modal */}
      <InvoiceModal
        invoice={completedInvoice}
        isOpen={isInvoiceModalOpen}
        onClose={handleCloseInvoiceModal}
      />
    </div>
  );
};

