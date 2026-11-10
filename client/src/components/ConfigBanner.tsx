import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, X, ExternalLink } from 'lucide-react';
import { checkServerHealth } from '../lib/api';
import { isSupabaseConfigured } from '../lib/supabase';

export const ConfigBanner: React.FC = () => {
  const [serverStatus, setServerStatus] = useState<{
    configured: { supabase: boolean; gemini: boolean };
  } | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);

  useEffect(() => {
    checkServerHealth()
      .then((data) => setServerStatus(data))
      .catch(() => {
        // server might be offline or initializing
      });
  }, []);

  const needsSupabase = !isSupabaseConfigured || (serverStatus && !serverStatus.configured.supabase);
  const needsGemini = serverStatus && !serverStatus.configured.gemini;

  if (dismissed || (!needsSupabase && !needsGemini)) {
    return null;
  }

  return (
    <>
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-start sm:items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5 sm:mt-0" />
          <span className="leading-relaxed">
            <strong>Configuration Action Required:</strong>{' '}
            {needsSupabase && needsGemini
              ? 'Supabase credentials and Google Gemini API key are pending configuration.'
              : needsSupabase
              ? 'Supabase database & auth credentials are required for saved projects and accounts.'
              : 'Google Gemini API key is missing in .env for codebase AI reconstruction.'}
          </span>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="font-medium underline hover:text-amber-950 flex items-center gap-1"
          >
            Setup Guide <ChevronRight className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-amber-700 hover:text-amber-950 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Setup Guide Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl border border-brand-border">
            <div className="flex items-center justify-between pb-3 border-b border-brand-border">
              <h3 className="text-base font-semibold text-brand-dark">Er.NEXA Environment Configuration</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-brand-bg text-brand-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs text-stone-700">
              <p>
                To enable all live capabilities (User authentication, secure cloud database, Gemini AI analysis, and Desktop Launch Assistant), configure your root <code className="bg-stone-100 px-1 py-0.5 rounded text-brand-primary font-mono font-bold">.env</code> file:
              </p>

              <div className="bg-stone-900 text-stone-100 p-3 rounded-lg font-mono text-[11px] space-y-1">
                <p className="text-stone-400"># Supabase</p>
                <p>VITE_SUPABASE_URL=https://[project-id].supabase.co</p>
                <p>VITE_SUPABASE_ANON_KEY=eyJhbGciOi...</p>
                <p>SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...</p>
                <p className="text-stone-400 pt-2"># Google Gemini AI</p>
                <p>GEMINI_API_KEY=AIzaSy...</p>
                <p className="text-stone-400 pt-2"># Backend Server</p>
                <p>PORT=5000</p>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-stone-900">Database Schema:</strong> Execute the SQL script in <code className="bg-stone-100 px-1 py-0.5 rounded font-mono">supabase/schema.sql</code> inside your Supabase Project SQL Editor to auto-create all tables and RLS policies.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-stone-900">Google Gemini API:</strong> Obtain a free Gemini API key from <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-brand-primary underline inline-flex items-center gap-0.5">Google AI Studio <ExternalLink className="w-2.5 h-2.5" /></a> and paste it into <code className="bg-stone-100 px-1 py-0.5 rounded font-mono">GEMINI_API_KEY</code>.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-brand-border">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-brand-primary text-white text-xs font-medium rounded-lg hover:bg-brand-primary-hover transition"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

