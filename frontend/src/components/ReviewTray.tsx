import React, { useEffect, useRef } from 'react';
import { ReviewCandidate } from '../types';
import { Check, X, Tag, AlertCircle } from 'lucide-react';

interface ReviewCardProps {
  candidate: ReviewCandidate;
  frameDataUrl?: string;
  onChooseProduct: (candidate: ReviewCandidate) => void;
  onNotAProduct: (candidate: ReviewCandidate) => void;
}

const ReviewCard: React.FC<ReviewCardProps> = ({
  candidate,
  frameDataUrl,
  onChooseProduct,
  onNotAProduct,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render cropped box thumbnail from latest frame
  useEffect(() => {
    if (!frameDataUrl || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      const box = candidate.box;
      const sx = Math.max(0, box.x * img.naturalWidth);
      const sy = Math.max(0, box.y * img.naturalHeight);
      const sw = Math.min(img.naturalWidth - sx, box.w * img.naturalWidth);
      const sh = Math.min(img.naturalHeight - sy, box.h * img.naturalHeight);

      canvas.width = 80;
      canvas.height = 80;
      ctx.clearRect(0, 0, 80, 80);
      try {
        if (sw > 0 && sh > 0) {
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 80, 80);
        } else {
          ctx.drawImage(img, 0, 0, 80, 80);
        }
      } catch (e) {
        console.warn('Could not crop candidate thumbnail:', e);
      }
    };
    img.src = frameDataUrl;
  }, [candidate, frameDataUrl]);

  const confPercent = Math.round(candidate.confidence * 100);

  return (
    <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 flex items-center gap-3 shadow-md">
      {/* Cropped thumbnail or fallback */}
      <div className="w-16 h-16 rounded-lg bg-slate-900 border border-slate-700/50 flex-shrink-0 overflow-hidden flex items-center justify-center">
        {frameDataUrl ? (
          <canvas ref={canvasRef} className="w-full h-full object-cover" />
        ) : (
          <Tag className="w-6 h-6 text-slate-600" />
        )}
      </div>

      {/* Description & Confidence */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-1.5">
          <span className="text-[11px] text-slate-400">Looks like:</span>
          <span className="text-xs font-bold text-white font-mono bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-700/60">
            {candidate.predicted_class}
          </span>
          <span className="text-[11px] text-amber-400 font-medium">({confPercent}% sure)</span>
        </div>

        {candidate.mapped_product_name ? (
          <p className="text-xs text-indigo-300 font-semibold truncate mt-1">
            {candidate.mapped_product_name}
            {candidate.mapped_product_price_paise ? (
              <span className="text-emerald-400 font-normal ml-1">
                (₹{(candidate.mapped_product_price_paise / 100).toFixed(2)})
              </span>
            ) : null}
          </p>
        ) : (
          <p className="text-[11px] text-amber-300/90 mt-1">Unmapped item — select catalog product</p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-2 flex-shrink-0">
        <button
          onClick={() => onChooseProduct(candidate)}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1 shadow-sm transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Choose product</span>
        </button>
        <button
          onClick={() => onNotAProduct(candidate)}
          className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 text-xs font-medium flex items-center space-x-1 transition-colors"
          title="Dismiss as false positive"
        >
          <X className="w-3.5 h-3.5" />
          <span>Not a product</span>
        </button>
      </div>
    </div>
  );
};

interface ReviewTrayProps {
  candidates: ReviewCandidate[];
  frameDataUrl?: string;
  onChooseProduct: (candidate: ReviewCandidate) => void;
  onNotAProduct: (candidate: ReviewCandidate) => void;
}

export const ReviewTray: React.FC<ReviewTrayProps> = ({
  candidates,
  frameDataUrl,
  onChooseProduct,
  onNotAProduct,
}) => {
  if (!candidates || candidates.length === 0) {
    return null;
  }

  return (
    <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-4 shadow-xl mb-4 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Needs a look</h4>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {candidates.length} {candidates.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        <span className="text-[11px] text-slate-400">
          The camera saw items it's not sure about. Confirm or dismiss them.
        </span>
      </div>

      {/* Cards List */}
      <div className="mt-3 space-y-2">
        {candidates.map((cand) => (
          <ReviewCard
            key={cand.candidate_id}
            candidate={cand}
            frameDataUrl={frameDataUrl}
            onChooseProduct={onChooseProduct}
            onNotAProduct={onNotAProduct}
          />
        ))}
      </div>
    </div>
  );
};
