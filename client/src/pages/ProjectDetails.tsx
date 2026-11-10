import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Layers, 
  Trash2, 
  Share2, 
  ClipboardCheck, 
  Lock, 
  Calendar, 
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Eye,
  EyeOff,
  ShieldAlert,
  ShieldCheck,
  KeyRound
} from 'lucide-react';
import { fetchProjectDetails, deleteProject, submitProjectReview, launchAssistantWindow, unlockProject } from '../lib/api';
import { SummaryTab } from '../components/analysis/SummaryTab';
import { MermaidViewer } from '../components/MermaidViewer';
import { RoadmapTab } from '../components/analysis/RoadmapTab';
import { ProgressTab } from '../components/analysis/ProgressTab';
import { PasswordPromptModal } from '../components/PasswordPromptModal';
import { ShareProjectModal } from '../components/ShareProjectModal';

export const ProjectDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [projectData, setProjectData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'flowchart' | 'block' | 'roadmap' | 'progress'>('summary');

  // Password unlock state
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState<boolean>(false);
  const [showAssistantPasswordModal, setShowAssistantPasswordModal] = useState<boolean>(false);

  // Review states
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'under_review'>('approved');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);

  // Delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const loadProject = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const data = await fetchProjectDetails(id);
      if (data.isLocked) {
        setShowPasswordModal(true);
        setProjectData(data);
      } else {
        setProjectData(data);
        setShowPasswordModal(false);
        setUnlockError(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch project details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProject();
  }, [id]);

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !passwordInput.trim() || isUnlocking) return;
    setIsUnlocking(true);
    setUnlockError(null);
    try {
      await unlockProject(id, passwordInput.trim());
      setPasswordInput('');
      setUnlockError(null);
      await loadProject();
    } catch (err: any) {
      setUnlockError(err.message || 'Incorrect project password. Please try again.');
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleLaunchAssistantClick = () => {
    if (project?.has_password) {
      setShowAssistantPasswordModal(true);
    } else if (project?.id) {
      launchAssistantWindow(project.id);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await deleteProject(id);
      navigate('/projects');
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
      setIsDeleting(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsSubmittingReview(true);
    try {
      await submitProjectReview(id, {
        status: reviewStatus,
        notes: reviewNotes,
      });
      setShowReviewModal(false);
      await loadProject();
    } catch (err: any) {
      alert(`Review error: ${err.message}`);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-brand-muted flex flex-col items-center justify-center space-y-3">
        <RefreshCw className="w-6 h-6 animate-spin text-brand-primary" />
        <span>Loading project knowledge model...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="block text-sm font-bold text-red-900 mb-1">Access Restricted or Project Not Found</strong>
            <p className="leading-relaxed">{error}</p>
            <button
              type="button"
              onClick={() => navigate('/projects')}
              className="mt-3 px-3 py-1.5 bg-red-800 text-white font-medium rounded-lg hover:bg-red-900 transition"
            >
              Back to Projects
            </button>
          </div>
        </div>
      </div>
    );
  }

  const project = projectData?.project || (projectData?.id ? projectData : null);
  const analysis = projectData?.analysis;
  const isLocked = Boolean(projectData?.isLocked || project?.isLocked);
  const userRole = project?.userRole || 'viewer';
  const isOwner = userRole === 'owner';
  const canReview = ['owner', 'reviewer'].includes(userRole);

  const latestReview = projectData?.reviews?.[0];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      {/* Back button */}
      <button
        type="button"
        onClick={() => navigate('/projects')}
        className="flex items-center gap-1.5 text-xs font-semibold text-brand-muted hover:text-brand-dark transition active:scale-95"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Projects</span>
      </button>

      {/* Locked Project In-Page Dashboard */}
      {isLocked && project && (
        <div className="max-w-xl mx-auto py-4 sm:py-6">
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-brand-border p-5 sm:p-8 shadow-sm space-y-5 sm:space-y-6 text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/80 mx-auto flex items-center justify-center shadow-inner">
              <Lock className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold uppercase tracking-wider">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Encrypted Knowledge Base</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-brand-dark tracking-tight">
                Enter Password to Unlock Project
              </h2>
              <p className="text-xs text-brand-muted max-w-md mx-auto leading-relaxed">
                The project <strong className="text-brand-dark font-semibold">"{project.name}"</strong> is secured with an additional project password. Enter the password below to decrypt and view the reconstructed summary, architecture diagrams, roadmap, and Launch Assistant.
              </p>
            </div>

            {unlockError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 text-left">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{unlockError}</span>
              </div>
            )}

            <form onSubmit={handleUnlockSubmit} className="space-y-4 pt-2">
              <div className="text-left">
                <label className="block text-xs font-bold text-brand-dark mb-1.5">
                  Project Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-brand-muted absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (unlockError) setUnlockError(null);
                    }}
                    placeholder="Enter project password..."
                    required
                    autoFocus
                    className="w-full pl-10 pr-10 py-2.5 text-xs border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary bg-stone-50/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-brand-muted hover:text-brand-dark p-0.5"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/projects')}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-stone-600 hover:text-stone-900 rounded-xl border border-brand-border bg-white hover:bg-stone-50 transition"
                >
                  Back to Projects
                </button>
                <button
                  type="submit"
                  disabled={isUnlocking || !passwordInput.trim()}
                  className="w-full sm:flex-1 py-2.5 px-4 bg-brand-primary text-white text-xs font-bold rounded-xl hover:bg-brand-primary-hover disabled:opacity-50 transition shadow-sm flex items-center justify-center gap-2 active:scale-95"
                >
                  {isUnlocking ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Decrypting & Verifying...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Unlock Project</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="pt-4 border-t border-brand-border/60 text-[11px] text-brand-muted text-left flex items-start gap-2 bg-stone-50/50 p-3 rounded-xl">
              <Lock className="w-3.5 h-3.5 text-stone-400 mt-0.5 flex-shrink-0" />
              <span>
                <strong>Why is this locked?</strong> Er.NEXA keeps project-level encryption separate from your account login. Opening this project or launching its assistant requires the password set during creation.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Project Header Card */}
      {project && !isLocked && (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-brand-border p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-brand-border">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-brand-dark tracking-tight">{project.name}</h1>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-brand-secondary/30 text-brand-dark">
                  Role: {userRole}
                </span>
                {project.has_password && (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Protected</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-brand-muted mt-1 max-w-2xl leading-relaxed">
                {project.description || 'Knowledge base reconstructed by Er.NEXA.'}
              </p>
            </div>

            {/* Header Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Launch Assistant */}
              <button
                type="button"
                onClick={handleLaunchAssistantClick}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 text-stone-100 text-xs font-bold hover:bg-black transition shadow-sm active:scale-95"
              >
                <Layers className="w-4 h-4 text-brand-secondary" />
                <span>Launch Assistant</span>
              </button>

              {/* Review / Handover */}
              {canReview && (
                <button
                  type="button"
                  onClick={() => setShowReviewModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-brand-border text-brand-dark text-xs font-semibold hover:bg-brand-bg transition active:scale-95"
                >
                  <ClipboardCheck className="w-4 h-4 text-emerald-600" />
                  <span>Review & Handover</span>
                </button>
              )}

              {/* Share Project */}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setShowShareModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-brand-border text-brand-dark text-xs font-semibold hover:bg-brand-bg transition active:scale-95"
                >
                  <Share2 className="w-4 h-4 text-brand-primary" />
                  <span>Share</span>
                </button>
              )}

              {/* Delete Project */}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="p-2 rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50 transition active:scale-95"
                  title="Delete Project"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs">
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <div>
                <span className="text-brand-muted">Completion: </span>
                <strong className="text-brand-primary font-bold">{project.completion_percentage}%</strong>
              </div>
              <div>
                <span className="text-brand-muted">Analysis Date: </span>
                <strong className="text-stone-800">{new Date(project.created_at).toLocaleDateString()}</strong>
              </div>
              <div>
                <span className="text-brand-muted">Source: </span>
                <span className="uppercase font-mono text-[11px] font-semibold text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded">
                  {project.source_type}
                </span>
              </div>
            </div>

            {latestReview && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-brand-muted">Handover Status:</span>
                <span
                  className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                    latestReview.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {latestReview.status.replace('_', ' ')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5 Tab Navigation Buttons */}
      {analysis && !isLocked && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 pt-1 border-b border-brand-border -mx-1 px-1">
            {[
              { id: 'summary', label: '1. Project Summary' },
              { id: 'flowchart', label: '2. Flowchart' },
              { id: 'block', label: '3. Block Diagram' },
              { id: 'roadmap', label: '4. Development Roadmap' },
              { id: 'progress', label: '5. Project Progress' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 sm:px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'bg-white text-stone-700 hover:bg-brand-bg border border-brand-border'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Summary */}
          {activeTab === 'summary' && (
            <SummaryTab summary={analysis.summary} />
          )}

          {/* Tab 2: Flowchart */}
          {activeTab === 'flowchart' && (
            <MermaidViewer
              id="flowchart-viewer"
              title="Project Workflow Flowchart"
              chart={analysis.flowchart_mermaid || analysis.flowchartMermaid || ''}
            />
          )}

          {/* Tab 3: Block Diagram */}
          {activeTab === 'block' && (
            <MermaidViewer
              id="block-viewer"
              title="System Architecture Block Diagram"
              chart={analysis.block_diagram_mermaid || analysis.blockDiagramMermaid || ''}
            />
          )}

          {/* Tab 4: Roadmap */}
          {activeTab === 'roadmap' && (
            <RoadmapTab roadmap={analysis.roadmap} />
          )}

          {/* Tab 5: Progress */}
          {activeTab === 'progress' && (
            <ProgressTab metrics={analysis.progress_metrics || analysis.progressMetrics} summary={analysis.summary} />
          )}
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && project && (
        <ShareProjectModal
          projectId={project.id}
          projectName={project.name}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Review & Handover Modal */}
      {showReviewModal && project && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl border border-brand-border">
            <h3 className="text-base font-bold text-brand-dark pb-2 border-b border-brand-border">
              Human Review & Handover Approval
            </h3>

            <form onSubmit={handleReviewSubmit} className="space-y-4 py-4 text-xs">
              <p className="text-stone-600">
                As an authorized reviewer, review the reconstructed knowledge model for <strong>"{project.name}"</strong>, record observations, and grant formal approval for handover.
              </p>

              <div>
                <label className="block font-semibold text-brand-dark mb-1">
                  Handover Status
                </label>
                <select
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white"
                >
                  <option value="approved">Approved — Verified for handover to incoming engineers</option>
                  <option value="under_review">Under Review — Additional verification required</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-brand-dark mb-1">
                  Reviewer Notes & Verification Comments
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={4}
                  placeholder="Record verification notes, architecture clarifications, or signoff comments..."
                  className="w-full p-3 border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-brand-border">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="px-3.5 py-1.5 text-stone-600 hover:text-stone-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  {isSubmittingReview ? 'Submitting...' : 'Sign Handover Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Requirement 9) */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl border border-red-200">
            <div className="flex items-center gap-2 text-red-600 mb-2">
              <Trash2 className="w-5 h-5" />
              <h3 className="text-base font-bold text-stone-900">Delete Project Knowledge Base?</h3>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed mb-4">
              Are you sure you want to permanently delete <strong>"{project.name}"</strong>? This will cascade delete all associated diagrams, roadmap records, handover approvals, and permissions. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-3.5 py-1.5 text-xs text-stone-600 hover:text-stone-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 transition"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Prompt Modal for Launch Assistant */}
      {showAssistantPasswordModal && project && (
        <PasswordPromptModal
          projectId={project.id}
          projectName={project.name}
          title="Launch AI Assistant — Password Required"
          description={
            <>
              The project <strong className="text-stone-900">"{project.name}"</strong> is password protected. Enter the project password to launch its AI Launch Assistant.
            </>
          }
          submitButtonText="Verify & Launch Assistant"
          onUnlocked={(token) => {
            setShowAssistantPasswordModal(false);
            launchAssistantWindow(project.id, token);
          }}
          onCancel={() => setShowAssistantPasswordModal(false)}
        />
      )}
    </div>
  );
};

