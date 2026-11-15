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
  ExternalLink,
  Paperclip,
  Download,
  FileText,
  FileSpreadsheet,
  File as FileIcon,
  Maximize2,
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react';
import { 
  fetchConversations, 
  startConversation, 
  fetchMessages, 
  sendChatMessage, 
  searchProfiles, 
  fetchMyProfile 
} from '../lib/api';
import { ConversationItem, ChatMessage, UserProfile, MessageAttachment } from '../types';
import { useAuth } from '../context/AuthContext';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toUpperCase() : 'FILE';
}

function getDocumentColor(ext: string): { bg: string; text: string; border: string } {
  switch (ext) {
    case 'PDF':
      return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
    case 'XLS':
    case 'XLSX':
    case 'CSV':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'DOC':
    case 'DOCX':
      return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
    case 'PPT':
    case 'PPTX':
      return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' };
    default:
      return { bg: 'bg-stone-100', text: 'text-stone-700', border: 'border-stone-200' };
  }
}

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

  // Attachment handling state
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fullscreen image preview modal state
  const [previewImageUrl, setPreviewImageUrl] = useState<{ url: string; name: string } | null>(null);

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

  // Handle selecting files via input
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);
    // Limit to max 10 attachments per message and 25MB per file
    const validFiles: File[] = [];
    for (const file of newFiles) {
      if (file.size > 25 * 1024 * 1024) {
        alert(`File "${file.name}" exceeds the 25MB limit.`);
        continue;
      }
      validFiles.push(file);
    }

    setAttachedFiles((prev) => [...prev, ...validFiles].slice(0, 10));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle sending a chat message (text, attachments, or mixed)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversationId || isSending) return;

    const text = inputText.trim();
    if (!text && attachedFiles.length === 0) return;

    const currentFiles = [...attachedFiles];
    setInputText('');
    setAttachedFiles([]);
    setIsSending(true);
    setUploadStatus(currentFiles.length > 0 ? `Uploading ${currentFiles.length} file(s)...` : null);

    // Optimistic UI representation
    const tempId = `temp-${Date.now()}`;
    const optimisticAttachments: MessageAttachment[] = currentFiles.map((f, idx) => ({
      id: `temp-att-${idx}`,
      name: f.name,
      size: f.size,
      type: f.type,
      category: f.type.startsWith('image/') ? 'image' : 'document',
      url: f.type.startsWith('image/') ? URL.createObjectURL(f) : '#',
    }));

    const optimisticMsg: ChatMessage = {
      id: tempId,
      conversation_id: activeConversationId,
      sender_id: user?.id || myProfile?.id || 'me',
      sender_name: myProfile?.display_name || myProfile?.full_name || 'Me',
      sender_avatar: myProfile?.avatar_url,
      content: text,
      created_at: new Date().toISOString(),
      attachments: optimisticAttachments,
      message_type: optimisticAttachments.length > 0 ? (text ? 'mixed' : optimisticAttachments[0].category) : 'text',
      isUploading: currentFiles.length > 0,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(scrollToBottom, 50);

    try {
      const res = await sendChatMessage(activeConversationId, text, currentFiles);
      if (res.message) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? res.message : m)));
        loadConversations(true);
      }
    } catch (err: any) {
      console.error('Send message error:', err);
      alert(`Message delivery failed: ${err.message || 'Please check connection'}`);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setIsSending(false);
      setUploadStatus(null);
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
      <div className="bg-white rounded-3xl border border-brand-border shadow-sm overflow-hidden h-[720px] flex">
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
                <p className="text-[11px]">Search an engineer's username above to start messaging and sharing code files.</p>
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
                      <p className="text-[11px] text-stone-500 truncate mt-0.5 flex items-center gap-1">
                        {conv.lastMessage?.message_type === 'image' && <ImageIcon className="w-3 h-3 shrink-0 text-stone-400" />}
                        {conv.lastMessage?.message_type === 'document' && <FileIcon className="w-3 h-3 shrink-0 text-stone-400" />}
                        <span>{conv.lastMessage?.content || 'Shared attachment'}</span>
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
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 bg-[#FAF7F2]/50">
                {isLoadingMessages ? (
                  <div className="p-8 text-center text-xs text-stone-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#C1121F] mb-2" />
                    <span>Loading message history & media...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-xs text-stone-400 space-y-2 p-8">
                    <Sparkles className="w-8 h-8 text-amber-500/60" />
                    <p className="font-bold text-stone-700">Start the conversation</p>
                    <p className="max-w-xs text-stone-500">
                      Send a message, share diagrams, upload code documents, and collaborate with your team in real time.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.sender_id === user?.id || msg.sender_id === myProfile?.id;
                    const attachments = msg.attachments || [];
                    const imageAttachments = attachments.filter((a) => a.category === 'image');
                    const documentAttachments = attachments.filter((a) => a.category === 'document');

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

                        <div className={`max-w-sm sm:max-w-md lg:max-w-lg space-y-1.5 ${isMe ? 'items-end' : 'items-start'}`}>
                          <div
                            className={`p-3 rounded-2xl text-xs leading-relaxed shadow-xs space-y-2.5 ${
                              isMe
                                ? 'bg-[#C1121F] text-white rounded-br-xs'
                                : 'bg-white text-stone-900 border border-stone-200 rounded-bl-xs'
                            }`}
                          >
                            {/* 1. Image Attachments (WhatsApp-style responsive grid) */}
                            {imageAttachments.length > 0 && (
                              <div
                                className={`grid gap-1.5 rounded-xl overflow-hidden ${
                                  imageAttachments.length === 1
                                    ? 'grid-cols-1'
                                    : imageAttachments.length === 2
                                    ? 'grid-cols-2'
                                    : 'grid-cols-2 sm:grid-cols-3'
                                }`}
                              >
                                {imageAttachments.map((img) => (
                                  <div
                                    key={img.id}
                                    onClick={() => setPreviewImageUrl({ url: img.url, name: img.name })}
                                    className="relative group cursor-pointer overflow-hidden rounded-lg bg-black/5 aspect-video sm:aspect-square flex items-center justify-center border border-black/10"
                                  >
                                    <img
                                      src={img.url}
                                      alt={img.name}
                                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                      loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 text-white">
                                      <Maximize2 className="w-4 h-4" />
                                      <span className="text-[11px] font-semibold">Preview</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* 2. Document Attachments (WhatsApp-style file card) */}
                            {documentAttachments.length > 0 && (
                              <div className="space-y-1.5">
                                {documentAttachments.map((doc) => {
                                  const ext = getFileExtension(doc.name);
                                  const color = getDocumentColor(ext);

                                  return (
                                    <div
                                      key={doc.id}
                                      className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition ${
                                        isMe
                                          ? 'bg-white/10 border-white/20 hover:bg-white/15 text-white'
                                          : 'bg-stone-50 border-stone-200 hover:bg-stone-100/80 text-stone-900'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-[10px] border ${
                                          isMe ? 'bg-white text-stone-900 border-white/40' : `${color.bg} ${color.text} ${color.border}`
                                        }`}>
                                          {ext === 'PDF' ? <FileText className="w-5 h-5" /> : ext === 'CSV' || ext === 'XLSX' ? <FileSpreadsheet className="w-5 h-5" /> : ext}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold truncate max-w-[180px] sm:max-w-[240px]">
                                            {doc.name}
                                          </p>
                                          <p className={`text-[10px] font-mono ${isMe ? 'text-white/80' : 'text-stone-500'}`}>
                                            {ext} • {formatFileSize(doc.size)}
                                          </p>
                                        </div>
                                      </div>

                                      <a
                                        href={doc.url}
                                        download={doc.name}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={`p-2 rounded-lg transition shrink-0 ${
                                          isMe
                                            ? 'bg-white text-stone-900 hover:bg-stone-100'
                                            : 'bg-stone-200 hover:bg-stone-300 text-stone-800'
                                        }`}
                                        title={`Download ${doc.name}`}
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                      </a>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* 3. Text Message Content */}
                            {msg.content && (
                              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            )}

                            {/* Uploading progress indicator for optimistic message */}
                            {msg.isUploading && (
                              <div className="flex items-center gap-1.5 text-[10px] text-white/90 font-medium pt-1">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>Uploading attachments...</span>
                              </div>
                            )}
                          </div>

                          {/* Message metadata: timestamp & delivery checkmark */}
                          <div className={`flex items-center gap-1 text-[10px] text-stone-400 font-mono px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <span>
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isMe && (
                              msg.isUploading ? (
                                <Clock className="w-3 h-3 text-stone-400" />
                              ) : (
                                <CheckCheck className="w-3 h-3 text-stone-400" />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer & Attachment Preview Tray */}
              <div className="border-t border-stone-200 bg-white p-3 sm:p-4 space-y-2.5">
                {/* Upload Status Toast */}
                {uploadStatus && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#C1121F] bg-red-50 p-2 rounded-xl">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{uploadStatus}</span>
                  </div>
                )}

                {/* Staged File Previews Tray */}
                {attachedFiles.length > 0 && (
                  <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-2xl flex flex-wrap gap-2 items-center max-h-32 overflow-y-auto">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-1">
                      Attachments ({attachedFiles.length}):
                    </span>
                    {attachedFiles.map((f, idx) => {
                      const isImg = f.type.startsWith('image/');
                      const ext = getFileExtension(f.name);
                      const color = getDocumentColor(ext);

                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-xl border border-stone-200 text-xs shadow-2xs group"
                        >
                          {isImg ? (
                            <ImageIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          ) : (
                            <span className={`text-[9px] font-bold px-1 rounded ${color.bg} ${color.text}`}>
                              {ext}
                            </span>
                          )}
                          <span className="truncate max-w-[120px] font-medium text-stone-800 text-[11px]">
                            {f.name}
                          </span>
                          <span className="text-[10px] text-stone-400 font-mono">
                            {formatFileSize(f.size)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(idx)}
                            className="p-0.5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-red-600 transition"
                            title="Remove attachment"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Input Bar Form */}
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                    onChange={handleFilesSelected}
                    className="hidden"
                  />

                  {/* Attachment Paperclip Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach images, documents or spreadsheets (up to 25MB)"
                    className="p-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600 hover:text-stone-900 transition active:scale-95 shrink-0"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  {/* Message Text Input */}
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={
                      attachedFiles.length > 0
                        ? `Add a caption for ${attachedFiles.length} file(s)...`
                        : `Message @${activeConv.otherParticipant?.username || 'engineer'}...`
                    }
                    className="flex-1 px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C1121F]/20"
                  />

                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={(!inputText.trim() && attachedFiles.length === 0) || isSending}
                    className="px-4 py-2.5 bg-[#C1121F] hover:bg-[#9B0E19] text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                  >
                    {isSending ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">{isSending ? 'Sending...' : 'Send'}</span>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-stone-400 space-y-3">
              <div className="w-14 h-14 rounded-3xl bg-red-50 text-[#C1121F] flex items-center justify-center border border-red-100 shadow-inner">
                <MessageSquare className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-stone-800">Your Er.NEXA Messenger</h3>
              <p className="text-xs text-stone-500 max-w-sm leading-relaxed">
                Connect and exchange knowledge with teammates, reviewers, and project owners in real time. Share code files, spreadsheets, and architecture diagrams directly.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Image Preview Lightbox Modal */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div
            className="bg-stone-900 border border-white/10 rounded-2xl p-4 max-w-4xl w-full max-h-[90vh] flex flex-col items-center gap-3 relative shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between border-b border-white/10 pb-2.5 text-white">
              <span className="text-xs font-bold truncate max-w-md">{previewImageUrl.name}</span>
              <div className="flex items-center gap-2">
                <a
                  href={previewImageUrl.url}
                  download={previewImageUrl.name}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white font-semibold transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  onClick={() => setPreviewImageUrl(null)}
                  className="p-1 text-stone-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 w-full flex items-center justify-center overflow-hidden max-h-[75vh]">
              <img
                src={previewImageUrl.url}
                alt={previewImageUrl.name}
                className="max-h-full max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
