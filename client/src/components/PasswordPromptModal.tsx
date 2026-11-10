import React, { useState } from 'react';
import { Lock, KeyRound, AlertCircle, X, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { unlockProject } from '../lib/api';

interface PasswordPromptModalProps {
  projectId: string;
  projectName: string;
  title?: string;
  description?: React.ReactNode;
  submitButtonText?: string;
  onUnlocked: (unlockToken?: string) => void;
  onCancel: () => void;
}

export const PasswordPromptModal: React.FC<PasswordPromptModalProps> = ({
  projectId,
  projectName,
  title,
  description,
  submitButtonText,
  onUnlocked,
  onCancel,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError(null);

    try {
      const res = await unlockProject(projectId, password);
      if (res?.unlockToken) {
        sessionStorage.setItem(`ernexa_assistant_unlock_${projectId}`, res.unlockToken);
      }
      onUnlocked(res?.unlockToken);
    } catch (err: any) {
      setError(err.message || 'Incorrect project password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-brand-border">
        <div className="flex items-center justify-between pb-3 border-b border-brand-border">
          <div className="flex items-center gap-2 text-brand-primary">
            <Lock className="w-5 h-5" />
            <h3 className="text-base font-bold text-brand-dark">{title || 'Protected Project'}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-lg hover:bg-brand-bg text-brand-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 space-y-3">
          <p className="text-xs text-stone-600 leading-relaxed">
            {description || (
              <>
                The project <strong className="text-stone-900">"{projectName}"</strong> is secured with an additional project password. Please enter the password to view its reconstructed knowledge base, diagrams, and code artifacts.
              </>
            )}
          </p>

          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-semibold text-brand-dark mb-1">
                Project Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-brand-muted absolute left-3 top-2.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Enter project password..."
                  required
                  autoFocus
                  className="w-full pl-9 pr-9 py-2 text-xs border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-brand-muted hover:text-brand-dark"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-border">
              <button
                type="button"
                onClick={onCancel}
                className="px-3.5 py-1.5 text-xs text-stone-600 hover:text-stone-900 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !password}
                className="px-4 py-2 bg-brand-primary text-white text-xs font-semibold rounded-xl hover:bg-brand-primary-hover disabled:opacity-50 transition"
              >
                {loading ? 'Verifying...' : (submitButtonText || 'Unlock Project')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

