import React from 'react';
import { Invoice } from '../types';
import { checkoutApi } from '../api/checkout';
import { CheckCircle2, Download, PlusCircle, X } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950/60 to-slate-900 border-b border-emerald-800/30 p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Payment Successful!</h2>
              <p className="text-xs text-emerald-400 font-mono tracking-wide">
                Invoice #{invoice.invoice_number}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200 text-sm">
          {/* Summary Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
            <div>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Status</span>
              <span className="text-xs font-bold text-emerald-400 uppercase">{invoice.status}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Date</span>
              <span className="text-xs text-slate-200">
                {new Date(invoice.created_at).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Cashier ID</span>
              <span className="text-xs text-slate-200">#{invoice.cashier_id}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Total Amount</span>
              <span className="text-base font-bold text-emerald-400">
                {formatRupees(invoice.total_paise)}
              </span>
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Purchased Line Items
            </h3>
            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/50 text-slate-400 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="p-3">Item</th>
                    <th className="p-3 text-right">Price</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3 text-center">GST %</th>
                    <th className="p-3 text-right">Taxable</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                  {invoice.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/30">
                      <td className="p-3">
                        <span className="font-semibold text-white block">{item.product_name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{item.product_sku}</span>
                      </td>
                      <td className="p-3 text-right">{formatRupees(item.unit_price_paise)}</td>
                      <td className="p-3 text-center font-bold">{item.quantity}</td>
                      <td className="p-3 text-center text-slate-400">{item.gst_rate}%</td>
                      <td className="p-3 text-right text-slate-300">{formatRupees(item.taxable_value_paise)}</td>
                      <td className="p-3 text-right font-semibold text-white">
                        {formatRupees(item.line_total_paise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tax Calculation Breakdown */}
          <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Taxable Value (Subtotal)</span>
              <span>{formatRupees(invoice.subtotal_paise)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Central GST (CGST)</span>
              <span>{formatRupees(invoice.cgst_paise)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>State GST (SGST)</span>
              <span>{formatRupees(invoice.sgst_paise)}</span>
            </div>
            {invoice.rounding_paise !== 0 && (
              <div className="flex justify-between text-slate-400">
                <span>Rounding Adjustment</span>
                <span>{formatRupees(invoice.rounding_paise)}</span>
              </div>
            )}
            <div className="border-t border-slate-800 pt-2 flex justify-between font-bold text-sm text-white">
              <span>Grand Total</span>
              <span className="text-emerald-400">{formatRupees(invoice.total_paise)}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-900 border-t border-slate-800 p-4 flex flex-col sm:flex-row items-center justify-end space-y-2 sm:space-y-0 sm:space-x-3">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center justify-center space-x-2 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Transaction</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02]"
          >
            <Download className="w-4 h-4" />
            <span>Download Tax Invoice (PDF)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

