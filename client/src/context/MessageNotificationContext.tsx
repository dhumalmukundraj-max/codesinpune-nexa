import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { fetchUnreadMessageCounts, markConversationAsRead as apiMarkAsRead } from '../lib/api';
import { MessageSquare, X, ArrowRight, Image as ImageIcon, FileText, Bell } from 'lucide-react';

export interface InAppMessageToast {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  title: string;
  content: string;
  message_type?: 'text' | 'image' | 'document' | 'mixed';
  created_at: string;
}

export interface MessageNotificationContextType {
  unreadTotalCount: number;
  unreadByConversation: Record<string, number>;
  activeToast: InAppMessageToast | null;
  markAsRead: (conversationId: string) => Promise<void>;
  refreshUnreadCounts: () => Promise<void>;
  dismissToast: () => void;
  activeOpenConversationId: string | null;
  setActiveOpenConversationId: (id: string | null) => void;
}

const MessageNotificationContext = createContext<MessageNotificationContextType>({
  unreadTotalCount: 0,
  unreadByConversation: {},
  activeToast: null,
  markAsRead: async () => {},
  refreshUnreadCounts: async () => {},
  dismissToast: () => {},
  activeOpenConversationId: null,
  setActiveOpenConversationId: () => {},
});

export const useMessageNotifications = () => useContext(MessageNotificationContext);

function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Gentle cheerful two-tone chime: 880Hz (A5) -> 1320Hz (E6)
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  } catch {
    // Autoplay or audio not allowed, silently pass
  }
}

