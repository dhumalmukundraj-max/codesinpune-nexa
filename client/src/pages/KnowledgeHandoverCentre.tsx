import React, { useState, useEffect } from 'react';
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
  FolderKanban
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
  const [handovers, setHandovers] = useState<ProjectHandoverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Selected Handover for Detail View
  const [selectedHandoverId, setSelectedHandoverId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<{
    handover: ProjectHandoverItem;
    claims: HandoverClaim[];
    versions: HandoverVersion[];
    comments: HandoverComment[];
    acknowledgement?: HandoverAcknowledgement | null;
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState<HandoverNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Load handovers
  const loadHandovers = async () => {
    try {
      setLoading(true);
      const res = await fetchHandovers();
      setHandovers(res.handovers || []);
    } catch (err) {
      console.warn('Failed to load handovers:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load notifications
  const loadNotifications = async () => {
    try {
      const res = await fetchHandoverNotifications();
      setNotifications(res.notifications || []);
    } catch {}
  };

  useEffect(() => {
    loadHandovers();
    loadNotifications();

    // Supabase Realtime subscription for real-time notifications & updates
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
              setNotifications((prev) => [payload.new as any, ...prev]);
            }
          }
        )
        .subscribe();

      return () => {
        sb.removeChannel(channel);
      };
    }
  }, [user]);

  // Load single handover detail
  const handleSelectHandover = async (id: string) => {
    try {
      setSelectedHandoverId(id);
      setLoadingDetail(true);
      const res = await fetchHandoverDetail(id);
      if (res.handover) {
        setDetailData({
          handover: res.handover,
          claims: res.claims || [],
          versions: res.versions || [],
          comments: res.comments || [],
          acknowledgement: res.acknowledgement || null,
        });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to open handover report');
      setSelectedHandoverId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleRefreshDetail = () => {
    if (selectedHandoverId) {
      handleSelectHandover(selectedHandoverId);
    }
    loadHandovers();
  };

  // Mark notification read
  const handleMarkNotifRead = async (notifId: string) => {
    try {
      await markHandoverNotificationRead(notifId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
      );
    } catch {}
  };

  const unreadNotifsCount = notifications.filter((n) => !n.is_read).length;

  // Filter handovers
  const filteredHandovers = handovers.filter((h) => {
    const matchesSearch =
      h.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.projectName && h.projectName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (h.description && h.description.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterTab === 'under_review') return h.status === 'UNDER_REVIEW';
    if (filterTab === 'shared') return h.status === 'SHARED' || h.incoming_member_id === user?.id;
    if (filterTab === 'acknowledged') return h.status === 'ACKNOWLEDGED';
    return true;
  });

  // Render detail view if a handover is selected
  if (selectedHandoverId && detailData) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <HandoverDetailView
          handover={detailData.handover}
          claims={detailData.claims}
          versions={detailData.versions}
          comments={detailData.comments}
          acknowledgement={detailData.acknowledgement}
          currentUserId={user?.id}
          onBack={() => {
            setSelectedHandoverId(null);
            setDetailData(null);
          }}
          onRefresh={handleRefreshDetail}
        />
      </div>
    );
  }

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
        <div className="flex items-center gap-3">
          {/* Notifications button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 relative transition shadow-sm"
              title="Handover Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-bold text-[9px] shadow-sm">
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
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-stone-400">No notifications yet.</div>
                  ) : (
                    notifications.map((n) => (
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
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-2 transition active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Initiate Handover</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-stone-400 block mb-1">Total Handovers</span>
          <span className="text-2xl font-black text-stone-900">{handovers.length}</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-amber-500 block mb-1">Under Human Review</span>
          <span className="text-2xl font-black text-amber-600">
            {handovers.filter((h) => h.status === 'UNDER_REVIEW').length}
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-blue-500 block mb-1">Approved & Shared</span>
          <span className="text-2xl font-black text-blue-600">
            {handovers.filter((h) => h.status === 'APPROVED' || h.status === 'SHARED').length}
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-emerald-600 block mb-1">Acknowledged Continuity</span>
          <span className="text-2xl font-black text-emerald-600">
            {handovers.filter((h) => h.status === 'ACKNOWLEDGED').length}
          </span>
        </div>
      </div>

      {/* Main Section */}
      <div className="bg-white rounded-3xl border border-stone-200 p-4 sm:p-6 shadow-sm space-y-5">
        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap ${
                filterTab === 'all'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
              }`}
            >
              All Handovers ({handovers.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('under_review')}
              className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap ${
                filterTab === 'under_review'
                  ? 'bg-amber-500 text-white'
                  : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
              }`}
            >
              Needs Review ({handovers.filter((h) => h.status === 'UNDER_REVIEW').length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('shared')}
              className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap ${
                filterTab === 'shared'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
              }`}
            >
              Shared / Incoming ({handovers.filter((h) => h.status === 'SHARED' || h.incoming_member_id === user?.id).length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('acknowledged')}
              className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap ${
                filterTab === 'acknowledged'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
              }`}
            >
              Completed ({handovers.filter((h) => h.status === 'ACKNOWLEDGED').length})
            </button>
          </div>

          {/* Search bar */}
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

        {/* Handover Cards Grid */}
        {loading ? (
          <div className="py-16 text-center text-xs text-stone-500 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
            <span>Loading Knowledge Handover Centre...</span>
          </div>
        ) : filteredHandovers.length === 0 ? (
          <div className="py-16 text-center text-xs text-stone-500 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-stone-800 text-sm">No handovers found</p>
              <p className="text-stone-500 max-w-sm mx-auto mt-0.5">
                Initiate a knowledge handover to systematically capture architectural decisions and onboarding tasks before engineers transition.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-sm transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create First Handover</span>
            </button>
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

                {/* Footer metadata */}
                <div className="pt-3 border-t border-stone-100 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1.5">
                      <img
                        src={h.outgoingProfile?.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${h.outgoing_member_id || 'out'}`}
                        alt="outgoing"
                        title="Outgoing"
                        className="w-5 h-5 rounded-full border border-white"
                      />
                      <img
                        src={h.incomingProfile?.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${h.incoming_member_id || 'in'}`}
                        alt="incoming"
                        title="Incoming"
                        className="w-5 h-5 rounded-full border border-white"
                      />
                    </div>
                    <span className="text-[11px] text-stone-500 font-medium">v{h.current_version}</span>
                  </div>

                  <span className="text-[11px] text-amber-600 font-bold group-hover:translate-x-0.5 transition flex items-center gap-1">
                    Inspect Report <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Handover Modal */}
      <CreateHandoverModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(newHandover) => {
          setHandovers((prev) => [newHandover, ...prev]);
          handleSelectHandover(newHandover.id);
        }}
        currentUserId={user?.id}
      />
    </div>
  );
};
