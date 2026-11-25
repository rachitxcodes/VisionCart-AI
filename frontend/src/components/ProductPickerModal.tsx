import React, { useState, useMemo } from 'react';
import { Product } from '../types';
import { Search, X, Sparkles } from 'lucide-react';

interface ProductPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
  catalog: Product[];
  suggestedProductId?: number | null;
  title?: string;
  subtitle?: string;
}

export const ProductPickerModal: React.FC<ProductPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectProduct,
  catalog,
  suggestedProductId,
  title = 'Choose product',
  subtitle = 'Select the matching product from your store catalog',
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return catalog;
    return catalog.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.detector_class && p.detector_class.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
    );
  }, [catalog, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">{title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search input */}
        <div className="p-3 border-b border-slate-800 bg-slate-950/40">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by product name, SKU, or category..."
              className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* Product Catalog List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredCatalog.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No products found matching "{searchQuery}"
            </div>
          ) : (
            filteredCatalog.map((product) => {
              const isSuggested = suggestedProductId === product.id;

              return (
                <button
                  key={product.id}
                  onClick={() => {
                    onSelectProduct(product);
                    onClose();
                  }}
                  className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all group ${
                    isSuggested
                      ? 'bg-indigo-950/40 border-indigo-500/60 hover:bg-indigo-900/50'
                      : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-xs text-white group-hover:text-indigo-300 transition-colors truncate">
                        {product.name}
                      </span>
                      {isSuggested && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center space-x-0.5">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>Suggested</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-1">
                      <span className="font-mono text-slate-500">{product.sku}</span>
                      <span>•</span>
                      <span>GST {product.gst_rate}%</span>
                      <span>•</span>
                      <span>Stock: {product.stock}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-xs text-emerald-400">
                      ₹{(product.price_paise / 100).toFixed(2)}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
