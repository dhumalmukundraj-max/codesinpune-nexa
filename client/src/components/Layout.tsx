import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ConfigBanner } from './ConfigBanner';

export const Layout: React.FC = () => {
  return (
    <div className="flex min-h-screen bg-brand-bg text-brand-dark">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <ConfigBanner />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

