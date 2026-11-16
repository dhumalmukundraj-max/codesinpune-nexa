import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  FolderKanban, 
  UserCheck, 
  Calendar, 
  Target, 
  FileText, 
  ShieldAlert, 
  Loader2,
  CheckCircle2,
  Search
} from 'lucide-react';
import { fetchProjects, searchProfiles, createHandover } from '../../lib/api';
import { ProjectItem, UserProfile, ProjectHandoverItem } from '../../types';

interface CreateHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (handover: ProjectHandoverItem) => void;
  currentUserId?: string;
}

export const CreateHandoverModal: React.FC<CreateHandoverModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  currentUserId,
}) => {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [notes, setNotes] = useState('');
  const [focusAreas, setFocusAreas] = useState('');

  // User search states
  const [outgoingQuery, setOutgoingQuery] = useState('');
  const [outgoingResults, setOutgoingResults] = useState<UserProfile[]>([]);
  const [selectedOutgoing, setSelectedOutgoing] = useState<UserProfile | null>(null);

  const [incomingQuery, setIncomingQuery] = useState('');
  const [incomingResults, setIncomingResults] = useState<UserProfile[]>([]);
  const [selectedIncoming, setSelectedIncoming] = useState<UserProfile | null>(null);

  const [reviewerQuery, setReviewerQuery] = useState('');
  const [reviewerResults, setReviewerResults] = useState<UserProfile[]>([]);
  const [selectedReviewer, setSelectedReviewer] = useState<UserProfile | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingProjects(true);
    fetchProjects()
      .then((data) => {
        const list = data.projects || [];
        setProjects(list);
        if (list.length > 0 && !selectedProjectId) {
          setSelectedProjectId(list[0].id);
          setTitle(`${list[0].name} — Operational Knowledge Handover`);
        }
      })
      .catch((err) => console.warn('Failed to load projects for handover:', err))
      .finally(() => setLoadingProjects(false));
  }, [isOpen]);

  // Outgoing user search debounce
  useEffect(() => {
    if (!outgoingQuery.trim() || outgoingQuery.length < 2) {
      setOutgoingResults([]);
      return;
    }
    const timer = setTimeout(() => {
      searchProfiles(outgoingQuery)
        .then((data) => setOutgoingResults(data.profiles || []))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [outgoingQuery]);

  // Incoming user search debounce
  useEffect(() => {
    if (!incomingQuery.trim() || incomingQuery.length < 2) {
      setIncomingResults([]);
      return;
    }
    const timer = setTimeout(() => {
      searchProfiles(incomingQuery)
        .then((data) => setIncomingResults(data.profiles || []))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [incomingQuery]);

  // Reviewer user search debounce
  useEffect(() => {
    if (!reviewerQuery.trim() || reviewerQuery.length < 2) {
      setReviewerResults([]);
      return;
    }
    const timer = setTimeout(() => {
      searchProfiles(reviewerQuery)
        .then((data) => setReviewerResults(data.profiles || []))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [reviewerQuery]);

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    const proj = projects.find((p) => p.id === projectId);
    if (proj) {
      setTitle(`${proj.name} — Operational Knowledge Handover`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      setError('Please select an active project.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setGenerationStep('Analyzing codebase & existing architecture...');

      const stepTimer1 = setTimeout(() => {
        setGenerationStep('Synthesizing 13 Handover Sections (A through M)...');
      }, 1800);

      const stepTimer2 = setTimeout(() => {
        setGenerationStep('Extracting traceable evidence claims & onboarding checklist...');
      }, 3600);

      const res = await createHandover({
        project_id: selectedProjectId,
        title: title.trim() || 'Project Knowledge Handover',
        description: description.trim(),
        outgoing_member_id: selectedOutgoing?.id,
        incoming_member_id: selectedIncoming?.id,
        reviewer_id: selectedReviewer?.id,
        target_date: targetDate || undefined,
        notes: notes.trim(),
        focus_areas: focusAreas.trim(),
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      if (res.handover) {
        onCreated(res.handover);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to synthesize knowledge handover.');
    } finally {
      setSubmitting(false);
      setGenerationStep('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900 tracking-tight">
                Initiate Knowledge Handover
              </h2>
              <p className="text-xs text-stone-500">
                Ground-truth technical handover report grounded in actual codebase analysis.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-red-700">
              <ShieldAlert className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Project Selection */}
          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1.5 flex items-center gap-1.5">
              <FolderKanban className="w-4 h-4 text-stone-500" />
              Select Target Project <span className="text-red-500">*</span>
            </label>
            {loadingProjects ? (
              <div className="p-3 bg-stone-50 rounded-xl text-stone-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading your projects...
              </div>
            ) : projects.length === 0 ? (
              <div className="p-3 bg-amber-50 rounded-xl text-amber-800 border border-amber-200">
                No analyzed projects found. Please analyze a project first in the New Analysis tab.
              </div>
            ) : (
              <select
                value={selectedProjectId}
                onChange={(e) => handleProjectChange(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 2. Handover Title */}
          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-stone-500" />
              Handover Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Core API & Infrastructure Handover"
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
            />
          </div>

          {/* 3. Member Roles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Outgoing Member */}
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-stone-500" />
                Outgoing Member
              </label>
              {selectedOutgoing ? (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img
                      src={selectedOutgoing.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${selectedOutgoing.id}`}
                      alt="avatar"
                      className="w-6 h-6 rounded-full"
                    />
                    <span className="font-semibold text-stone-900">
                      {selectedOutgoing.display_name || selectedOutgoing.full_name || selectedOutgoing.email}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedOutgoing(null)}
                    className="text-stone-400 hover:text-stone-600 text-xs underline"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-stone-400" />
                    <input
                      type="text"
                      placeholder="Search registered user..."
                      value={outgoingQuery}
                      onChange={(e) => setOutgoingQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  {outgoingResults.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg max-h-36 overflow-y-auto">
                      {outgoingResults.map((u) => (
                        <div
                          key={u.id}
                          onClick={() => {
                            setSelectedOutgoing(u);
                            setOutgoingQuery('');
                            setOutgoingResults([]);
                          }}
                          className="px-3 py-2 hover:bg-stone-50 cursor-pointer flex items-center gap-2 border-b border-stone-100 last:border-0"
                        >
                          <img
                            src={u.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${u.id}`}
                            className="w-5 h-5 rounded-full"
                          />
                          <span className="font-medium text-stone-800">{u.display_name || u.email}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Incoming Member */}
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                Incoming Member
              </label>
              {selectedIncoming ? (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img
                      src={selectedIncoming.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${selectedIncoming.id}`}
                      alt="avatar"
                      className="w-6 h-6 rounded-full"
                    />
                    <span className="font-semibold text-stone-900">
                      {selectedIncoming.display_name || selectedIncoming.full_name || selectedIncoming.email}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedIncoming(null)}
                    className="text-stone-400 hover:text-stone-600 text-xs underline"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-stone-400" />
                    <input
                      type="text"
                      placeholder="Search registered user..."
                      value={incomingQuery}
                      onChange={(e) => setIncomingQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  {incomingResults.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg max-h-36 overflow-y-auto">
                      {incomingResults.map((u) => (
                        <div
                          key={u.id}
                          onClick={() => {
                            setSelectedIncoming(u);
                            setIncomingQuery('');
                            setIncomingResults([]);
                          }}
                          className="px-3 py-2 hover:bg-stone-50 cursor-pointer flex items-center gap-2 border-b border-stone-100 last:border-0"
                        >
                          <img
                            src={u.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${u.id}`}
                            className="w-5 h-5 rounded-full"
                          />
                          <span className="font-medium text-stone-800">{u.display_name || u.email}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 4. Target Date & Scope */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-stone-500" />
                Target Handover Date
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-stone-500" />
                Specific Focus Areas
              </label>
              <input
                type="text"
                value={focusAreas}
                onChange={(e) => setFocusAreas(e.target.value)}
                placeholder="e.g. Auth pipelines, Realtime Supabase, DB schemas"
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
              />
            </div>
          </div>

          {/* 5. Handover Notes & Priorities */}
          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-stone-500" />
              Special Handover Notes & Priorities
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Outline specific institutional knowledge, unwritten conventions, or critical upcoming deployment blockers..."
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition resize-none"
            />
          </div>

          {/* Processing Status Display */}
          {submitting && (
            <div className="p-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl flex items-center gap-3 animate-pulse">
              <Loader2 className="w-5 h-5 text-amber-600 animate-spin shrink-0" />
              <div>
                <p className="font-bold text-amber-900">{generationStep || 'Processing...'}</p>
                <p className="text-[11px] text-amber-700">
                  Grounded in actual project files, architecture diagrams, and task breakdowns.
                </p>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-semibold hover:bg-stone-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedProjectId}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-md shadow-amber-500/20 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Synthesize Knowledge Handover</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
