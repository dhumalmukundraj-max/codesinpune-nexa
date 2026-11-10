import React, { useState } from 'react';
import { UserPlus, Mail, Shield, X, Check, AlertCircle } from 'lucide-react';
import { shareProject } from '../lib/api';

interface ShareProjectModalProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
  onShared?: () => void;
}

export const ShareProjectModal: React.FC<ShareProjectModalProps> = ({
  projectId,
  projectName,
  onClose,
  onShared,
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor' | 'reviewer'>('viewer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await shareProject(projectId, email, role);
      setSuccess(res.message || 'Project shared successfully!');
      setEmail('');
      if (onShared) onShared();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to share project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl border border-brand-border">
        <div className="flex items-center justify-between pb-3 border-b border-brand-border">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-brand-primary" />
            <h3 className="text-base font-bold text-brand-dark">Share Project Knowledge</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-brand-bg text-brand-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 space-y-4">
          <p className="text-xs text-stone-600">
            Grant an incoming engineer or reviewer access to <strong className="text-stone-900">"{projectName}"</strong>. They will be able to access the reconstructed diagrams, roadmap, and desktop assistant.
          </p>

          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-green-50 border border-green-200 text-xs text-green-700">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-brand-dark mb-1">
                Collaborator Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-brand-muted absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  required
                  className="w-full pl-9 pr-3 py-2 text-xs border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-dark mb-1">
                Access Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-3 py-2 text-xs border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white"
              >
                <option value="viewer">Viewer — Read-only access to knowledge & assistant</option>
                <option value="reviewer">Reviewer — Can review, edit notes, and sign handover</option>
                <option value="editor">Editor — Can update code analyses and project data</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-brand-border">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs text-stone-600 hover:text-stone-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !email}
                className="px-4 py-2 bg-brand-primary text-white text-xs font-semibold rounded-xl hover:bg-brand-primary-hover disabled:opacity-50 transition"
              >
                {loading ? 'Sharing...' : 'Share Access'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

