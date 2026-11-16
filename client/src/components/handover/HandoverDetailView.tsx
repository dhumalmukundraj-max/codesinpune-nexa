import React, { useState } from 'react';
import { 
  ArrowLeft, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Share2, 
  FileCheck2, 
  GitBranch, 
  MessageSquare, 
  History, 
  CheckSquare, 
  FileText, 
  Send, 
  Edit3, 
  Save, 
  Sparkles, 
  Info, 
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  User,
  Layers,
  Code2,
  Cpu,
  BookOpen,
  Lock,
  Loader2
} from 'lucide-react';
import { 
  ProjectHandoverItem, 
  HandoverClaim, 
  HandoverVersion, 
  HandoverComment, 
  HandoverAcknowledgement,
  ContinuationChecklistItem,
  ClaimVerificationStatus
} from '../../types';
import { 
  updateHandoverContent, 
  verifyHandoverClaim, 
  submitHandoverForReview, 
  reviewHandoverDecision, 
  shareHandover, 
  updateHandoverChecklist, 
  acknowledgeHandover, 
  addHandoverComment 
} from '../../lib/api';

interface HandoverDetailViewProps {
  handover: ProjectHandoverItem;
  claims: HandoverClaim[];
  versions: HandoverVersion[];
  comments: HandoverComment[];
  acknowledgement?: HandoverAcknowledgement | null;
  currentUserId?: string;
  onBack: () => void;
  onRefresh: () => void;
}

type TabType = 'document' | 'evidence' | 'review' | 'checklist' | 'versions' | 'discussion';

