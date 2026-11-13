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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
      {/* Page Header */}
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-counter-grey pb-3">
        <div>
          <h1 className="text-xl font-heading font-semibold text-ink">
            Checkout counter
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Real-time vision recognition • Counter session <span className="font-mono text-ink">{sessionId}</span>
          </p>
        </div>
      </div>

      {/* Main Grid: Left = Video Feed (approx 60%), Right = Receipt Cart (approx 40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Camera / CV Feed */}
        <div className="lg:col-span-7">
          <CameraFeed
            onDetections={handleDetections}
            isProcessingCart={isProcessingCart}
          />
        </div>

        {/* Dynamic Receipt Cart */}
        <div className="lg:col-span-5 lg:sticky lg:top-18">
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
