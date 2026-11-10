import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  PlusCircle, 
  FolderKanban, 
  ClipboardCheck, 
  LogOut, 
  Layers, 
  Cpu, 
  ShieldCheck,
  User as UserIcon 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { launchAssistantWindow } from '../lib/api';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/new-analysis', label: 'New Analysis', icon: PlusCircle },
    { to: '/projects', label: 'Saved Projects', icon: FolderKanban },
    { to: '/reviews', label: 'Reviews & Handover', icon: ClipboardCheck },
  ];

  return (
    <aside className="w-64 bg-white border-r border-brand-border flex flex-col h-screen sticky top-0 select-none">
      {/* Brand Header */}
      <div className="p-6 border-b border-brand-border flex items-center justify-between">
        <NavLink to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-brand-primary flex items-center justify-center text-white shadow-sm transition group-hover:scale-105">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg tracking-tight text-brand-dark">Er.NEXA</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-secondary/30 text-brand-dark">
                v1.0
              </span>
            </div>
            <p className="text-[11px] text-brand-muted">AI Knowledge Engine</p>
          </div>
        </NavLink>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold text-brand-muted uppercase tracking-wider">
          Platform
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-stone-700 hover:bg-brand-bg hover:text-brand-dark'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Floating Assistant Launcher Quick Pill */}
      <div className="p-4 mx-4 mb-4 rounded-xl bg-brand-bg border border-brand-border/80">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-semibold text-brand-dark">Desktop Assistant</span>
        </div>
        <p className="text-[11px] text-brand-muted mb-2.5 leading-relaxed">
          Open project-grounded floating assistant with isolated sessions.
        </p>
        <button
          type="button"
          onClick={() => launchAssistantWindow('')}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-lg bg-stone-900 text-stone-100 hover:bg-black transition"
        >
          <Layers className="w-3.5 h-3.5 text-brand-secondary" />
          <span>Launch Companion</span>
        </button>
      </div>

      {/* User Session Footer */}
      <div className="p-4 border-t border-brand-border bg-white flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-brand-secondary/40 text-brand-dark flex items-center justify-center font-semibold text-xs flex-shrink-0">
            {user?.email ? user.email[0].toUpperCase() : <UserIcon className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-brand-dark truncate">
              {user?.user_metadata?.full_name || (user?.email ? user.email.split('@')[0] : 'Guest User')}
            </p>
            <p className="text-[10px] text-brand-muted truncate">{user?.email || 'Not signed in'}</p>
          </div>
        </div>

        {user && (
          <button
            type="button"
            onClick={handleLogout}
            title="Log out"
            className="p-1.5 text-brand-muted hover:text-brand-primary rounded-lg hover:bg-brand-bg transition flex-shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
};