export const HandoverDetailView: React.FC<HandoverDetailViewProps> = ({
  handover,
  claims: initialClaims,
  versions,
  comments: initialComments,
  acknowledgement,
  currentUserId,
  onBack,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('document');
  const [claims, setClaims] = useState<HandoverClaim[]>(initialClaims);
  const [comments, setComments] = useState<HandoverComment[]>(initialComments);
  const [checklist, setChecklist] = useState<ContinuationChecklistItem[]>(
    handover.metadata?.checklist || []
  );

  // Claim filtering
  const [claimFilter, setClaimFilter] = useState<string>('ALL');

  // Review state
  const [reviewDecision, setReviewDecision] = useState<'APPROVED' | 'REVISION_REQUIRED'>('APPROVED');
  const [reviewNotes, setReviewNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Acknowledgement state
  const [ackConfirmed, setAckConfirmed] = useState(false);
  const [ackComments, setAckComments] = useState('');
  const [ackMissingInfo, setAckMissingInfo] = useState('');
  const [submittingAck, setSubmittingAck] = useState(false);

  // Discussion state
  const [newComment, setNewComment] = useState('');
  const [commentType, setCommentType] = useState<'general' | 'clarification_request' | 'review_note'>('general');
  const [postingComment, setPostingComment] = useState(false);

  // Edit document state
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(handover.content);
  const [changeSummary, setChangeSummary] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Action loading states
  const [actionLoading, setActionLoading] = useState(false);

  // Status color badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-700">DRAFT</span>;
      case 'UNDER_REVIEW':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 flex items-center gap-1"><Clock className="w-3 h-3" /> UNDER REVIEW</span>;
      case 'REVISION_REQUIRED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> REVISION REQUIRED</span>;
      case 'APPROVED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> APPROVED</span>;
      case 'SHARED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 flex items-center gap-1"><Share2 className="w-3 h-3" /> SHARED</span>;
      case 'ACKNOWLEDGED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> ACKNOWLEDGED</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-700">{status}</span>;
    }
  };

  const getConfidenceBadge = (status: ClaimVerificationStatus) => {
    switch (status) {
      case 'VERIFIED FACT':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">VERIFIED FACT</span>;
      case 'AI INFERENCE':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">AI INFERENCE</span>;
      case 'CONFLICTING INFORMATION':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">CONFLICTING INFO</span>;
      case 'UNKNOWN':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-stone-100 text-stone-600 border border-stone-200">UNKNOWN</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-stone-100 text-stone-700">{status}</span>;
    }
  };

  // Submit for Review
  const handleSubmitForReview = async () => {
    try {
      setActionLoading(true);
      await submitHandoverForReview(handover.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to submit for review');
    } finally {
      setActionLoading(false);
    }
  };

  // Human Review Decision
  const handleReviewDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingReview(true);
      await reviewHandoverDecision(handover.id, reviewDecision, reviewNotes);
      setReviewNotes('');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  // Share Handover
  const handleShare = async () => {
    try {
      setActionLoading(true);
      await shareHandover(handover.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to share handover');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle checklist item
  const handleToggleChecklistItem = async (itemId: string) => {
    const updated = checklist.map((item) => {
      if (item.id === itemId) {
        const nextStatus = item.status === 'completed' ? 'pending' : 'completed';
        return { ...item, status: nextStatus as any };
      }
      return item;
    });
    setChecklist(updated);
    try {
      await updateHandoverChecklist(handover.id, updated);
    } catch (err) {
      console.warn('Failed to sync checklist update:', err);
    }
  };

  // Acknowledge Receipt
  const handleAcknowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ackConfirmed) return;
    try {
      setSubmittingAck(true);
      await acknowledgeHandover(handover.id, {
        checklist_state: checklist,
        comments: ackComments,
        missing_information_reported: ackMissingInfo,
        status: ackMissingInfo.trim() ? 'NEEDS_CLARIFICATION' : 'CONFIRMED',
        version_number: handover.current_version,
      });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to acknowledge handover');
    } finally {
      setSubmittingAck(false);
    }
  };

  // Verify Claim
  const handleVerifyClaim = async (claimId: string, status: ClaimVerificationStatus) => {
    try {
      const res = await verifyHandoverClaim(handover.id, claimId, status);
      if (res.claim) {
        setClaims((prev) => prev.map((c) => (c.id === claimId ? res.claim : c)));
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update claim verification');
    }
  };

  // Add Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      setPostingComment(true);
      const res = await addHandoverComment(handover.id, {
        content: newComment.trim(),
        comment_type: commentType,
      });
      if (res.comment) {
        setComments((prev) => [...prev, res.comment]);
        setNewComment('');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to add comment');
    } finally {
      setPostingComment(false);
    }
  };

  // Save Document Edits
  const handleSaveEdits = async () => {
    try {
      setSavingEdit(true);
      await updateHandoverContent(handover.id, editedContent, changeSummary);
      setIsEditing(false);
      setChangeSummary('');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to save document edits');
    } finally {
      setSavingEdit(false);
    }
  };

  const content = handover.content || {};
  const filteredClaims = claimFilter === 'ALL'
    ? claims
    : claims.filter((c) => c.verification_status === claimFilter);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Back button & Title bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl border border-stone-200 hover:bg-stone-100 text-stone-600 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-stone-900 tracking-tight">{handover.title}</h1>
              {getStatusBadge(handover.status)}
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-stone-100 text-stone-600">
                v{handover.current_version}
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Project: <span className="font-semibold text-stone-700">{handover.projectName || 'Project'}</span> • Created {new Date(handover.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Action Buttons based on status */}
        <div className="flex items-center gap-2 flex-wrap">
          {(handover.status === 'DRAFT' || handover.status === 'REVISION_REQUIRED') && (
            <button
              type="button"
              onClick={handleSubmitForReview}
              disabled={actionLoading}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
            >
              {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
              Submit for Review
            </button>
          )}

          {handover.status === 'UNDER_REVIEW' && (
            <button
              type="button"
              onClick={() => setActiveTab('review')}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Review & Approve
            </button>
          )}

          {handover.status === 'APPROVED' && (
            <button
              type="button"
              onClick={handleShare}
              disabled={actionLoading}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
            >
              {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
              Share with Incoming Team
            </button>
          )}

          {handover.status === 'SHARED' && (
            <button
              type="button"
              onClick={() => setActiveTab('checklist')}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              Acknowledge Receipt
            </button>
          )}
        </div>
      </div>

      {/* Participants Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-2xl border border-stone-200 shadow-sm text-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
            Project Creator
          </span>
          <div className="flex items-center gap-2">
            <img
              src={handover.creatorProfile?.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${handover.creator_id}`}
              className="w-5 h-5 rounded-full"
            />
            <span className="font-semibold text-stone-800 truncate">
              {handover.creatorProfile?.display_name || handover.creatorProfile?.email || 'Owner'}
            </span>
          </div>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 block mb-1">
            Outgoing Member
          </span>
          <div className="flex items-center gap-2">
            <img
              src={handover.outgoingProfile?.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${handover.outgoing_member_id || 'outgoing'}`}
              className="w-5 h-5 rounded-full"
            />
            <span className="font-semibold text-stone-800 truncate">
              {handover.outgoingProfile?.display_name || handover.outgoingProfile?.email || 'Outgoing Member'}
            </span>
          </div>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block mb-1">
            Incoming Member
          </span>
          <div className="flex items-center gap-2">
            <img
              src={handover.incomingProfile?.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${handover.incoming_member_id || 'incoming'}`}
              className="w-5 h-5 rounded-full"
            />
            <span className="font-semibold text-stone-800 truncate">
              {handover.incomingProfile?.display_name || handover.incomingProfile?.email || 'Incoming Member'}
            </span>
          </div>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block mb-1">
            Assigned Reviewer
          </span>
          <div className="flex items-center gap-2">
            <img
              src={handover.reviewerProfile?.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${handover.reviewer_id || 'reviewer'}`}
              className="w-5 h-5 rounded-full"
            />
            <span className="font-semibold text-stone-800 truncate">
              {handover.reviewerProfile?.display_name || handover.reviewerProfile?.email || 'Designated Reviewer'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex items-center gap-1.5 border-b border-stone-200 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('document')}
          className={`px-4 py-2 font-bold rounded-xl whitespace-nowrap transition flex items-center gap-1.5 ${
            activeTab === 'document'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Handover Document (A-M)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('evidence')}
          className={`px-4 py-2 font-bold rounded-xl whitespace-nowrap transition flex items-center gap-1.5 ${
            activeTab === 'evidence'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Evidence & Claims ({claims.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('review')}
          className={`px-4 py-2 font-bold rounded-xl whitespace-nowrap transition flex items-center gap-1.5 ${
            activeTab === 'review'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <FileCheck2 className="w-3.5 h-3.5" />
          Review & Approvals
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('checklist')}
          className={`px-4 py-2 font-bold rounded-xl whitespace-nowrap transition flex items-center gap-1.5 ${
            activeTab === 'checklist'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          Incoming Checklist ({checklist.filter((i) => i.status === 'completed').length}/{checklist.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('versions')}
          className={`px-4 py-2 font-bold rounded-xl whitespace-nowrap transition flex items-center gap-1.5 ${
            activeTab === 'versions'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Version Audit Trail ({versions.length || 1})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('discussion')}
          className={`px-4 py-2 font-bold rounded-xl whitespace-nowrap transition flex items-center gap-1.5 ${
            activeTab === 'discussion'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Questions & Notes ({comments.length})
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: HANDOVER DOCUMENT (SECTIONS A THROUGH M) */}
      {/* ============================================================== */}
      {activeTab === 'document' && (
        <div className="space-y-6">
          {/* Header controls for Document editing */}
          <div className="flex items-center justify-between bg-stone-50 p-3 rounded-2xl border border-stone-200 text-xs">
            <span className="text-stone-500">
              13 Comprehensive Engineering Sections grounded in codebase static analysis.
            </span>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Summary of changes..."
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  className="px-3 py-1.5 border border-stone-300 rounded-lg text-xs"
                />
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 font-semibold hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdits}
                  disabled={savingEdit}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold flex items-center gap-1 hover:bg-emerald-700"
                >
                  {savingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Save New Version
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 font-semibold flex items-center gap-1 shadow-2xl"
              >
                <Edit3 className="w-3.5 h-3.5 text-stone-500" />
                Edit Document
              </button>
            )}
          </div>

          {/* Section A: Project Overview */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-stone-100 pb-2.5">
              <span className="w-6 h-6 rounded-lg bg-amber-500 text-white font-black text-xs flex items-center justify-center">A</span>
              <h3 className="font-bold text-stone-900 text-sm">Project Overview</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 block">Summary & Purpose</span>
                <p className="mt-1 text-stone-700 leading-relaxed">{content.sectionA?.summary || 'No summary provided.'}</p>
                <p className="mt-2 text-stone-600 italic">{content.sectionA?.purpose}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 block">Tech Stack & Frameworks</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {(content.sectionA?.techStack || []).map((t: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-800 font-mono text-[11px]">
                      {t}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-stone-600">{content.sectionA?.repositoryOverview}</p>
              </div>
            </div>
          </div>

          {/* Section B: Technical Architecture */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-stone-100 pb-2.5">
              <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center">B</span>
              <h3 className="font-bold text-stone-900 text-sm">Technical Architecture & Data Flow</h3>
            </div>
            <p className="text-xs text-stone-700">{content.sectionB?.dataFlowDescription}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {(content.sectionB?.coreComponents || []).map((comp: any, idx: number) => (
                <div key={idx} className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                  <span className="font-bold text-stone-900 block">{comp.name}</span>
                  <span className="text-stone-500 font-mono text-[10px] block mb-1">{comp.location}</span>
                  <p className="text-stone-600">{comp.purpose}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Section C: Implemented Functionalities */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-stone-100 pb-2.5">
              <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center justify-center">C</span>
              <h3 className="font-bold text-stone-900 text-sm">Implemented Functionalities</h3>
            </div>
            <div className="space-y-2">
              {(content.sectionC?.functionalities || []).map((fn: any, idx: number) => (
                <div key={idx} className="p-3 rounded-xl border border-stone-100 bg-stone-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900">{fn.title}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-semibold">
                        {fn.status}
                      </span>
                    </div>
                    <p className="text-stone-600 mt-0.5">{fn.description}</p>
                  </div>
                  {fn.filesInvolved && fn.filesInvolved.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {fn.filesInvolved.map((f: string, fi: number) => (
                        <span key={fi} className="px-1.5 py-0.5 bg-white border border-stone-200 rounded font-mono text-[10px] text-stone-600">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section D: Important Technical Decisions */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-stone-100 pb-2.5">
              <span className="w-6 h-6 rounded-lg bg-purple-600 text-white font-black text-xs flex items-center justify-center">D</span>
              <h3 className="font-bold text-stone-900 text-sm">Important Technical Decisions</h3>
            </div>
            <div className="space-y-2.5">
              {(content.sectionD?.decisions || []).map((dec: any, idx: number) => (
                <div key={idx} className="p-3 rounded-xl border border-purple-100 bg-purple-50/20 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-900">{dec.topic}: {dec.decision}</span>
                    <span className="text-[10px] text-stone-500 font-mono">{dec.evidenceFile}</span>
                  </div>
                  <p className="text-stone-700"><span className="font-semibold">Rationale:</span> {dec.rationale}</p>
                  {dec.tradeOffs && (
                    <p className="text-stone-500 italic"><span className="font-semibold">Trade-offs:</span> {dec.tradeOffs}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section E: Current Project Status */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-stone-100 pb-2.5">
              <span className="w-6 h-6 rounded-lg bg-teal-600 text-white font-black text-xs flex items-center justify-center">E</span>
              <h3 className="font-bold text-stone-900 text-sm">Current Project Status & Health</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-bold text-stone-800">Health: <span className="text-emerald-600">{content.sectionE?.overallHealth}</span></p>
                <p className="text-stone-600 mt-1">{content.sectionE?.readinessSummary}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 block mb-1">Key Highlights</span>
                <ul className="list-disc list-inside space-y-1 text-stone-700">
                  {(content.sectionE?.keyHighlights || []).map((h: string, idx: number) => (
                    <li key={idx}>{h}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Section F & G: Completed vs Pending Work */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Section F */}
            <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b border-stone-100 pb-2.5">
                <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center justify-center">F</span>
                <h3 className="font-bold text-stone-900 text-sm">Completed Work</h3>
              </div>
              <div className="space-y-2 text-xs">
                {(content.sectionF?.completedWork || []).map((w: any, idx: number) => (
                  <div key={idx} className="p-2.5 bg-emerald-50/40 rounded-xl border border-emerald-100">
                    <span className="font-bold text-emerald-950 block">{w.item}</span>
                    <p className="text-stone-600 mt-0.5">{w.description}</p>
                    <span className="text-[10px] text-emerald-700 block mt-1 font-medium">Impact: {w.impact}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Section G */}
            <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b border-stone-100 pb-2.5">
                <span className="w-6 h-6 rounded-lg bg-rose-600 text-white font-black text-xs flex items-center justify-center">G</span>
                <h3 className="font-bold text-stone-900 text-sm">Incomplete & Pending Work</h3>
              </div>
              <div className="space-y-2 text-xs">
                {(content.sectionG?.pendingWork || []).map((p: any, idx: number) => (
                  <div key={idx} className="p-2.5 bg-rose-50/40 rounded-xl border border-rose-100">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rose-950">{p.title}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-200 text-rose-800 font-bold uppercase">
                        {p.priority}
                      </span>
                    </div>
                    <p className="text-stone-600 mt-0.5">{p.description}</p>
                    {p.location && (
                      <span className="font-mono text-[10px] text-stone-500 block mt-1">{p.location}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section H: Ownership */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-stone-100 pb-2.5">
              <span className="w-6 h-6 rounded-lg bg-amber-600 text-white font-black text-xs flex items-center justify-center">H</span>
              <h3 className="font-bold text-stone-900 text-sm">Responsibilities & Ownership Transfer</h3>
            </div>
            <div className="space-y-2 text-xs">
              {(content.sectionH?.ownershipBreakdown || []).map((o: any, idx: number) => (
                <div key={idx} className="p-3 bg-stone-50 rounded-xl border border-stone-200 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <span className="font-bold text-stone-900">{o.area}</span>
                  </div>
                  <div className="text-stone-600">
                    <span className="text-[10px] uppercase font-bold text-stone-400 block">Transition</span>
                    {o.currentOwner} → <span className="font-semibold text-stone-900">{o.suggestedIncomingOwner}</span>
                  </div>
                  <div className="text-stone-600">
                    <span className="text-[10px] uppercase font-bold text-stone-400 block">Handover Notes</span>
                    {o.handoverNotes}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section I & J: Dependencies vs Risks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Section I */}
            <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b border-stone-100 pb-2.5">
                <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center">I</span>
                <h3 className="font-bold text-stone-900 text-sm">Dependencies & Integrations</h3>
              </div>
              <div className="space-y-2 text-xs">
                {(content.sectionI?.dependencies || []).map((d: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-stone-50 border border-stone-100">
                    <div>
                      <span className="font-bold text-stone-950 font-mono">{d.name}</span>
                      <span className="text-stone-500 block text-[11px]">{d.purpose}</span>
                    </div>
                    {d.version && <span className="font-mono text-[10px] text-stone-500">{d.version}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Section J */}
            <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b border-stone-100 pb-2.5">
                <span className="w-6 h-6 rounded-lg bg-orange-600 text-white font-black text-xs flex items-center justify-center">J</span>
                <h3 className="font-bold text-stone-900 text-sm">Known Risks & Blockers</h3>
              </div>
              <div className="space-y-2 text-xs">
                {(content.sectionJ?.risksAndBlockers || []).map((r: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-xl border border-orange-100 bg-orange-50/40">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-orange-950">{r.risk}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-orange-200 text-orange-900 font-bold uppercase">
                        {r.severity}
                      </span>
                    </div>
                    <p className="text-stone-600 mt-1"><span className="font-semibold">Mitigation:</span> {r.mitigationStrategy}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section K: Unresolved Questions */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-stone-100 pb-2.5">
              <span className="w-6 h-6 rounded-lg bg-rose-500 text-white font-black text-xs flex items-center justify-center">K</span>
              <h3 className="font-bold text-stone-900 text-sm">Unresolved Questions</h3>
            </div>
            <div className="space-y-2 text-xs">
              {(content.sectionK?.unresolvedQuestions || []).map((q: any, idx: number) => (
                <div key={idx} className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <span className="font-bold text-stone-900 block">{q.question}</span>
                  <p className="text-stone-600 mt-1">{q.context}</p>
                  <p className="text-amber-700 text-[11px] font-medium mt-1">Recommended Investigation: {q.recommendedInvestigation}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Section L: Recommended Next Actions */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-stone-100 pb-2.5">
              <span className="w-6 h-6 rounded-lg bg-emerald-700 text-white font-black text-xs flex items-center justify-center">L</span>
              <h3 className="font-bold text-stone-900 text-sm">Recommended Next Actions</h3>
            </div>
            <div className="space-y-2 text-xs">
              {(content.sectionL?.recommendedNextActions || []).map((a: any, idx: number) => (
                <div key={idx} className="p-3 rounded-xl border border-stone-200 bg-stone-50 flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0">
                    {a.stepNumber || idx + 1}
                  </span>
                  <div className="flex-1">
                    <span className="font-bold text-stone-900">{a.title}</span>
                    <p className="text-stone-600 mt-0.5">{a.actionDescription}</p>
                    <span className="font-mono text-[10px] text-stone-500 block mt-1">{a.targetFileOrArea}</span>
                  </div>
                  {a.immediate && (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-red-100 text-red-800 font-bold uppercase shrink-0">
                      Immediate
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section M: Important Resources */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-stone-100 pb-2.5">
              <span className="w-6 h-6 rounded-lg bg-stone-800 text-white font-black text-xs flex items-center justify-center">M</span>
              <h3 className="font-bold text-stone-900 text-sm">Important Resources & References</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {(content.sectionM?.resources || []).map((r: any, idx: number) => (
                <div key={idx} className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <span className="font-bold text-stone-900 block">{r.title}</span>
                  <span className="font-mono text-[10px] text-amber-700 block mt-0.5">{r.linkOrPath}</span>
                  <p className="text-stone-600 mt-1">{r.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: EVIDENCE & SOURCE TRACEABILITY */}
      {/* ============================================================== */}
      {activeTab === 'evidence' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50 p-4 rounded-2xl border border-stone-200">
            <div>
              <h3 className="font-bold text-stone-900 text-sm">Grounded Codebase Evidence & Verification Claims</h3>
              <p className="text-xs text-stone-500">
                Every architectural statement is classified with a confidence score and verifiable source file reference.
              </p>
            </div>
            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              {['ALL', 'VERIFIED FACT', 'AI INFERENCE', 'CONFLICTING INFORMATION', 'UNKNOWN'].map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setClaimFilter(tier)}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                    claimFilter === tier
                      ? 'bg-amber-500 text-white'
                      : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>

          {/* Claims List */}
          <div className="space-y-3">
            {filteredClaims.length === 0 ? (
              <div className="p-12 text-center text-xs text-stone-500 bg-white rounded-2xl border border-stone-200">
                No claims match the selected confidence tier.
              </div>
            ) : (
              filteredClaims.map((claim) => (
                <div
                  key={claim.id}
                  className="p-4 bg-white rounded-2xl border border-stone-200 shadow-sm space-y-3 text-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getConfidenceBadge(claim.verification_status)}
                      <span className="font-mono text-[10px] text-stone-400">
                        Confidence: {(claim.confidence_score * 100).toFixed(0)}%
                      </span>
                      {claim.is_verified && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Human Verified
                        </span>
                      )}
                    </div>
                    {claim.file_path && (
                      <span className="font-mono text-[10px] text-stone-600 bg-stone-100 px-2 py-0.5 rounded">
                        {claim.file_path} {claim.line_reference ? `:${claim.line_reference}` : ''}
                      </span>
                    )}
                  </div>

                  <p className="font-semibold text-stone-900 text-sm">{claim.claim_text}</p>

                  {claim.supporting_excerpt && (
                    <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-100 font-mono text-[11px] text-stone-700">
                      <span className="text-[10px] uppercase font-bold text-stone-400 block mb-0.5">Supporting Evidence Excerpt</span>
                      {claim.supporting_excerpt}
                    </div>
                  )}

                  {/* Verification action controls */}
                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[11px] text-stone-500">
                      {claim.verified_by
                        ? `Verified by human reviewer at ${new Date(claim.verified_at || '').toLocaleDateString()}`
                        : 'Awaiting human verification'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleVerifyClaim(claim.id, 'VERIFIED FACT')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-[11px] transition"
                      >
                        Confirm as Verified Fact
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVerifyClaim(claim.id, 'AI INFERENCE')}
                        className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-[11px] transition"
                      >
                        Mark as Inference
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVerifyClaim(claim.id, 'CONFLICTING INFORMATION')}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold text-[11px] transition"
                      >
                        Flag Conflict
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: HUMAN REVIEW & APPROVALS */}
      {/* ============================================================== */}
      {activeTab === 'review' && (
        <div className="space-y-6">
          {/* Strict Human Review Policy Banner */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3 text-xs text-blue-900">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Human Engineering Review Guarantee</p>
              <p className="mt-0.5 leading-relaxed">
                Er.NEXA adheres to the strict protocol: <span className="font-bold">AI NEVER self-approves.</span> Handover reports must be formally reviewed and approved by designated human engineering leads or project owners before operational transition.
              </p>
            </div>
          </div>

          {/* Current Review Status Card */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-stone-900 text-sm">Current Review & Approval Status</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-stone-50 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-stone-400 block">Current Status</span>
                <div className="mt-1">{getStatusBadge(handover.status)}</div>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-stone-400 block">Approved By</span>
                <span className="font-semibold text-stone-800 mt-1 block">
                  {handover.approved_by ? 'Human Engineering Lead' : 'Pending Formal Approval'}
                </span>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-stone-400 block">Approval Timestamp</span>
                <span className="text-stone-600 mt-1 block">
                  {handover.approved_at ? new Date(handover.approved_at).toLocaleString() : 'Not Yet Approved'}
                </span>
              </div>
            </div>

            {/* Review Decision Form */}
            <form onSubmit={handleReviewDecision} className="pt-4 border-t border-stone-100 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-stone-800 mb-2">Reviewer Decision</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl">
                    <input
                      type="radio"
                      name="decision"
                      checked={reviewDecision === 'APPROVED'}
                      onChange={() => setReviewDecision('APPROVED')}
                    />
                    <span>Approve Handover</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-rose-800 bg-rose-50 border border-rose-200 px-4 py-2 rounded-xl">
                    <input
                      type="radio"
                      name="decision"
                      checked={reviewDecision === 'REVISION_REQUIRED'}
                      onChange={() => setReviewDecision('REVISION_REQUIRED')}
                    />
                    <span>Request Revisions</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-800 mb-1.5">Reviewer Notes & Verification Feedback</label>
                <textarea
                  rows={4}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Enter detailed feedback on architectural claims, missing documentation, or approval sign-off rationale..."
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition resize-none text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={submittingReview}
                className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-black text-white font-bold shadow-md transition flex items-center gap-2 disabled:opacity-50"
              >
                {submittingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Submit Formal Review Decision
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: INCOMING MEMBER CONTINUATION CHECKLIST */}
      {/* ============================================================== */}
      {activeTab === 'checklist' && (
        <div className="space-y-6">
          {/* Checklist header */}
          <div className="bg-emerald-50/80 border border-emerald-200 p-4 rounded-2xl text-xs text-emerald-900 flex items-start gap-3">
            <CheckSquare className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-sm">Incoming Engineer Continuation Checklist</h3>
              <p className="mt-0.5 leading-relaxed">
                Step-by-step onboarding verification derived directly from recommended next actions, pending tasks, and architecture configurations. Mark tasks as understood and completed as you review the repository.
              </p>
            </div>
          </div>

          {/* Checklist items */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-3">
            <h4 className="font-bold text-stone-900 text-xs">Onboarding Verification Tasks</h4>
            <div className="space-y-2.5">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleToggleChecklistItem(item.id)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start gap-3 text-xs ${
                    item.status === 'completed'
                      ? 'bg-emerald-50/50 border-emerald-200 text-stone-600'
                      : 'bg-stone-50 border-stone-200 hover:bg-stone-100/60 text-stone-900'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.status === 'completed'}
                    onChange={() => {}} // handled by parent div
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex-1">
                    <span className={`font-bold ${item.status === 'completed' ? 'line-through text-stone-400' : 'text-stone-900'}`}>
                      {item.title}
                    </span>
                    <p className="text-stone-600 mt-0.5">{item.description}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    item.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'
                  }`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Acknowledgement Sign-off Box */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
              <FileCheck2 className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-stone-900 text-sm">Formal Handover Acknowledgement</h3>
            </div>

            {handover.status === 'ACKNOWLEDGED' || acknowledgement ? (
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Handover Successfully Acknowledged
                </div>
                <p>
                  Incoming engineer digitally confirmed receipt on {new Date(handover.acknowledged_at || acknowledgement?.created_at || '').toLocaleString()}.
                </p>
                {acknowledgement?.comments && (
                  <p className="italic text-emerald-800"><span className="font-semibold">Incoming notes:</span> {acknowledgement.comments}</p>
                )}
              </div>
            ) : (
              <form onSubmit={handleAcknowledge} className="space-y-4 text-xs">
                <label className="flex items-start gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ackConfirmed}
                    onChange={(e) => setAckConfirmed(e.target.checked)}
                    required
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-medium text-stone-800 leading-relaxed">
                    I formally confirm that I have reviewed the architectural documentation, understand the key technical decisions, verified the codebase structure, and assume responsibility for project continuation.
                  </span>
                </label>

                <div>
                  <label className="block font-bold text-stone-800 mb-1.5">
                    Questions or Clarifications for Outgoing Engineer (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={ackComments}
                    onChange={(e) => setAckComments(e.target.value)}
                    placeholder="List any remaining questions or points requiring follow-up sync..."
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition resize-none text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1.5">
                    Report Missing or Contradictory Information (Optional)
                  </label>
                  <input
                    type="text"
                    value={ackMissingInfo}
                    onChange={(e) => setAckMissingInfo(e.target.value)}
                    placeholder="e.g. Missing credentials for third-party webhook staging..."
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!ackConfirmed || submittingAck}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-600/20 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {submittingAck ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck2 className="w-4 h-4" />}
                  Confirm & Acknowledge Handover
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 5: VERSION HISTORY & AUDIT TRAIL */}
      {/* ============================================================== */}
      {activeTab === 'versions' && (
        <div className="space-y-4">
          <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 text-xs">
            <h3 className="font-bold text-stone-900 text-sm">Handover Version Snapshots & Audit Trail</h3>
            <p className="text-stone-500 mt-0.5">
              Every document edit and status update is permanently versioned with timestamp, author, and change summary.
            </p>
          </div>

          <div className="space-y-3">
            {versions.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-500 bg-white rounded-2xl border border-stone-200">
                Version 1 initialized at handover creation.
              </div>
            ) : (
              versions.map((ver) => (
                <div
                  key={ver.id}
                  className="p-4 bg-white rounded-2xl border border-stone-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 font-bold flex items-center justify-center border border-amber-200">
                      v{ver.version_number}
                    </div>
                    <div>
                      <span className="font-bold text-stone-900 text-sm">
                        {ver.change_summary || `Version ${ver.version_number} Snapshot`}
                      </span>
                      <p className="text-stone-500 text-[11px] mt-0.5">
                        Recorded on {new Date(ver.created_at).toLocaleString()} • Status: <span className="font-semibold">{ver.status_at_version}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 font-medium text-[11px]">
                      Snapshot Preserved
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 6: QUESTIONS & DISCUSSION */}
      {/* ============================================================== */}
      {activeTab === 'discussion' && (
        <div className="space-y-4">
          <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 text-xs">
            <h3 className="font-bold text-stone-900 text-sm">Clarification Thread & Collaborative Notes</h3>
            <p className="text-stone-500 mt-0.5">
              Discuss architectural decisions, clarify obscure modules, and ask the outgoing engineer direct questions.
            </p>
          </div>

          {/* Comment input */}
          <form onSubmit={handleAddComment} className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-bold text-stone-700">Note Type:</span>
              <select
                value={commentType}
                onChange={(e) => setCommentType(e.target.value as any)}
                className="px-2.5 py-1 bg-stone-50 border border-stone-200 rounded-lg text-xs"
              >
                <option value="general">General Note</option>
                <option value="clarification_request">Clarification Request</option>
                <option value="review_note">Review Note</option>
              </select>
            </div>
            <textarea
              rows={3}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Ask a question about a function, report a discrepancy, or add clarification notes..."
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition resize-none text-xs"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={postingComment || !newComment.trim()}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
              >
                {postingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Post Message
              </button>
            </div>
          </form>

          {/* Comments List */}
          <div className="space-y-3">
            {comments.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-500 bg-white rounded-2xl border border-stone-200">
                No clarification messages yet. Start the conversation above!
              </div>
            ) : (
              comments.map((cm) => (
                <div key={cm.id} className="p-4 bg-white rounded-2xl border border-stone-200 shadow-sm space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img
                        src={cm.authorProfile?.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${cm.author_id}`}
                        className="w-5 h-5 rounded-full"
                      />
                      <span className="font-bold text-stone-900">{cm.authorProfile?.display_name || 'Team Member'}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-stone-100 text-stone-600 uppercase font-semibold">
                        {cm.comment_type}
                      </span>
                    </div>
                    <span className="text-[10px] text-stone-400">
                      {new Date(cm.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-stone-700 leading-relaxed pl-7">{cm.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
