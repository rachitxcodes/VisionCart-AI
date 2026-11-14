export type UserRole = 'ADMIN' | 'CASHIER';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  price_paise: number;
  gst_rate: number;
  stock: number;
  reorder_level: number;
  detector_class?: string | null;
  is_active: boolean;
  is_low_stock?: boolean;
}

export interface ProductCreate {
  sku: string;
  name: string;
  category?: string;
  price_paise: number;
  gst_rate?: number;
  stock?: number;
  reorder_level?: number;
  detector_class?: string | null;
}

export interface ProductUpdate {
  name?: string;
  category?: string;
  price_paise?: number;
  gst_rate?: number;
  reorder_level?: number;
  detector_class?: string | null;
  is_active?: boolean;
}

export interface StockAdjustmentRequest {
  action: 'ADD' | 'DEDUCT' | 'SET';
  quantity: number;
  reason?: string;
}

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface DetectionItem {
  class_name: string;
  confidence: number;
  box: BoundingBox;
  product_id?: number | null;
  product_name?: string | null;
  price_paise?: number | null;
}

export interface CartLineItem {
  product_id: number;
  product_name: string;
  product_sku: string;
  unit_price_paise: number;
  quantity: number;
  gst_rate: number;
  taxable_value_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  line_total_paise: number;
  available_stock?: number;
}

export interface CartSummary {
  session_id?: string;
  items: CartLineItem[];
  subtotal_paise: number;
  cgst_total_paise: number;
  sgst_total_paise: number;
  rounding_paise: number;
  grand_total_paise: number;
  total_items_count: number;
  // Aliases for compatibility
  cgst_paise?: number;
  sgst_paise?: number;
  total_paise?: number;
}

export interface InvoiceItem {
  id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  unit_price_paise: number;
  quantity: number;
  gst_rate: number;
  taxable_value_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  line_total_paise: number;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  cashier_id: number;
  subtotal_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  total_paise: number;
  rounding_paise: number;
  status: string;
  created_at: string;
  items: InvoiceItem[];
}

export interface DailyRevenueEntry {
  day: string;
  revenue_paise: number;
  invoice_count: number;
}

export interface TopProductEntry {
  product_id: number;
  product_name: string;
  product_sku: string;
  total_qty: number;
  total_revenue_paise: number;
}

export interface SummaryKPIs {
  period_days: number;
  invoice_count: number;
  total_revenue_paise: number;
  avg_basket_value_paise: number;
}

export interface LowStockAlert {
  id: number;
  name: string;
  sku: string;
  stock: number;
  reorder_level: number;
  category: string;
}

