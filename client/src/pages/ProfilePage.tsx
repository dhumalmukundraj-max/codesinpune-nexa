import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  ArrowLeft, 
  Edit3, 
  Camera, 
  Trash2, 
  KeyRound, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Layers, 
  MessageSquare, 
  ExternalLink,
  Sparkles,
  Save,
  AtSign,
  Hash
} from 'lucide-react';
import { fetchMyProfile, updateMyProfile, fetchProjects } from '../lib/api';
import { UserProfile, ProjectItem } from '../types';
import { useAuth } from '../context/AuthContext';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit form state
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [publicId, setPublicId] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [profileRes, projRes] = await Promise.all([
        fetchMyProfile(),
        fetchProjects(),
      ]);

      if (profileRes.profile) {
        setProfile(profileRes.profile);
        setDisplayName(profileRes.profile.display_name || profileRes.profile.full_name || '');
        setUsername(profileRes.profile.username || '');
        setBio(profileRes.profile.bio || '');
        setPublicId(profileRes.profile.public_id || '');
        setAvatarUrl(profileRes.profile.avatar_url || '');
      }
      if (projRes.projects) {
        setProjects(projRes.projects);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load profile.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please choose a valid image file (PNG, JPG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image size must be less than 5MB.');
      return;
    }

    // Convert to Base64 data URL for preview and storage
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    const seed = profile?.id || 'default';
    setAvatarUrl(`https://api.dicebear.com/7.x/identicon/svg?seed=${seed}`);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validate username
    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(cleanUsername)) {
      setErrorMessage('Username must be 3-30 characters (letters, numbers, underscores, periods).');
      setIsSaving(false);
      return;
    }

    try {
      const res = await updateMyProfile({
        display_name: displayName.trim(),
        username: cleanUsername,
        bio: bio.trim(),
        public_id: publicId.trim(),
        avatar_url: avatarUrl,
      });

      setProfile(res.profile);
      setIsEditing(false);
      setSuccessMessage('Your profile was updated successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/dashboard');
    }
  };

  if (isLoading) {
    return (
      <div className="p-16 text-center flex flex-col items-center justify-center space-y-3">
        <RefreshCw className="w-7 h-7 text-[#C1121F] animate-spin" />
        <span className="text-xs text-stone-500 font-medium">Loading user identity profile...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8">
      {/* Back Button */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 transition active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
      </div>

      {/* Alert Notices */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="font-bold ml-2">×</button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="font-bold ml-2">×</button>
        </div>
      )}

      {/* Instagram-Inspired Profile Header Card */}
      <div className="bg-white rounded-3xl border border-brand-border p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
          {/* Circular Avatar */}
          <div className="relative group shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-white shadow-lg ring-2 ring-[#C1121F]/20 bg-stone-100 flex items-center justify-center">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name || 'User Avatar'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-12 h-12 text-stone-400" />
              )}
            </div>

            {isEditing && (
              <label className="absolute bottom-0 right-0 p-2 rounded-full bg-[#C1121F] text-white hover:bg-[#9B0E19] shadow-md cursor-pointer transition">
                <Camera className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleAvatarFile}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* User Details & Stats */}
          <div className="flex-1 text-center sm:text-left space-y-3 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                  {profile?.display_name || profile?.full_name || 'Er.NEXA Engineer'}
                </h1>
                <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-stone-500 font-mono mt-0.5">
                  <span className="text-[#C1121F] font-bold">@{profile?.username || 'user'}</span>
                  <span>•</span>
                  <span className="bg-stone-100 px-2 py-0.5 rounded text-stone-700 font-semibold text-[11px]">
                    {profile?.public_id || 'NX-VERIFIED'}
                  </span>
                </div>
              </div>

              <div>
                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-stone-200 hover:border-stone-300 bg-white hover:bg-stone-50 rounded-xl text-xs font-bold text-stone-800 transition active:scale-95 shadow-sm"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 border border-stone-200 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-50 transition"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {/* Bio */}
            <p className="text-xs text-stone-600 max-w-xl leading-relaxed">
              {profile?.bio || 'Software engineer & architectural explorer on Er.NEXA.'}
            </p>

            {/* Stats row */}
            <div className="flex items-center justify-center sm:justify-start gap-6 pt-2 text-xs">
              <div>
                <span className="font-black text-stone-900 text-sm">{projects.length}</span>{' '}
                <span className="text-stone-500 font-medium">Projects</span>
              </div>
              <div>
                <span className="font-black text-stone-900 text-sm">
                  {projects.reduce((acc, p) => acc + (p.completion_percentage === 100 ? 1 : 0), 0)}
                </span>{' '}
                <span className="text-stone-500 font-medium">Completed</span>
              </div>
              <div>
                <span className="font-black text-stone-900 text-sm">Active</span>{' '}
                <span className="text-stone-500 font-medium">Engineer</span>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Form Modal/Drawer */}
        {isEditing && (
          <form onSubmit={handleSaveProfile} className="mt-8 pt-6 border-t border-stone-100 space-y-4 text-xs">
            <h3 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#C1121F]" />
              <span>Edit Personal Profile Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  maxLength={60}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C1121F]/20"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Unique Username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-mono">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="john_doe"
                    className="w-full pl-8 pr-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C1121F]/20"
                  />
                </div>
                <p className="text-[10px] text-stone-400 mt-1">Unique handle across all Er.NEXA messages and collaborations.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Custom Public ID
                </label>
                <input
                  type="text"
                  value={publicId}
                  onChange={(e) => setPublicId(e.target.value)}
                  placeholder="NX-USER123"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C1121F]/20"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Profile Picture Controls
                </label>
                <div className="flex items-center gap-2">
                  <label className="px-3 py-2 bg-stone-100 hover:bg-stone-200 rounded-xl text-stone-700 cursor-pointer font-semibold transition">
                    Upload New Image
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      onChange={handleAvatarFile}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="px-3 py-2 border border-stone-200 hover:bg-red-50 text-stone-600 hover:text-red-700 rounded-xl font-semibold transition"
                  >
                    Reset Avatar
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Bio & Engineering Focus
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={300}
                placeholder="Describe your engineering role, projects, or interests..."
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C1121F]/20"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#C1121F] hover:bg-[#9B0E19] text-white rounded-xl font-bold shadow-sm transition disabled:opacity-50"
              >
                {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{isSaving ? 'Saving Changes...' : 'Save Profile'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Projects Showcase */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-stone-900">Associated Projects ({projects.length})</h2>
          <span className="text-xs text-stone-500 font-medium">Reconstructed Codebases</span>
        </div>

        {projects.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-brand-border text-stone-500 text-xs">
            No projects associated with this profile yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((proj) => (
              <div
                key={proj.id}
                onClick={() => navigate(`/projects/${proj.id}`)}
                className="p-5 bg-white rounded-2xl border border-brand-border hover:border-[#C1121F] transition shadow-sm cursor-pointer space-y-3 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase bg-stone-100 text-stone-700 px-2 py-0.5 rounded font-semibold">
                    {proj.source_type || 'folder'}
                  </span>
                  <span className="text-xs font-bold text-[#C1121F] font-mono">
                    {proj.completion_percentage}%
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-stone-900 group-hover:text-[#C1121F] transition truncate">
                    {proj.name}
                  </h4>
                  <p className="text-xs text-stone-500 line-clamp-2 mt-1">
                    {proj.description || 'Knowledge base reconstructed by Er.NEXA.'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