export const MessageNotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [unreadTotalCount, setUnreadTotalCount] = useState<number>(0);
  const [unreadByConversation, setUnreadByConversation] = useState<Record<string, number>>({});
  const [activeToast, setActiveToast] = useState<InAppMessageToast | null>(null);
  const [activeOpenConversationId, setActiveOpenConversationId] = useState<string | null>(null);

  const toastTimerRef = useRef<any>(null);
  const activeOpenRef = useRef<string | null>(null);
  activeOpenRef.current = activeOpenConversationId;

  // Fetch unread message counts from Supabase / API
  const refreshUnreadCounts = useCallback(async () => {
    if (!user) {
      setUnreadTotalCount(0);
      setUnreadByConversation({});
      return;
    }

    try {
      const data = await fetchUnreadMessageCounts();
      setUnreadTotalCount(data.totalUnread || 0);
      setUnreadByConversation(data.byConversation || {});
    } catch (err) {
      console.warn('[Er.NEXA Notifications] Error fetching unread counts:', err);
    }
  }, [user]);

  // Load unread counts when user logs in or mounts
  useEffect(() => {
    refreshUnreadCounts();
  }, [refreshUnreadCounts]);

  // Periodic safety sync (every 10 seconds)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      refreshUnreadCounts();
    }, 10000);
    return () => clearInterval(interval);
  }, [user, refreshUnreadCounts]);

  // Mark conversation as read and clear unread counts permanently in Supabase
  const markAsRead = useCallback(async (conversationId: string) => {
    if (!conversationId) return;

    // Immediately update local badge state
    setUnreadByConversation((prev) => {
      const copy = { ...prev };
      const count = copy[conversationId] || 0;
      delete copy[conversationId];
      setUnreadTotalCount((total) => Math.max(0, total - count));
      return copy;
    });

    // Dismiss active toast if it belongs to this conversation
    setActiveToast((current) => (current?.conversation_id === conversationId ? null : current));

    // Persist to Supabase Database
    try {
      await apiMarkAsRead(conversationId);
    } catch (err) {
      console.warn('[Er.NEXA Notifications] markAsRead error:', err);
    }
  }, []);

  // Dismiss toast
  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setActiveToast(null);
  }, []);

  // Subscribe to real-time incoming messages via Supabase Realtime
  useEffect(() => {
    const sb = supabase;
    if (!user || !sb) return;

    const channel = sb
      .channel('ernexa-global-message-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const newMsg = payload.new as any;
          if (!newMsg) return;

          // 1. If sent by current user, ignore notification
          if (newMsg.sender_id === user.id) return;

          // 2. Check if user is receiver or participant in conversation
          let isRecipient = false;
          if (newMsg.receiver_id === user.id) {
            isRecipient = true;
          } else {
            // Verify if user is participant
            try {
              const { data: part } = await sb
                .from('conversation_participants')
                .select('user_id')
                .match({ conversation_id: newMsg.conversation_id, user_id: user.id })
                .maybeSingle();
              if (part) isRecipient = true;
            } catch {
              isRecipient = true;
            }
          }

          if (!isRecipient) return;

          // 3. If user is currently actively viewing this conversation and tab is visible, auto-read
          if (activeOpenRef.current === newMsg.conversation_id && document.visibilityState === 'visible') {
            await markAsRead(newMsg.conversation_id);
            return;
          }

          // 4. Update badge count
          setUnreadTotalCount((prev) => prev + 1);
          setUnreadByConversation((prev) => ({
            ...prev,
            [newMsg.conversation_id]: (prev[newMsg.conversation_id] || 0) + 1,
          }));

          // 5. Fetch sender details & conversation title for toast
          let senderName = 'Teammate';
          let senderAvatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${newMsg.sender_id}`;
          let convTitle = 'Direct Message';

          try {
            const { data: convData } = await sb
              .from('conversations')
              .select('title, is_group, avatar_url')
              .eq('id', newMsg.conversation_id)
              .maybeSingle();

            if (convData) {
              if (convData.is_group && convData.title) {
                convTitle = convData.title;
              }
            }

            const { data: prof } = await sb
              .from('profiles')
              .select('display_name, full_name, username, avatar_url')
              .eq('id', newMsg.sender_id)
              .maybeSingle();

            if (prof) {
              senderName = prof.display_name || prof.full_name || `@${prof.username || 'engineer'}`;
              if (prof.avatar_url) senderAvatar = prof.avatar_url;
            }
          } catch {}

          // Format content snippet
          let previewText = (newMsg.content || '').trim();
          const rawAttachments = newMsg.attachments || newMsg.metadata?.attachments || [];
          if (rawAttachments.length > 0) {
            const firstAtt = rawAttachments[0];
            const isImg = firstAtt.category === 'image' || (firstAtt.type && firstAtt.type.startsWith('image/'));
            if (isImg) {
              previewText = previewText ? `📷 ${previewText}` : '📷 Shared an image';
            } else {
              previewText = previewText ? `📄 ${previewText}` : `📄 Shared ${firstAtt.name || 'document'}`;
            }
          }

          // Play subtle audio alert
          playNotificationChime();

          // Trigger toast
          if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
          }

          setActiveToast({
            id: newMsg.id || `toast-${Date.now()}`,
            conversation_id: newMsg.conversation_id,
            sender_id: newMsg.sender_id,
            sender_name: senderName,
            sender_avatar: senderAvatar,
            title: convTitle,
            content: previewText || 'New message received',
            message_type: newMsg.message_type,
            created_at: newMsg.created_at || new Date().toISOString(),
          });

          // Auto-dismiss after 6 seconds
          toastTimerRef.current = setTimeout(() => {
            setActiveToast(null);
          }, 6000);
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, [user, markAsRead]);

  // Handle clicking on the notification toast
  const handleToastClick = (toast: InAppMessageToast) => {
    dismissToast();
    markAsRead(toast.conversation_id);
    navigate(`/messages?conversationId=${toast.conversation_id}`);
  };

  return (
    <MessageNotificationContext.Provider
      value={{
        unreadTotalCount,
        unreadByConversation,
        activeToast,
        markAsRead,
        refreshUnreadCounts,
        dismissToast,
        activeOpenConversationId,
        setActiveOpenConversationId,
      }}
    >
      {children}

      {/* Global In-App Toast Notification */}
      {activeToast && (
        <div className="fixed top-5 right-5 z-50 max-w-sm sm:max-w-md w-full animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-xl border border-brand-border p-4 flex items-start gap-3.5 hover:shadow-2xl transition group relative overflow-hidden ring-1 ring-black/5">
            {/* Visual Accent Bar */}
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#C1121F]" />

            {/* Sender Avatar */}
            <div className="relative shrink-0 ml-1">
              <img
                src={activeToast.sender_avatar}
                alt={activeToast.sender_name}
                className="w-10 h-10 rounded-full object-cover border border-stone-200"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />
            </div>

            {/* Notification Text & Actions */}
            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => handleToastClick(activeToast)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-bold text-stone-900 truncate">
                    {activeToast.sender_name}
                  </span>
                  {activeToast.title !== 'Direct Message' && (
                    <span className="text-[10px] px-1.5 py-0.2 bg-stone-100 text-stone-600 font-semibold rounded truncate max-w-[110px]">
                      {activeToast.title}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-stone-400 font-mono shrink-0">Just now</span>
              </div>

              <p className="text-xs text-stone-600 line-clamp-2 mt-1 leading-snug">
                {activeToast.content}
              </p>

              <div className="flex items-center gap-1 mt-2 text-[11px] font-bold text-[#C1121F] group-hover:underline">
                <span>Open message</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dismissToast();
              }}
              className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </MessageNotificationContext.Provider>
  );
};
