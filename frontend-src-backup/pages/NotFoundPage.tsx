import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md text-center shadow-2xl">
        <div className="w-16 h-16 bg-indigo-600/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-500/30">
          <ShoppingCart className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-2">404</h1>
        <p className="text-sm font-semibold text-slate-300 mb-1">Page Not Found</p>
        <p className="text-xs text-slate-400 mb-6">
          The requested route does not exist in VisionCart AI.
        </p>
        <Link
          to="/"
          className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2.5 rounded-xl text-xs transition-colors"
        >
          Return to Application
        </Link>
      </div>
    </div>
  );
};

