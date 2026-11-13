import React from 'react';
import { Link } from 'react-router-dom';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-4 text-ink font-body">
      <div className="bg-surface border border-counter-grey rounded-panel p-8 max-w-sm text-center shadow-xs">
        <span className="font-heading font-bold text-4xl text-ink block mb-2">404</span>
        <h1 className="text-sm font-heading font-semibold text-ink mb-1">Page not found</h1>
        <p className="text-xs text-ink-muted mb-5 leading-relaxed">
          The requested page does not exist on this counter system.
        </p>
        <Link
          to="/"
          className="inline-block bg-primary hover:bg-primary-hover text-white font-medium px-5 py-2.5 rounded-control text-xs transition-colors shadow-xs"
        >
          Return to counter
        </Link>
      </div>
    </div>
  );
};
