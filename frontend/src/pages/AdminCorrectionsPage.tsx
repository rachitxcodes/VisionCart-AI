import React, { useState, useEffect, useCallback } from 'react';
import { correctionsApi } from '../api/corrections';
import { Correction, CorrectionStats } from '../types';
import {
  Download,
  Trash2,
  Search,
  ArrowRight,
  RefreshCw,
  Info,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  XCircle,
} from 'lucide-react';

export const AdminCorrectionsPage: React.FC = () => {
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [stats, setStats] = useState<CorrectionStats | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(0);
  const [pageSize] = useState<number>(20);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [labelSearch, setLabelSearch] = useState<string>('');
  const [selectedImageModal, setSelectedImageModal] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        correctionsApi.listCorrections({
          skip: page * pageSize,
          limit: pageSize,
          type: typeFilter !== 'all' ? typeFilter : undefined,
          label: labelSearch.trim() || undefined,
        }),
        correctionsApi.getStats(),
      ]);

      setCorrections(listRes.items);
      setTotalCount(listRes.total);
      setStats(statsRes);
    } catch (err) {
      console.error('Failed to load corrections data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, typeFilter, labelSearch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (id: number) => {
    try {
      await correctionsApi.deleteCorrection(id);
      setDeleteConfirmId(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete correction record:', err);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await correctionsApi.exportDataset();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `visioncart-corrections-dataset-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to export corrections dataset:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-6 h-6 text-indigo-400" />
            <h1 className="text-2xl font-bold tracking-tight text-white">Detection Corrections</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Review cashier corrections, inspect model confusion patterns, and export annotated datasets for YOLO retraining.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => loadData()}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Refresh corrections"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || totalCount === 0}
            className="px-4 py-2 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white disabled:text-slate-500 flex items-center space-x-2 shadow-lg shadow-emerald-600/20 disabled:shadow-none transition-all"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Generating ZIP...' : 'Export YOLO Dataset (.zip)'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Total Corrections</span>
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-extrabold text-white mt-2">
            {stats ? stats.total : '—'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">All logged cashier interventions</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Wrong Items Swapped</span>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-extrabold text-amber-400 mt-2">
            {stats ? stats.by_type.wrong_item : '—'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Model misclassified a known item</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Unknown Items Added</span>
            <HelpCircle className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl font-extrabold text-sky-400 mt-2">
            {stats ? stats.by_type.unknown_item : '—'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">New or unmapped objects detected</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>False Positives</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-extrabold text-rose-400 mt-2">
            {stats ? stats.by_type.false_positive : '—'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Non-product objects dismissed</p>
        </div>
      </div>

      {/* Top Confusions Widget */}
      {stats && stats.top_confusions.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
            Top Model Confusion Pairs
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {stats.top_confusions.map((c, i) => (
              <div
                key={i}
                className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs"
              >
                <div className="flex items-center space-x-2 truncate">
                  <span className="font-mono text-rose-400">{c.predicted_class}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  <span className="font-mono text-emerald-400 font-semibold">{c.corrected_label}</span>
                </div>
                <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {c.count}x
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center space-x-2">
          {['all', 'wrong_item', 'unknown_item', 'false_positive'].map((t) => (
            <button
              key={t}
              onClick={() => {
                setTypeFilter(t);
                setPage(0);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                typeFilter === t
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {t === 'all'
                ? 'All'
                : t === 'wrong_item'
                ? 'Wrong Items'
                : t === 'unknown_item'
                ? 'Unknown Items'
                : 'False Positives'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={labelSearch}
            onChange={(e) => {
              setLabelSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search by label..."
            className="pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Corrections Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="p-3">Thumbnail</th>
                <th className="p-3">Logged At</th>
                <th className="p-3">Cashier</th>
                <th className="p-3">Type</th>
                <th className="p-3">Predicted Class</th>
                <th className="p-3">Corrected Label</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {corrections.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No corrections recorded yet. Cashier corrections will appear here in real-time.
                  </td>
                </tr>
              ) : (
                corrections.map((corr) => (
                  <tr key={corr.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* Thumbnail */}
                    <td className="p-3">
                      <button
                        onClick={() => setSelectedImageModal(corr.image_url)}
                        className="w-12 h-12 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden hover:border-indigo-500 transition-colors block"
                        title="Click to view full frame"
                      >
                        <img
                          src={corr.image_url}
                          alt="Correction frame"
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    </td>

                    <td className="p-3 font-mono text-slate-400">{formatTimestamp(corr.created_at)}</td>
                    <td className="p-3 text-slate-300 font-medium">{corr.cashier_name || 'Cashier'}</td>

                    {/* Correction type badge */}
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          corr.correction_type === 'wrong_item'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : corr.correction_type === 'unknown_item'
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {corr.correction_type === 'wrong_item'
                          ? 'Wrong Item'
                          : corr.correction_type === 'unknown_item'
                          ? 'Unknown'
                          : 'False Positive'}
                      </span>
                    </td>

                    {/* Predicted class & confidence */}
                    <td className="p-3 font-mono">
                      {corr.predicted_class ? (
                        <div className="flex items-center space-x-1.5">
                          <span className="text-white">{corr.predicted_class}</span>
                          {corr.predicted_conf && (
                            <span className="text-slate-500 text-[10px]">
                              ({(corr.predicted_conf * 100).toFixed(0)}%)
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    {/* Corrected product / label */}
                    <td className="p-3">
                      {corr.corrected_product_name ? (
                        <div>
                          <p className="font-semibold text-white">{corr.corrected_product_name}</p>
                          <span className="font-mono text-[10px] text-indigo-400">
                            {corr.corrected_label}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setDeleteConfirmId(corr.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                        title="Delete correction"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} of {totalCount}
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 rounded-lg bg-slate-800 disabled:opacity-50 text-slate-200"
              >
                Previous
              </button>
              <span className="font-mono">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1 rounded-lg bg-slate-800 disabled:opacity-50 text-slate-200"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dataset & Privacy Note */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-400 flex items-start space-x-2.5">
        <Info className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-semibold text-slate-300">Privacy & Dataset Storage:</span> Captured frames and correction annotations are stored strictly on local disk under <code className="text-indigo-300">backend/data/corrections/</code>. They are never sent to external cloud APIs and can be purged anytime.
        </div>
      </div>

      {/* Full Image Preview Modal */}
      {selectedImageModal && (
        <div
          onClick={() => setSelectedImageModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden max-w-2xl w-full shadow-2xl"
          >
            <div className="p-3 border-b border-slate-800 flex items-center justify-between text-xs">
              <span className="font-bold text-white">Full Resolution Frame</span>
              <button
                onClick={() => setSelectedImageModal(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-2 bg-slate-950 flex items-center justify-center">
              <img
                src={selectedImageModal}
                alt="Full resolution frame"
                className="max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-base font-bold text-white">Delete correction record?</h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              This will permanently delete this correction record and its stored frame from local disk.
            </p>
            <div className="mt-5 flex items-center justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
