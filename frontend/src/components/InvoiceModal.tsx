import React from 'react';
import { Invoice } from '../types';
import { checkoutApi } from '../api/checkout';
import { Check, Download, Plus, X } from 'lucide-react';

interface InvoiceModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ invoice, isOpen, onClose }) => {
  if (!isOpen || !invoice) return null;

  const handleDownloadPdf = async () => {
    try {
      await checkoutApi.downloadInvoicePdf(invoice.id, invoice.invoice_number);
    } catch (err) {
      console.error('Failed to download invoice PDF', err);
      alert('Failed to download invoice PDF. Please try again.');
    }
  };

  const formatRupees = (paise: number) => {
    return (paise / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs">
      {/* Unrolling Receipt Card */}
      <div className="animate-receipt-unroll receipt-paper border border-counter-grey receipt-torn-bottom rounded-t-panel w-full max-w-xl overflow-hidden shadow-xl flex flex-col max-h-[90vh]">
        {/* Receipt Store Header */}
        <div className="p-6 border-b border-counter-grey bg-paper flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-control bg-primary text-white flex items-center justify-center text-xs">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </span>
              <span className="font-heading font-bold text-lg text-ink">VisionCart Tax Invoice</span>
            </div>
            <div className="flex items-center space-x-3 text-xs text-ink-muted mt-1 font-mono tabular-nums">
              <span>Invoice #{invoice.invoice_number}</span>
              <span>·</span>
              <span>{new Date(invoice.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close invoice"
            className="text-ink-muted hover:text-ink p-1.5 rounded-control hover:bg-counter-light transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Receipt Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-ink text-xs">
          {/* Items Table */}
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-counter-grey text-ink-muted font-body text-[11px]">
                <th className="pb-2 font-medium">Item</th>
                <th className="pb-2 text-right font-medium">Rate</th>
                <th className="pb-2 text-center font-medium">Qty</th>
                <th className="pb-2 text-center font-medium">GST</th>
                <th className="pb-2 text-right font-medium">Taxable</th>
                <th className="pb-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-counter-grey/60 font-mono tabular-nums">
              {invoice.items.map((item) => (
                <tr key={item.id} className="py-2">
                  <td className="py-2.5 pr-2 font-body font-medium text-ink">
                    <span className="block text-xs">{item.product_name}</span>
                    <span className="text-[10px] text-ink-muted font-mono">{item.product_sku}</span>
                  </td>
                  <td className="py-2.5 text-right text-ink-muted">{formatRupees(item.unit_price_paise)}</td>
                  <td className="py-2.5 text-center font-bold text-ink">{item.quantity}</td>
                  <td className="py-2.5 text-center text-ink-muted">{item.gst_rate}%</td>
                  <td className="py-2.5 text-right text-ink-muted">{formatRupees(item.taxable_value_paise)}</td>
                  <td className="py-2.5 text-right font-semibold text-ink">
                    {formatRupees(item.line_total_paise)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Dashed divider */}
          <div className="border-t border-dashed border-counter-grey" />

          {/* Tax Breakdown */}
          <div className="space-y-1.5 font-mono tabular-nums text-xs bg-paper p-3 rounded-control border border-counter-grey">
            <div className="flex justify-between text-ink-muted">
              <span>Taxable value</span>
              <span>{formatRupees(invoice.subtotal_paise)}</span>
            </div>
            <div className="flex justify-between text-ink-muted">
              <span>Central GST (CGST)</span>
              <span>{formatRupees(invoice.cgst_paise)}</span>
            </div>
            <div className="flex justify-between text-ink-muted">
              <span>State GST (SGST)</span>
              <span>{formatRupees(invoice.sgst_paise)}</span>
            </div>
            {invoice.rounding_paise !== 0 && (
              <div className="flex justify-between text-ink-muted">
                <span>Rounding adjustment</span>
                <span>{formatRupees(invoice.rounding_paise)}</span>
              </div>
            )}
            <div className="border-t border-counter-grey pt-2 mt-2 flex justify-between font-body items-baseline">
              <span className="font-heading font-bold text-sm text-ink">Total paid</span>
              <span className="text-xl font-mono tabular-nums font-bold text-primary">
                {formatRupees(invoice.total_paise)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-counter-grey p-4 bg-paper/60 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-control border border-counter-grey bg-surface hover:bg-counter-light text-ink font-medium text-xs flex items-center justify-center space-x-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New sale</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            className="w-full sm:w-auto px-5 py-2.5 rounded-control bg-primary hover:bg-primary-hover text-white font-semibold text-xs flex items-center justify-center space-x-1.5 shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};
