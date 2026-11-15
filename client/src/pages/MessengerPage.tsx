import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MessageSquare, 
  Send, 
  Search, 
  User, 
  ArrowLeft, 
  RefreshCw, 
  Check, 
  CheckCheck, 
  Clock, 
  Sparkles, 
  X,
  ExternalLink
} from 'lucide-react';
import { 
  fetchConversations, 
  startConversation, 
  fetchMessages, 
  sendChatMessage, 
  searchProfiles, 
  fetchMyProfile 
} from '../lib/api';
import { ConversationItem, ChatMessage, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';

export const MessengerPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Search user state to start new chat
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Mobile navigation state
  const [showMobileChat, setShowMobileChat] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load initial conversations & user profile
  useEffect(() => {
    loadMyProfile();
    loadConversations();
  }, []);

  const loadMyProfile = async () => {
    try {
      const res = await fetchMyProfile();
      if (res.profile) setMyProfile(res.profile);
    } catch {}
  };

  const loadConversations = async (keepActive = true) => {
    try {
      const res = await fetchConversations();
      if (res.conversations) {
        setConversations(res.conversations);
        if (!activeConversationId && res.conversations.length > 0 && !keepActive) {
          setActiveConversationId(res.conversations[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  // Load messages whenever active conversation changes
  useEffect(() => {
    if (!activeConversationId) return;

    setIsLoadingMessages(true);
    fetchMessages(activeConversationId)
      .then((res) => {
        if (res.messages) {
          setMessages(res.messages);
          setTimeout(scrollToBottom, 100);
        }
      })
      .catch((err) => console.error('Failed to fetch messages:', err))
      .finally(() => setIsLoadingMessages(false));
  }, [activeConversationId]);

  // Periodic polling for real-time updates (every 3 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeConversationId) {
        fetchMessages(activeConversationId)
          .then((res) => {
            if (res.messages && res.messages.length !== messages.length) {
              setMessages(res.messages);
              scrollToBottom();
            }
          })
          .catch(() => {});
      }
      loadConversations(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [activeConversationId, messages.length]);

  // Search users debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchProfiles(searchQuery.trim());
        setSearchResults(res.profiles || []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle starting a conversation with a searched user
  const handleSelectUser = async (targetUser: UserProfile) => {
    try {
      const res = await startConversation(targetUser.id);
      if (res.conversation) {
        setSearchQuery('');
        setSearchResults([]);
        await loadConversations();
        setActiveConversationId(res.conversation.id);
        setShowMobileChat(true);
      }
    } catch (err: any) {
      alert(`Could not start conversation: ${err.message}`);
    }
  };

  // Handle sending a chat message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversationId || !inputText.trim() || isSending) return;

    const text = inputText.trim();
    setInputText('');
    setIsSending(true);

    // Optimistic UI update
    const optimisticMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: activeConversationId,
      sender_id: user?.id || 'me',
      sender_name: myProfile?.display_name || 'Me',
      sender_avatar: myProfile?.avatar_url,
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(scrollToBottom, 50);

    try {
      const res = await sendChatMessage(activeConversationId, text);
      if (res.message) {
        setMessages((prev) => prev.map((m) => (m.id === optimisticMsg.id ? res.message : m)));
        loadConversations(true);
      }
    } catch (err: any) {
      console.error('Send message error:', err);
    } finally {
      setIsSending(false);
    }
  };

  const activeConv = conversations.find((c) => c.id === activeConversationId);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Top Header & Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 transition active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>

        <span className="text-xs font-mono text-stone-500">
          Logged in as: <strong className="text-stone-800">@{myProfile?.username || 'user'}</strong>
        </span>
      </div>

      {/* Main Messenger Container */}
      <div className="bg-white rounded-3xl border border-brand-border shadow-sm overflow-hidden h-[700px] flex">
        {/* LEFT COLUMN: Conversations Sidebar */}
        <div
          className={`w-full md:w-80 lg:w-96 border-r border-stone-200 flex flex-col bg-stone-50/50 ${
            showMobileChat ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Sidebar Top: Title & User Search */}
          <div className="p-4 border-b border-stone-200 space-y-3 bg-white">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#C1121F]" />
                <span>Messages</span>
              </h2>
              <span className="text-xs text-stone-500 font-mono bg-stone-100 px-2 py-0.5 rounded-full">
                {conversations.length}
              </span>
            </div>

            {/* Search user input */}
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search engineers by @username..."
                className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C1121F]/20 font-sans"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 font-bold text-xs"
                >
                  ×
                </button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="p-2 bg-white rounded-2xl border border-stone-200 shadow-lg space-y-1 max-h-48 overflow-y-auto">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-2 py-1">
                  Engineers Found:
                </p>
                {searchResults.map((usr) => (
                  <div
                    key={usr.id}
                    onClick={() => handleSelectUser(usr)}
                    className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-stone-50 cursor-pointer transition"
                  >
                    <img
                      src={usr.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${usr.id}`}
                      alt={usr.username}
                      className="w-7 h-7 rounded-full object-cover border border-stone-200"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-stone-900 truncate">{usr.display_name || usr.full_name}</p>
                      <p className="text-[10px] text-stone-500 font-mono truncate">@{usr.username}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto divide-y divide-stone-100 p-2 space-y-1">
            {isLoadingConversations ? (
              <div className="p-8 text-center text-xs text-stone-500">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#C1121F] mb-2" />
                <span>Loading conversations...</span>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-500 space-y-2">
                <MessageSquare className="w-8 h-8 text-stone-300 mx-auto" />
                <p className="font-semibold text-stone-700">No conversations yet</p>
                <p className="text-[11px]">Search an engineer's username above to start messaging in real time.</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = conv.id === activeConversationId;
                const other = conv.otherParticipant;

                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      setActiveConversationId(conv.id);
                      setShowMobileChat(true);
                    }}
                    className={`p-3 rounded-2xl cursor-pointer transition flex items-center gap-3 ${
                      isSelected
                        ? 'bg-white shadow-sm border border-stone-200 ring-2 ring-[#C1121F]/10'
                        : 'hover:bg-white/70'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <img
                        src={other?.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${other?.id || 'guest'}`}
                        alt={other?.display_name || 'User'}
                        className="w-11 h-11 rounded-full object-cover border border-stone-200"
                      />
                      {conv.unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#C1121F] text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-sm">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-bold text-stone-900 truncate">
                          {other?.display_name || other?.full_name || `@${other?.username || 'user'}`}
                        </p>
                        <span className="text-[10px] text-stone-400 font-mono">
                          {conv.lastMessage?.created_at
                            ? new Date(conv.lastMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : ''}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 truncate mt-0.5">
                        {conv.lastMessage?.content || 'No messages yet'}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Active Chat Window */}
        <div
          className={`flex-1 flex flex-col bg-white ${
            !showMobileChat ? 'hidden md:flex' : 'flex'
          }`}
        >
          {activeConv ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-white z-10 shadow-xs">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowMobileChat(false)}
                    className="md:hidden p-1.5 hover:bg-stone-100 rounded-lg text-stone-600"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <img
                    src={activeConv.otherParticipant?.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${activeConv.otherParticipant?.id}`}
                    alt="Participant"
                    className="w-10 h-10 rounded-full object-cover border border-stone-200"
                  />

                  <div>
                    <h3 className="text-sm font-bold text-stone-900">
                      {activeConv.otherParticipant?.display_name || activeConv.otherParticipant?.full_name}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-stone-500 font-mono">
                      <span>@{activeConv.otherParticipant?.username || 'user'}</span>
                      <span>•</span>
                      <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Online
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono bg-stone-100 px-2 py-1 rounded text-stone-700">
                    {activeConv.otherParticipant?.public_id || 'NX-USER'}
                  </span>
                </div>
              </div>

              {/* Messages Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-[#FAF7F2]/50">
                {isLoadingMessages ? (
                  <div className="p-8 text-center text-xs text-stone-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#C1121F] mb-2" />
                    <span>Loading message history...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-xs text-stone-400 space-y-2 p-8">
                    <Sparkles className="w-8 h-8 text-amber-500/60" />
                    <p className="font-bold text-stone-700">Start the conversation</p>
                    <p className="max-w-xs text-stone-500">
                      Send a message to collaborate on code analysis, architecture reviews, and handover tasks.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.sender_id === user?.id || msg.sender_id === myProfile?.id;

                    return (
                      <div
                        key={msg.id}
                        className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isMe && (
                          <img
                            src={msg.sender_avatar || activeConv.otherParticipant?.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${msg.sender_id}`}
                            alt="Sender"
                            className="w-6 h-6 rounded-full object-cover shrink-0 mb-1 border border-stone-200"
                          />
                        )}

                        <div className={`max-w-md space-y-1 ${isMe ? 'items-end' : 'items-start'}`}>
                          <div
                            className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                              isMe
                                ? 'bg-[#C1121F] text-white rounded-br-xs'
                                : 'bg-white text-stone-900 border border-stone-200 rounded-bl-xs'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          </div>

                          <div className={`flex items-center gap-1 text-[10px] text-stone-400 font-mono px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <span>
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isMe && <CheckCheck className="w-3 h-3 text-stone-400" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Form */}
              <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-stone-200 bg-white flex items-center gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Message @${activeConv.otherParticipant?.username || 'engineer'}...`}
                  className="flex-1 px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C1121F]/20"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isSending}
                  className="px-4 py-2.5 bg-[#C1121F] hover:bg-[#9B0E19] text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-stone-400 space-y-3">
              <div className="w-14 h-14 rounded-3xl bg-red-50 text-[#C1121F] flex items-center justify-center border border-red-100 shadow-inner">
                <MessageSquare className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-stone-800">Your Er.NEXA Messenger</h3>
              <p className="text-xs text-stone-500 max-w-sm leading-relaxed">
                Connect and exchange knowledge with teammates, reviewers, and project owners in real time. Select a conversation or search a username to begin.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
