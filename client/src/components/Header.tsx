import React from 'react';
import { Sparkles, Terminal, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, action }) => {
  return (
    <header className="px-8 py-5 border-b border-brand-border bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-brand-dark">{title}</h1>
        {subtitle && <p className="text-xs text-brand-muted mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {action ? (
          action
        ) : (
          <Link
            to="/new-analysis"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:bg-brand-primary-hover shadow-sm transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Analyze Project</span>
          </Link>
        )}
      </div>
    </header>
  );
};

