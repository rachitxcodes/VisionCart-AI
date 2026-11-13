import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { productsApi } from '../api/products';
import { Product, ProductCreate, ProductUpdate, StockAdjustmentRequest } from '../types';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Sliders,
  X,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';

export const AdminProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  // Form states
  const [formData, setFormData] = useState<Partial<ProductCreate>>({
    sku: '',
    name: '',
    category: 'Fruits',
    price_paise: 5000,
    gst_rate: 0,
    stock: 20,
    reorder_level: 5,
    detector_class: '',
  });

  const [adjustData, setAdjustData] = useState<StockAdjustmentRequest>({
    action: 'ADD',
    quantity: 10,
    reason: 'RESTOCK_SHIPMENT',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const data = await productsApi.list({
        search: searchQuery || undefined,
        category: selectedCategory || undefined,
      });
      setProducts(data);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts();
  };

  // Open Edit Modal
  const openEditModal = (prod: Product) => {
    setActiveProduct(prod);
    setFormData({
      sku: prod.sku,
      name: prod.name,
      category: prod.category,
      price_paise: prod.price_paise,
      gst_rate: prod.gst_rate,
      stock: prod.stock,
      reorder_level: prod.reorder_level,
      detector_class: prod.detector_class || '',
    });
    setFormError(null);
    setIsEditModalOpen(true);
  };

  // Open Adjust Modal
  const openAdjustModal = (prod: Product) => {
    setActiveProduct(prod);
    setAdjustData({ action: 'ADD', quantity: 10, reason: 'RESTOCK_SHIPMENT' });
    setFormError(null);
    setIsAdjustModalOpen(true);
  };

  // Create Product Submit
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    try {
      await productsApi.create({
        sku: formData.sku!,
        name: formData.name!,
        category: formData.category,
        price_paise: Number(formData.price_paise),
        gst_rate: Number(formData.gst_rate),
        stock: Number(formData.stock),
        reorder_level: Number(formData.reorder_level),
        detector_class: formData.detector_class || null,
      });
      setIsAddModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Failed to create product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update Product Submit
  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProduct) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      const updatePayload: ProductUpdate = {
        name: formData.name,
        category: formData.category,
        price_paise: Number(formData.price_paise),
        gst_rate: Number(formData.gst_rate),
        reorder_level: Number(formData.reorder_level),
        detector_class: formData.detector_class || null,
      };
      await productsApi.update(activeProduct.id, updatePayload);
      setIsEditModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Failed to update product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Adjust Stock Submit
  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProduct) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      await productsApi.adjustStock(activeProduct.id, {
        action: adjustData.action,
        quantity: Number(adjustData.quantity),
        reason: adjustData.reason,
      });
      setIsAdjustModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Failed to adjust stock.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete / Deactivate
  const handleDeleteProduct = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete/deactivate this product?')) return;
    try {
      await productsApi.delete(id);
      fetchProducts();
    } catch (err) {
      console.error('Failed to delete product:', err);
      alert('Failed to delete product.');
    }
  };

  const formatRupees = (paise: number) => {
    return (paise / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    });
  };

  const categories = ['All', 'Fruits', 'Beverages', 'Bakery', 'Snacks', 'Pantry'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 font-body text-ink">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3 border-b border-counter-grey pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-heading font-semibold text-ink">Product catalog</h1>
            <Link
              to="/guide#guide-6"
              title="Products guide"
              className="p-1 rounded-control text-ink-muted hover:text-ink hover:bg-counter-light transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
            </Link>
          </div>
          <p className="text-xs text-ink-muted mt-0.5">
            Prices, GST rates, stock levels, and object detector mappings
          </p>
        </div>

        <button
          onClick={() => {
            setFormData({
              sku: `SKU-${Date.now().toString().slice(-6)}`,
              name: '',
              category: 'Fruits',
              price_paise: 5000,
              gst_rate: 5,
              stock: 25,
              reorder_level: 5,
              detector_class: '',
            });
            setFormError(null);
            setIsAddModalOpen(true);
          }}
          className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-control text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-colors w-fit"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add product</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface border border-counter-grey rounded-panel p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        {/* Search Input */}
        <form onSubmit={handleSearch} className="w-full sm:w-80 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-muted">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or SKU..."
            className="w-full bg-paper border border-counter-grey rounded-control pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-primary"
          />
        </form>

        {/* Category Chips */}
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === 'All' ? '' : cat)}
              className={`px-3 py-1 rounded-control text-xs font-medium whitespace-nowrap transition-colors border ${
                (selectedCategory === '' && cat === 'All') || selectedCategory === cat
                  ? 'bg-paper border-ink text-ink font-semibold'
                  : 'bg-surface border-counter-grey text-ink-muted hover:text-ink hover:bg-counter-light'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table with sentence case headers and stock status dot */}
      <div className="bg-surface border border-counter-grey rounded-panel overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-paper border-b border-counter-grey text-ink-muted text-[11px]">
              <tr>
                <th className="p-3.5 font-medium">SKU and name</th>
                <th className="p-3.5 font-medium">Category</th>
                <th className="p-3.5 font-medium text-right">Price</th>
                <th className="p-3.5 font-medium text-center">GST</th>
                <th className="p-3.5 font-medium text-center">Stock status</th>
                <th className="p-3.5 font-medium">Detector label</th>
                <th className="p-3.5 font-medium text-center">Status</th>
                <th className="p-3.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-counter-grey/60">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-ink-muted">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    <span>Loading catalog...</span>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-ink-muted">
                    No products found matching your search.
                  </td>
                </tr>
              ) : (
                products.map((prod) => {
                  // Stock status dot: red out, yellow low, green fine
                  const isOut = prod.stock === 0;
                  const isLow = prod.stock <= prod.reorder_level;
                  const dotColor = isOut ? 'bg-signal' : isLow ? 'bg-tag-yellow' : 'bg-primary';

                  return (
                    <tr key={prod.id} className="hover:bg-paper/70 transition-colors">
                      <td className="p-3.5">
                        <span className="font-medium text-ink block text-xs">{prod.name}</span>
                        <span className="text-[11px] text-ink-muted font-mono">{prod.sku}</span>
                      </td>
                      <td className="p-3.5 text-ink-muted">{prod.category}</td>
                      <td className="p-3.5 text-right font-mono tabular-nums font-medium text-ink">
                        {formatRupees(prod.price_paise)}
                      </td>
                      <td className="p-3.5 text-center font-mono tabular-nums text-ink-muted">
                        {prod.gst_rate}%
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="inline-flex items-center space-x-1.5 font-mono tabular-nums">
                          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                          <span className={isLow ? 'text-signal font-semibold' : 'text-ink'}>
                            {prod.stock}
                          </span>
                          <span className="text-ink-muted text-[11px]">/ {prod.reorder_level}</span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        {prod.detector_class ? (
                          <span className="bg-paper border border-counter-grey text-ink px-2 py-0.5 rounded-control text-[11px] font-mono">
                            {prod.detector_class}
                          </span>
                        ) : (
                          <span className="text-ink-muted text-[11px] italic">Manual only</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-flex items-center text-[11px] font-medium ${
                            prod.is_active ? 'text-primary' : 'text-ink-muted'
                          }`}
                        >
                          {prod.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => openAdjustModal(prod)}
                          title="Adjust stock"
                          aria-label={`Adjust stock for ${prod.name}`}
                          className="p-1.5 rounded-control border border-counter-grey bg-surface hover:bg-counter-light text-ink-muted hover:text-ink transition-colors"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(prod)}
                          title="Edit product"
                          aria-label={`Edit ${prod.name}`}
                          className="p-1.5 rounded-control border border-counter-grey bg-surface hover:bg-counter-light text-ink-muted hover:text-ink transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(prod.id)}
                          title="Delete product"
                          aria-label={`Delete ${prod.name}`}
                          className="p-1.5 rounded-control border border-counter-grey bg-surface hover:bg-signal-tint text-ink-muted hover:text-signal transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs">
          <div className="bg-surface border border-counter-grey rounded-panel w-full max-w-lg overflow-hidden shadow-xl font-body">
            <div className="p-4 bg-paper border-b border-counter-grey flex items-center justify-between">
              <h2 className="font-heading font-semibold text-ink text-sm">
                {isAddModalOpen ? 'Add new product' : `Edit: ${activeProduct?.name}`}
              </h2>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="text-ink-muted hover:text-ink p-1"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={isAddModalOpen ? handleCreateProduct : handleUpdateProduct} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-signal-tint border border-signal/20 rounded-control text-signal">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink font-medium mb-1">SKU</label>
                  <input
                    type="text"
                    required
                    disabled={isEditModalOpen}
                    value={formData.sku || ''}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full bg-paper border border-counter-grey rounded-control px-3 py-2 text-ink focus:outline-none focus:border-primary disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-ink font-medium mb-1">Category</label>
                  <select
                    value={formData.category || 'Fruits'}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-paper border border-counter-grey rounded-control px-3 py-2 text-ink focus:outline-none focus:border-primary"
                  >
                    {categories.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-ink font-medium mb-1">Product name</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Fresh Bananas"
                  className="w-full bg-paper border border-counter-grey rounded-control px-3 py-2 text-ink focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink font-medium mb-1">
                    Price in paise (e.g. 5000 = ₹50.00)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={formData.price_paise ?? 0}
                    onChange={(e) => setFormData({ ...formData, price_paise: Number(e.target.value) })}
                    className="w-full bg-paper border border-counter-grey rounded-control px-3 py-2 text-ink focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-ink font-medium mb-1">GST rate (%)</label>
                  <select
                    value={formData.gst_rate ?? 0}
                    onChange={(e) => setFormData({ ...formData, gst_rate: Number(e.target.value) })}
                    className="w-full bg-paper border border-counter-grey rounded-control px-3 py-2 text-ink focus:outline-none focus:border-primary"
                  >
                    {[0, 5, 12, 18, 28].map((r) => (
                      <option key={r} value={r}>{r}% GST</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink font-medium mb-1">Initial stock</label>
                  <input
                    type="number"
                    required
                    disabled={isEditModalOpen}
                    min={0}
                    value={formData.stock ?? 0}
                    onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                    className="w-full bg-paper border border-counter-grey rounded-control px-3 py-2 text-ink focus:outline-none focus:border-primary disabled:opacity-50"
                  />
                  {isEditModalOpen && (
                    <span className="text-[11px] text-ink-muted mt-0.5 block">Use stock adjustment button to modify inventory.</span>
                  )}
                </div>
                <div>
                  <label className="block text-ink font-medium mb-1">Reorder level</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={formData.reorder_level ?? 5}
                    onChange={(e) => setFormData({ ...formData, reorder_level: Number(e.target.value) })}
                    className="w-full bg-paper border border-counter-grey rounded-control px-3 py-2 text-ink focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-ink font-medium mb-0.5">Detector class label</label>
                <p className="text-[11px] text-ink-muted mb-1.5">The object name the camera uses, like 'bottle' or 'banana'.</p>
                <input
                  type="text"
                  value={formData.detector_class || ''}
                  onChange={(e) => setFormData({ ...formData, detector_class: e.target.value })}
                  placeholder="banana"
                  className="w-full bg-paper border border-counter-grey rounded-control px-3 py-2 text-ink focus:outline-none focus:border-primary"
                />
              </div>

              <div className="pt-3 border-t border-counter-grey flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  className="px-3.5 py-2 rounded-control text-xs text-ink-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-control text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {isAdjustModalOpen && activeProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs">
          <div className="bg-surface border border-counter-grey rounded-panel w-full max-w-md overflow-hidden shadow-xl font-body">
            <div className="p-4 bg-paper border-b border-counter-grey flex items-center justify-between">
              <div>
                <h2 className="font-heading font-semibold text-ink text-sm">Adjust stock</h2>
                <p className="text-xs text-ink-muted">{activeProduct.name} ({activeProduct.sku})</p>
              </div>
              <button onClick={() => setIsAdjustModalOpen(false)} className="text-ink-muted hover:text-ink p-1" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustStock} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-signal-tint border border-signal/20 rounded-control text-signal">
                  {formError}
                </div>
              )}

              <div className="bg-paper p-3 rounded-control border border-counter-grey flex justify-between items-center">
                <span className="text-ink-muted">Current inventory:</span>
                <span className="font-bold text-ink font-mono tabular-nums text-sm">{activeProduct.stock} units</span>
              </div>

              <div>
                <label className="block text-ink font-medium mb-1">Action</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['ADD', 'DEDUCT', 'SET'] as const).map((act) => (
                    <button
                      key={act}
                      type="button"
                      onClick={() => setAdjustData({ ...adjustData, action: act })}
                      className={`py-2 rounded-control text-xs font-semibold border transition-colors ${
                        adjustData.action === act
                          ? 'bg-paper border-ink text-ink font-bold shadow-xs'
                          : 'bg-surface border-counter-grey text-ink-muted hover:text-ink hover:bg-counter-light'
                      }`}
                    >
                      {act}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-ink font-medium mb-1">
                  Quantity ({adjustData.action === 'SET' ? 'New absolute stock' : 'Quantity to change'})
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={adjustData.quantity}
                  onChange={(e) => setAdjustData({ ...adjustData, quantity: Number(e.target.value) })}
                  className="w-full bg-paper border border-counter-grey rounded-control px-3 py-2 text-ink focus:outline-none focus:border-primary font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="block text-ink font-medium mb-1">Reason for adjustment</label>
                <select
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                  className="w-full bg-paper border border-counter-grey rounded-control px-3 py-2 text-ink focus:outline-none focus:border-primary"
                >
                  <option value="RESTOCK_SHIPMENT">Restock shipment</option>
                  <option value="SPOILED_ITEMS">Damaged or spoiled goods</option>
                  <option value="PHYSICAL_AUDIT_COUNT">Physical inventory audit</option>
                  <option value="CUSTOMER_RETURN">Customer return</option>
                  <option value="INTERNAL_CORRECTION">Internal correction</option>
                </select>
              </div>

              <div className="pt-3 border-t border-counter-grey flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-3.5 py-2 rounded-control text-xs text-ink-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-control text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Applying...' : 'Apply stock change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
