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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Product Catalog & Inventory</h1>
            <Link
              to="/guide#guide-6"
              title="View Product & Inventory Guide"
              className="p-1 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
            >
              <HelpCircle className="w-5 h-5" />
            </Link>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage SKUs, prices, GST tax rates, inventory levels, and YOLO detector class mappings
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
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] w-fit"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
        {/* Search Input */}
        <form onSubmit={handleSearch} className="w-full sm:w-80 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or SKU..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </form>

        {/* Category Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === 'All' ? '' : cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                (selectedCategory === '' && cat === 'All') || selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
              <tr>
                <th className="p-4">SKU & Name</th>
                <th className="p-4">Category</th>
                <th className="p-4 text-right">Price</th>
                <th className="p-4 text-center">GST %</th>
                <th className="p-4 text-center">Stock</th>
                <th className="p-4">Detector Class</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    <span>Loading catalog...</span>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No products found matching your search.
                  </td>
                </tr>
              ) : (
                products.map((prod) => (
                  <tr key={prod.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4">
                      <span className="font-semibold text-white block text-sm">{prod.name}</span>
                      <span className="text-[11px] text-slate-500 font-mono">{prod.sku}</span>
                    </td>
                    <td className="p-4 text-slate-300">{prod.category}</td>
                    <td className="p-4 text-right font-bold text-slate-200">
                      {formatRupees(prod.price_paise)}
                    </td>
                    <td className="p-4 text-center">
                      <span className="bg-indigo-950/60 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800/50 font-mono text-[10px]">
                        {prod.gst_rate}%
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center">
                        <span
                          className={`font-bold ${
                            prod.stock <= prod.reorder_level
                              ? 'text-rose-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {prod.stock} units
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Reorder: {prod.reorder_level}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      {prod.detector_class ? (
                        <span className="bg-emerald-950/50 text-emerald-300 px-2 py-0.5 rounded text-[11px] border border-emerald-800/40 font-mono">
                          {prod.detector_class}
                        </span>
                      ) : (
                        <span className="text-slate-600 italic">None (manual only)</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {prod.is_active ? (
                        <span className="inline-flex items-center text-emerald-400 text-[10px] font-semibold">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-slate-500 text-[10px]">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => openAdjustModal(prod)}
                        title="Adjust Stock"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openEditModal(prod)}
                        title="Edit Product"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(prod.id)}
                        title="Delete Product"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/50 text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">
                {isAddModalOpen ? 'Create New Catalog Product' : `Edit Product: ${activeProduct?.name}`}
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={isAddModalOpen ? handleCreateProduct : handleUpdateProduct} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-xs text-rose-200">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">SKU</label>
                  <input
                    type="text"
                    required
                    disabled={isEditModalOpen}
                    value={formData.sku || ''}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Category</label>
                  <select
                    value={formData.category || 'Fruits'}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    {categories.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Fresh Cavendish Bananas"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Price in Paise (e.g. 5000 = ₹50.00)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={formData.price_paise ?? 0}
                    onChange={(e) => setFormData({ ...formData, price_paise: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">GST Tax Rate (%)</label>
                  <select
                    value={formData.gst_rate ?? 0}
                    onChange={(e) => setFormData({ ...formData, gst_rate: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    {[0, 5, 12, 18, 28].map((r) => (
                      <option key={r} value={r}>{r}% GST</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Stock Units</label>
                  <input
                    type="number"
                    required
                    disabled={isEditModalOpen}
                    min={0}
                    value={formData.stock ?? 0}
                    onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                  {isEditModalOpen && (
                    <span className="text-[10px] text-slate-500">Use Stock Adjustment modal to modify stock.</span>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Reorder Level</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={formData.reorder_level ?? 5}
                    onChange={(e) => setFormData({ ...formData, reorder_level: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Detector Class Mapping (COCO class, e.g. banana, apple, bottle)
                </label>
                <input
                  type="text"
                  value={formData.detector_class || ''}
                  onChange={(e) => setFormData({ ...formData, detector_class: e.target.value })}
                  placeholder="banana"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {isAdjustModalOpen && activeProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-sm">Adjust Stock</h3>
                <p className="text-[11px] text-slate-400">{activeProduct.name} ({activeProduct.sku})</p>
              </div>
              <button onClick={() => setIsAdjustModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustStock} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-xs text-rose-200">
                  {formError}
                </div>
              )}

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">Current Stock:</span>
                <span className="font-bold text-white text-sm">{activeProduct.stock} units</span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Action</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['ADD', 'DEDUCT', 'SET'] as const).map((act) => (
                    <button
                      key={act}
                      type="button"
                      onClick={() => setAdjustData({ ...adjustData, action: act })}
                      className={`py-2 rounded-xl text-xs font-bold transition-colors ${
                        adjustData.action === act
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {act}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Quantity ({adjustData.action === 'SET' ? 'New absolute stock' : 'Quantity to change'})
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={adjustData.quantity}
                  onChange={(e) => setAdjustData({ ...adjustData, quantity: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Reason / Note</label>
                <select
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="RESTOCK_SHIPMENT">Restock Shipment</option>
                  <option value="SPOILED_ITEMS">Damaged / Spoiled Items</option>
                  <option value="PHYSICAL_AUDIT_COUNT">Physical Inventory Audit</option>
                  <option value="CUSTOMER_RETURN">Customer Return</option>
                  <option value="INTERNAL_CORRECTION">Internal Correction</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? 'Applying...' : 'Apply Stock Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
