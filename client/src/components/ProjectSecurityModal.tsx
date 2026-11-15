import React, { useState } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  KeyRound, 
  Lock, 
  Unlock, 
  AlertTriangle, 
  X, 
  CheckCircle2, 
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { changeProjectPassword, removeProjectPassword } from '../lib/api';

interface ProjectSecurityModalProps {
  projectId: string;
  projectName: string;
  hasPassword: boolean;
  onClose: () => void;
  onSecurityUpdated: (newHasPassword: boolean) => void;
}

export const ProjectSecurityModal: React.FC<ProjectSecurityModalProps> = ({
  projectId,
  projectName,
  hasPassword,
  onClose,
  onSecurityUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'change' | 'remove'>('change');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirmation do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await changeProjectPassword(projectId, {
        currentPassword: currentPassword || undefined,
        newPassword,
        confirmPassword,
      });

      setSuccessMessage(res.message || 'Encryption password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onSecurityUpdated(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to change password. Please verify current password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemovePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!confirmRemoval) {
      setErrorMessage('Please acknowledge the security consequence checkbox to proceed.');
      return;
    }

    if (!currentPassword) {
      setErrorMessage('Current encryption password is required to remove protection.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await removeProjectPassword(projectId, {
        currentPassword,
        confirmRemove: true,
      });

      setSuccessMessage(res.message || 'Password protection removed successfully.');
      onSecurityUpdated(false);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to remove password protection. Incorrect password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-stone-100 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">Project Encryption Security</h3>
              <p className="text-xs text-stone-500 font-mono truncate max-w-xs">{projectName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status / Alert Messages */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mx-6 mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Tabs */}
        {hasPassword && (
          <div className="flex border-b border-stone-100 px-6 pt-3 gap-4 text-xs font-bold">
            <button
              type="button"
              onClick={() => { setActiveTab('change'); setErrorMessage(null); }}
              className={`pb-2.5 transition border-b-2 ${
                activeTab === 'change'
                  ? 'border-[#C1121F] text-[#C1121F]'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              Change Password
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('remove'); setErrorMessage(null); }}
              className={`pb-2.5 transition border-b-2 ${
                activeTab === 'remove'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              Remove Password Protection
            </button>
          </div>
        )}

        {/* TAB 1: Change Encryption Password */}
        {(!hasPassword || activeTab === 'change') && (
          <form onSubmit={handleChangePassword} className="p-6 space-y-4 text-xs">
            <p className="text-stone-600 leading-relaxed">
              {hasPassword
                ? 'Update your project encryption password. Safe key derivation ensures previously saved knowledge remains fully accessible.'
                : 'Protect this project with AES-256 password encryption. Required to open project or launch assistant.'}
            </p>

            {hasPassword && (
              <div>
                <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Current Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="Enter current password"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C1121F]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
                New Password <span className="text-red-500">*</span>
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                placeholder="At least 6 characters"
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C1121F]/20"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Confirm New Password <span className="text-red-500">*</span>
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Re-enter new password"
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C1121F]/20"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#C1121F] hover:bg-[#9B0E19] text-white font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
              >
                {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                <span>{isLoading ? 'Updating...' : hasPassword ? 'Update Password' : 'Set Password'}</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: Remove Password Protection */}
        {hasPassword && activeTab === 'remove' && (
          <form onSubmit={handleRemovePassword} className="p-6 space-y-4 text-xs">
            {/* Warning banner */}
            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 space-y-1.5 leading-relaxed">
              <div className="flex items-center gap-1.5 font-bold text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Security Notice: Removing Password Protection</span>
              </div>
              <p>
                Removing encryption protection allows any team member with access to open the project knowledge base and launch the assistant without entering a password prompt.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Enter Current Password to Confirm <span className="text-red-500">*</span>
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                placeholder="Current project password"
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={confirmRemoval}
                onChange={(e) => setConfirmRemoval(e.target.checked)}
                className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer mt-0.5"
              />
              <span className="text-stone-700 font-medium leading-relaxed">
                I understand the security consequences and explicitly confirm removing password encryption from this project.
              </span>
            </label>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !confirmRemoval || !currentPassword}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
              >
                {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Unlock className="w-3.5 h-3.5" />}
                <span>{isLoading ? 'Removing...' : 'Remove Protection'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
