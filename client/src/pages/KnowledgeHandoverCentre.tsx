import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  PlusCircle, 
  Layers, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Share2, 
  FileCheck2, 
  Bell, 
  Search, 
  Filter, 
  User, 
  Sparkles,
  ArrowRight,
  BookOpen,
  Calendar,
  Loader2,
  FolderKanban,
  RefreshCw,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  fetchHandovers, 
  fetchHandoverDetail, 
  fetchHandoverNotifications, 
  markHandoverNotificationRead 
} from '../lib/api';
import { 
  ProjectHandoverItem, 
  HandoverClaim, 
  HandoverVersion, 
  HandoverComment, 
  HandoverAcknowledgement,
  HandoverNotification 
} from '../types';
import { CreateHandoverModal } from '../components/handover/CreateHandoverModal';
import { HandoverDetailView } from '../components/handover/HandoverDetailView';
import { supabase } from '../lib/supabase';

type FilterTab = 'all' | 'under_review' | 'shared' | 'acknowledged';

export const KnowledgeHandoverCentre: React.FC = () => {
  const { user } = useAuth();
  const { id: routeHandoverId } = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryHandoverId = searchParams.get('id');
  const targetId = routeHandoverId || queryHandoverId || null;

  const [handovers, setHandovers] = useState<ProjectHandoverItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'detail' | 'list'>('detail');

  // Selected Handover for Detail View
  const [selectedHandoverId, setSelectedHandoverId] = useState<string | null>(targetId);
  const [detailData, setDetailData] = useState<{
    handover: ProjectHandoverItem;
    claims: HandoverClaim[];
    versions: HandoverVersion[];
    comments: HandoverComment[];
    acknowledgement?: HandoverAcknowledgement | null;
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Notifications
  const [notifications, setNotifications] = useState<HandoverNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Load single handover detail
  const loadHandoverDetail = useCallback(async (id: string) => {
    try {
      setLoadingDetail(true);
      setError(null);
      const res = await fetchHandoverDetail(id);
      if (res && res.handover) {
        setDetailData({
          handover: res.handover,
          claims: Array.isArray(res.claims) ? res.claims : [],
          versions: Array.isArray(res.versions) ? res.versions : [],
          comments: Array.isArray(res.comments) ? res.comments : [],
          acknowledgement: res.acknowledgement || null,
        });
        setSelectedHandoverId(id);
        setViewMode('detail');
      }
    } catch (err: any) {
      console.warn('[HandoverCentre] Failed to load detail:', err);
      setError(err.message || 'Failed to open handover report');
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  // Load all handovers
  const loadHandovers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchHandovers();
      const list = Array.isArray(res?.handovers) ? res.handovers : [];
      setHandovers(list);

      // If a target ID is specified in URL, load it
      if (targetId) {
        await loadHandoverDetail(targetId);
      } else if (list.length > 0 && !selectedHandoverId) {
        // Automatically load the latest/active handover so the report is immediately visible
        const first = list[0];
        setSelectedHandoverId(first.id);
        await loadHandoverDetail(first.id);
      }
    } catch (err: any) {
      console.warn('[HandoverCentre] Load handovers notice:', err);
      setError('Unable to load handovers from server. Local cache is active.');
    } finally {
      setLoading(false);
    }
  }, [targetId, selectedHandoverId, loadHandoverDetail]);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetchHandoverNotifications();
      if (Array.isArray(res?.notifications)) {
        setNotifications(res.notifications);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadHandovers();
    loadNotifications();

    // Supabase Realtime subscription for real-time updates
    const sb = supabase;
    if (sb) {
      const channel = sb
        .channel('public:knowledge_handover_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'project_handovers' },
          () => {
            loadHandovers();
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'handover_notifications' },
          (payload) => {
            if (payload.new && (payload.new as any).recipient_id === user?.id) {
              setNotifications((prev) => [payload.new as any, ...(Array.isArray(prev) ? prev : [])]);
            }
          }
        )
        .subscribe();

      return () => {
        sb.removeChannel(channel);
      };
    }
  }, [user, loadHandovers, loadNotifications]);

  // Handle URL change
  useEffect(() => {
    if (targetId && targetId !== selectedHandoverId) {
      loadHandoverDetail(targetId);
    }
  }, [targetId, selectedHandoverId, loadHandoverDetail]);

  const handleSelectHandover = (id: string) => {
    setSelectedHandoverId(id);
    loadHandoverDetail(id);
    setSearchParams({ id });
  };

  const handleRefreshDetail = () => {
    if (selectedHandoverId) {
      loadHandoverDetail(selectedHandoverId);
    }
    loadHandovers();
  };

  const handleMarkNotifRead = async (notifId: string) => {
    try {
      await markHandoverNotificationRead(notifId);
      setNotifications((prev) =>
        (Array.isArray(prev) ? prev : []).map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
      );
    } catch {}
  };

  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const safeHandovers = Array.isArray(handovers) ? handovers : [];
  const unreadNotifsCount = safeNotifications.filter((n) => !n.is_read).length;

  // Filter handovers
  const filteredHandovers = safeHandovers.filter((h) => {
    const title = (h.title || '').toLowerCase();
    const projName = (h.projectName || '').toLowerCase();
    const desc = (h.description || '').toLowerCase();
    const q = searchQuery.toLowerCase();

    const matchesSearch = title.includes(q) || projName.includes(q) || desc.includes(q);
    if (!matchesSearch) return false;

    if (filterTab === 'under_review') return h.status === 'UNDER_REVIEW';
    if (filterTab === 'shared') return h.status === 'SHARED' || h.incoming_member_id === user?.id;
    if (filterTab === 'acknowledged') return h.status === 'ACKNOWLEDGED';
    return true;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-fadeIn pb-16">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
              Knowledge Handover Centre
            </h1>
          </div>
          <p className="text-xs text-stone-500 mt-1 max-w-2xl leading-relaxed">
            Prevent Critical Knowledge From Leaving With People. Grounded engineering handover reports, traceable evidence verification, and human sign-off workflows.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* View mode toggle if handovers exist */}
          {safeHandovers.length > 0 && (
            <div className="flex items-center bg-stone-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('detail')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  viewMode === 'detail' ? 'bg-white shadow-xs text-stone-900 font-bold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Report View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  viewMode === 'list' ? 'bg-white shadow-xs text-stone-900 font-bold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                All Handovers ({safeHandovers.length})
              </button>
            </div>
          )}

          {/* Handover selector dropdown when in report view */}
          {viewMode === 'detail' && safeHandovers.length > 1 && (
            <select
              value={selectedHandoverId || ''}
              onChange={(e) => handleSelectHandover(e.target.value)}
              className="px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-800 shadow-xs focus:outline-none focus:border-amber-500"
            >
              {safeHandovers.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.projectName ? `${h.projectName}: ` : ''}{h.title}
                </option>
              ))}
            </select>
          )}

          {/* Notifications button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 relative transition shadow-xs"
              title="Handover Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-bold text-[9px] shadow-xs">
                  {unreadNotifsCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-stone-200 shadow-2xl z-30 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <span className="font-bold text-stone-900">Handover Notifications</span>
                  <span className="text-[10px] text-stone-400">{unreadNotifsCount} unread</span>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1.5">
                  {safeNotifications.length === 0 ? (
                    <div className="py-6 text-center text-stone-400">No notifications yet.</div>
                  ) : (
                    safeNotifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleMarkNotifRead(n.id)}
                        className={`p-2.5 rounded-xl border transition cursor-pointer ${
                          n.is_read ? 'bg-white border-stone-100 text-stone-600' : 'bg-amber-50/70 border-amber-200 text-amber-950 font-medium'
                        }`}
                      >
                        <span className="font-bold block text-xs">{n.title}</span>
                        <p className="text-[11px] text-stone-600 mt-0.5">{n.message}</p>
                        <span className="text-[9px] text-stone-400 mt-1 block">
                          {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* New Handover CTA */}
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Initiate Handover</span>
          </button>
        </div>
      </div>

      {/* Error Notice if any */}
      {error && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadHandovers}
            className="px-2.5 py-1 bg-amber-600 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 hover:bg-amber-700 transition"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="py-24 text-center text-xs text-stone-500 flex flex-col items-center justify-center gap-3 bg-white rounded-3xl border border-stone-200 shadow-sm">
          <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
          <span className="font-semibold text-stone-700">Loading Knowledge Handover Centre...</span>
          <p className="text-stone-400 text-[11px]">Connecting to project evidence and verified repositories...</p>
        </div>
      ) : safeHandovers.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-3xl border border-stone-200 p-8 sm:p-12 shadow-sm text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
            <BookOpen className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="font-bold text-stone-900 text-base">No Knowledge Handovers Found</h3>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              Ensure critical engineering context never leaves with people. Initiate an AI-grounded handover to synthesize architectural decisions, dependencies, pending work, and onboarding checklists directly from your project codebase.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md shadow-amber-500/20 transition active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Initiate First Project Handover</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'detail' && detailData ? (
        /* REPORT VIEW: Render the complete generated handover report */
        loadingDetail ? (
          <div className="py-24 text-center text-xs text-stone-500 flex flex-col items-center justify-center gap-2 bg-white rounded-3xl border border-stone-200">
            <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
            <span>Loading Handover Report...</span>
          </div>
        ) : (
          <HandoverDetailView
            handover={detailData.handover}
            claims={detailData.claims}
            versions={detailData.versions}
            comments={detailData.comments}
            acknowledgement={detailData.acknowledgement}
            currentUserId={user?.id}
            onBack={() => setViewMode('list')}
            onRefresh={handleRefreshDetail}
          />
        )
      ) : (
        /* LIST VIEW: Overview Cards & Table */
        <div className="space-y-6">
          {/* Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-stone-400 block mb-1">Total Handovers</span>
              <span className="text-2xl font-black text-stone-900">{safeHandovers.length}</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-amber-500 block mb-1">Under Human Review</span>
              <span className="text-2xl font-black text-amber-600">
                {safeHandovers.filter((h) => h.status === 'UNDER_REVIEW').length}
              </span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-blue-500 block mb-1">Approved & Shared</span>
              <span className="text-2xl font-black text-blue-600">
                {safeHandovers.filter((h) => h.status === 'APPROVED' || h.status === 'SHARED').length}
              </span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-emerald-600 block mb-1">Acknowledged Continuity</span>
              <span className="text-2xl font-black text-emerald-600">
                {safeHandovers.filter((h) => h.status === 'ACKNOWLEDGED').length}
              </span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-3xl border border-stone-200 p-4 sm:p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap ${
                    filterTab === 'all' ? 'bg-stone-900 text-white' : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  All Handovers ({safeHandovers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('under_review')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap ${
                    filterTab === 'under_review' ? 'bg-amber-500 text-white' : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  Needs Review ({safeHandovers.filter((h) => h.status === 'UNDER_REVIEW').length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('shared')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap ${
                    filterTab === 'shared' ? 'bg-indigo-600 text-white' : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  Shared ({safeHandovers.filter((h) => h.status === 'SHARED' || h.incoming_member_id === user?.id).length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('acknowledged')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap ${
                    filterTab === 'acknowledged' ? 'bg-emerald-600 text-white' : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  Completed ({safeHandovers.filter((h) => h.status === 'ACKNOWLEDGED').length})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search handovers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-500 w-full sm:w-56"
                />
              </div>
            </div>

            {/* Cards Grid */}
            {filteredHandovers.length === 0 ? (
              <div className="py-12 text-center text-xs text-stone-400">
                No handovers match the current filter or search query.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredHandovers.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => handleSelectHandover(h.id)}
                    className="p-5 rounded-2xl border border-stone-200 hover:border-amber-400/80 bg-white hover:shadow-md transition cursor-pointer flex flex-col justify-between space-y-4 group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-stone-100 text-stone-700 font-mono">
                          {h.projectName || 'Project'}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          {h.status}
                        </span>
                      </div>

                      <h3 className="font-bold text-stone-900 text-sm group-hover:text-amber-600 transition line-clamp-1">
                        {h.title}
                      </h3>

                      <p className="text-xs text-stone-500 mt-1 line-clamp-2 leading-relaxed">
                        {h.description || 'Comprehensive architectural handover report.'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-stone-100 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-stone-500 font-medium">v{h.current_version || 1}</span>
                      </div>

                      <span className="text-[11px] text-amber-600 font-bold group-hover:translate-x-0.5 transition flex items-center gap-1">
                        View Report <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Handover Modal */}
      <CreateHandoverModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(newHandover) => {
          setHandovers((prev) => [newHandover, ...(Array.isArray(prev) ? prev : [])]);
          handleSelectHandover(newHandover.id);
        }}
        currentUserId={user?.id}
      />
    </div>
  );
};
