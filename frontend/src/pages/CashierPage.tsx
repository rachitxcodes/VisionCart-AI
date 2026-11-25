import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CameraFeed } from '../components/CameraFeed';
import { CartPanel } from '../components/CartPanel';
import { InvoiceModal } from '../components/InvoiceModal';
import { ReviewTray } from '../components/ReviewTray';
import { ProductPickerModal } from '../components/ProductPickerModal';
import { cartApi } from '../api/cart';
import { checkoutApi } from '../api/checkout';
import { productsApi } from '../api/products';
import { correctionsApi } from '../api/corrections';
import {
  CartSummary,
  DetectionItem,
  Invoice,
  Product,
  ReviewCandidate,
  CartLineItem,
  CorrectionCreateMeta,
} from '../types';
import { AlertCircle } from 'lucide-react';

const INITIAL_CART: CartSummary = {
  items: [],
  subtotal_paise: 0,
  cgst_total_paise: 0,
  sgst_total_paise: 0,
  rounding_paise: 0,
  grand_total_paise: 0,
  total_items_count: 0,
  review_candidates: [],
};

export const CashierPage: React.FC = () => {
  const [cart, setCart] = useState<CartSummary>(INITIAL_CART);
  const [sessionId] = useState<string>(
    () => `pos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  );
  const [isProcessingCart, setIsProcessingCart] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  // Correction flow states
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [activeFrameDataUrl, setActiveFrameDataUrl] = useState<string | undefined>(undefined);
  const [frameDimensions, setFrameDimensions] = useState<{ width: number; height: number }>({
    width: 640,
    height: 480,
  });

  const [pickerState, setPickerState] = useState<{
    isOpen: boolean;
    mode: 'candidate' | 'swap';
    candidate?: ReviewCandidate;
    swapItem?: CartLineItem;
    suggestedProductId?: number | null;
    title: string;
    subtitle: string;
  }>({
    isOpen: false,
    mode: 'candidate',
    title: 'Choose product',
    subtitle: 'Select the matching product from your catalog',
  });

  const [isGentleCheckoutOpen, setIsGentleCheckoutOpen] = useState(false);

  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  // Load product catalog for picker
  useEffect(() => {
    productsApi
      .list()
      .then((prods) => setCatalog(prods.filter((p) => p.is_active)))
      .catch((err) => console.error('Failed to load products for cashier picker:', err));
  }, []);

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

  // Frame capture listener
  const handleFrameCaptured = useCallback((frameDataUrl: string, width: number, height: number) => {
    setActiveFrameDataUrl(frameDataUrl);
    setFrameDimensions({ width, height });
  }, []);

  // Handle live detections from CameraFeed
  const handleDetections = useCallback(
    async (detections: DetectionItem[]) => {
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
    },
    [isCheckingOut]
  );

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

  // Fire-and-forget background correction logging
  const logCorrection = async (meta: CorrectionCreateMeta, frameDataUrl?: string) => {
    if (!frameDataUrl) return;
    try {
      // Convert base64 data URL to Blob
      const res = await fetch(frameDataUrl);
      const blob = await res.blob();
      await correctionsApi.createCorrection(blob, meta);
    } catch (err) {
      console.warn('Could not record detection correction (non-blocking):', err);
    }
  };

  // Review Candidate: Choose Product clicked
  const handleChooseProductForCandidate = (candidate: ReviewCandidate) => {
    const suggested = catalog.find(
      (p) =>
        p.detector_class === candidate.predicted_class || p.id === candidate.mapped_product_id
    );

    setPickerState({
      isOpen: true,
      mode: 'candidate',
      candidate,
      suggestedProductId: suggested?.id ?? candidate.mapped_product_id ?? null,
      title: `Choose product for "${candidate.predicted_class}"`,
      subtitle: `Matched with ${(candidate.confidence * 100).toFixed(0)}% confidence`,
    });
  };

  // Review Candidate: Not a Product clicked
  const handleNotAProductForCandidate = async (candidate: ReviewCandidate) => {
    try {
      await cartApi.dismissCandidate(sessionId, candidate.predicted_class);
      setCart((prev) => ({
        ...prev,
        review_candidates: (prev.review_candidates || []).filter(
          (c) => c.candidate_id !== candidate.candidate_id
        ),
      }));

      logCorrection(
        {
          session_id: sessionId,
          correction_type: 'false_positive',
          predicted_class: candidate.predicted_class,
          predicted_conf: candidate.confidence,
          box_x: candidate.box.x,
          box_y: candidate.box.y,
          box_w: candidate.box.w,
          box_h: candidate.box.h,
          frame_width: frameDimensions.width,
          frame_height: frameDimensions.height,
        },
        activeFrameDataUrl
      );
    } catch (err) {
      console.error('Failed to dismiss candidate:', err);
    }
  };

  // Cart item: Wrong Item? swap clicked
  const handleSwapItem = (item: CartLineItem) => {
    setPickerState({
      isOpen: true,
      mode: 'swap',
      swapItem: item,
      suggestedProductId: null,
      title: `Swap "${item.product_name}"`,
      subtitle: 'Select the actual product to correct the detection',
    });
  };

  // Product selected in modal
  const handleProductSelected = async (product: Product) => {
    if (pickerState.mode === 'candidate' && pickerState.candidate) {
      const cand = pickerState.candidate;
      try {
        setIsProcessingCart(true);
        // Dismiss candidate from tray
        await cartApi.dismissCandidate(sessionId, cand.predicted_class);

        // Add or increment chosen product in cart
        const existingLine = cart.items.find((i) => i.product_id === product.id);
        const newQty = existingLine ? existingLine.quantity + 1 : 1;
        const updatedCart = await cartApi.updateItem(sessionId, product.id, newQty);
        setCart(updatedCart);

        // Log correction record
        const corrType = cand.mapped_product_id ? 'wrong_item' : 'unknown_item';
        logCorrection(
          {
            session_id: sessionId,
            correction_type: corrType,
            predicted_class: cand.predicted_class,
            predicted_conf: cand.confidence,
            box_x: cand.box.x,
            box_y: cand.box.y,
            box_w: cand.box.w,
            box_h: cand.box.h,
            corrected_product_id: product.id,
            corrected_label: product.detector_class,
            frame_width: frameDimensions.width,
            frame_height: frameDimensions.height,
          },
          activeFrameDataUrl
        );
      } catch (err) {
        console.error('Failed to resolve candidate product:', err);
      } finally {
        setIsProcessingCart(false);
      }
    } else if (pickerState.mode === 'swap' && pickerState.swapItem) {
      const oldItem = pickerState.swapItem;
      try {
        setIsProcessingCart(true);
        // Remove wrong item and add correct product with same quantity
        await cartApi.removeItem(sessionId, oldItem.product_id);
        const updatedCart = await cartApi.updateItem(sessionId, product.id, oldItem.quantity);
        setCart(updatedCart);

        // Log correction
        const oldProduct = catalog.find((p) => p.id === oldItem.product_id);
        logCorrection(
          {
            session_id: sessionId,
            correction_type: 'wrong_item',
            predicted_class: oldProduct?.detector_class || 'detected_item',
            corrected_product_id: product.id,
            corrected_label: product.detector_class,
            frame_width: frameDimensions.width,
            frame_height: frameDimensions.height,
          },
          activeFrameDataUrl
        );
      } catch (err) {
        console.error('Failed to swap cart item:', err);
      } finally {
        setIsProcessingCart(false);
      }
    }
  };

  // Checkout execution with UUID idempotency key
  const executeCheckout = async () => {
    if (cart.items.length === 0 || isCheckingOut) return;
    setCheckoutError(null);
    setIsCheckingOut(true);
    setIsGentleCheckoutOpen(false);

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

  const handleCheckoutClick = () => {
    if (cart.review_candidates && cart.review_candidates.length > 0) {
      setIsGentleCheckoutOpen(true);
    } else {
      executeCheckout();
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
            Real-time automated object recognition POS • Session:{' '}
            <span className="font-mono text-indigo-400">{sessionId}</span>
          </p>
        </div>
      </div>

      {/* Main Grid: Left = Video Feed & Review Tray, Right = Cart Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Camera / CV Feed */}
        <div className="lg:col-span-7 space-y-4">
          {/* Review Tray: "Needs a look" */}
          <ReviewTray
            candidates={cart.review_candidates || []}
            frameDataUrl={activeFrameDataUrl}
            onChooseProduct={handleChooseProductForCandidate}
            onNotAProduct={handleNotAProductForCandidate}
          />

          <CameraFeed
            onDetections={handleDetections}
            onFrameCaptured={handleFrameCaptured}
            isProcessingCart={isProcessingCart}
          />

          {/* Quick Shortcuts / Operator Guide */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-400">
            <h4 className="font-semibold text-slate-300 mb-1">POS Operator Guide:</h4>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400">
              <li>Place items in the camera view to automatically identify and add them to the cart.</li>
              <li>Items stay in the cart automatically — they are never removed when leaving camera view.</li>
              <li>If an item is uncertain, it appears in the "Needs a look" tray above for instant confirmation.</li>
              <li>Click "Wrong item?" on any detected line in the cart to swap it to the correct catalog item.</li>
              <li>Transactions are atomic with GST invoice calculation and instant stock deduction.</li>
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
            onCheckout={handleCheckoutClick}
            onSwapItem={handleSwapItem}
            isCheckingOut={isCheckingOut}
            checkoutError={checkoutError}
          />
        </div>
      </div>

      {/* Product Picker Modal */}
      <ProductPickerModal
        isOpen={pickerState.isOpen}
        onClose={() => setPickerState((prev) => ({ ...prev, isOpen: false }))}
        onSelectProduct={handleProductSelected}
        catalog={catalog}
        suggestedProductId={pickerState.suggestedProductId}
        title={pickerState.title}
        subtitle={pickerState.subtitle}
      />

      {/* Gentle Checkout Warning Modal */}
      {isGentleCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Review items still pending</h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              There {cart.review_candidates?.length === 1 ? 'is 1 item' : `are ${cart.review_candidates?.length} items`} in
              the <span className="font-semibold text-amber-300">"Needs a look"</span> tray that has not been confirmed or dismissed.
              You can proceed to payment now or review them first.
            </p>
            <div className="mt-6 flex items-center justify-end space-x-3">
              <button
                onClick={() => setIsGentleCheckoutOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Review items first
              </button>
              <button
                onClick={executeCheckout}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors shadow-lg shadow-emerald-600/20"
              >
                Proceed to payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Tax Invoice Modal */}
      <InvoiceModal
        invoice={completedInvoice}
        isOpen={isInvoiceModalOpen}
        onClose={handleCloseInvoiceModal}
      />
    </div>
  );
};
