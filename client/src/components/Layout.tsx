import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ConfigBanner } from './ConfigBanner';
import { Menu, Layers, Cpu } from 'lucide-react';
import { launchAssistantWindow } from '../lib/api';

export const Layout: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Close mobile drawer on route changes
  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-brand-bg text-brand-dark">
      {/* Responsive Sidebar (Desktop aside + Mobile slide-over drawer) */}
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Sticky Header (< 1024px) */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-brand-border sticky top-0 z-40 shadow-xs">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-brand-primary flex items-center justify-center text-white shadow-sm transition group-hover:scale-105">
              <Cpu className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-brand-dark">Er.NEXA</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded bg-brand-secondary/30 text-brand-dark">
                v1.0
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => launchAssistantWindow('')}
              title="Launch Floating Assistant"
              className="flex items-center gap-1 p-2 rounded-xl bg-stone-900 text-stone-100 hover:bg-black transition text-xs font-semibold active:scale-95"
            >
              <Layers className="w-4 h-4 text-brand-secondary" />
              <span className="hidden xs:inline text-[11px]">Assistant</span>
            </button>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 rounded-xl border border-brand-border hover:bg-brand-bg text-brand-dark transition active:scale-95"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Global Configuration Banner */}
        <ConfigBanner />

        {/* Main Routed Page Content */}
        <main className="flex-1 overflow-y-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
