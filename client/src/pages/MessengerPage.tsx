import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MessageSquare, 
  Send, 
  Search, 
  User, 
  ArrowLeft, 
  RefreshCw, 
  CheckCheck, 
  Clock, 
  Sparkles, 
  X,
  Paperclip,
  Download,
  FileText,
  FileSpreadsheet,
  File as FileIcon,
  Maximize2,
  Image as ImageIcon,
  Users,
  UserPlus,
  ShieldCheck,
  LogOut,
  Edit3,
  Camera,
  Info,
  Trash2,
  Check
} from 'lucide-react';
import { 
  fetchConversations, 
  startConversation, 
  fetchMessages, 
  sendChatMessage, 
  searchProfiles, 
  fetchMyProfile,
  createGroupConversation,
  fetchConversationDetails,
  updateGroupDetails,
  uploadGroupAvatar,
  addGroupMembers,
  removeGroupMember
} from '../lib/api';
import { ConversationItem, ChatMessage, UserProfile, MessageAttachment, GroupMemberInfo } from '../types';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

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
  const [activeConversationDetail, setActiveConversationDetail] = useState<ConversationItem | null>(null);
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

  // ==========================================
  // Group Chat Management States
  // ==========================================
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupAvatarFile, setNewGroupAvatarFile] = useState<File | null>(null);
  const [newGroupAvatarPreview, setNewGroupAvatarPreview] = useState<string | null>(null);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<UserProfile[]>([]);
  const [groupUserSearchQuery, setGroupUserSearchQuery] = useState('');
  const [groupUserSearchResults, setGroupUserSearchResults] = useState<UserProfile[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);

  // Group Details / Info Drawer Modal States
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [showAddMemberSection, setShowAddMemberSection] = useState(false);
  const [addMemberSearchQuery, setAddMemberSearchQuery] = useState('');
  const [addMemberSearchResults, setAddMemberSearchResults] = useState<UserProfile[]>([]);
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const updateGroupAvatarInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load initial conversations & user profile
  useEffect(() => {
    loadMyProfile();
    loadConversations();
  }, []);

  // Browser Back Button (popstate) handling
  useEffect(() => {
    const handlePopState = () => {
      if (activeConversationId) {
        setActiveConversationId(null);
        setShowMobileChat(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeConversationId]);

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
          handleSelectConversation(res.conversations[0].id);
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
    if (!activeConversationId) {
      setActiveConversationDetail(null);
      setMessages([]);
      return;
    }

    setIsLoadingMessages(true);

    // Fetch conversation detail view (for member list, roles, admin)
    fetchConversationDetails(activeConversationId)
      .then((res) => {
        if (res.conversation) {
          setActiveConversationDetail(res.conversation);
          setEditTitleValue(res.conversation.title || '');
        }
      })
      .catch(() => {});

    // Fetch conversation messages
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

  // Instant real-time message delivery and sync via Supabase Realtime
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel('ernexa-messenger-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as any;
          if (!newMsg) return;

          // If message is for the currently open conversation
          if (activeConversationId && newMsg.conversation_id === activeConversationId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;

              let senderName = newMsg.sender_name;
              let senderAvatar = newMsg.sender_avatar;

              if (!senderName || !senderAvatar) {
                const otherPart = activeConversationDetail?.otherParticipant;
                if (newMsg.sender_id === user?.id || newMsg.sender_id === myProfile?.id) {
                  senderName = myProfile?.display_name || myProfile?.full_name || 'Me';
                  senderAvatar = myProfile?.avatar_url;
                } else if (otherPart && otherPart.id === newMsg.sender_id) {
                  senderName = otherPart.display_name || otherPart.full_name || `@${otherPart.username || 'engineer'}`;
                  senderAvatar = otherPart.avatar_url;
                } else if (activeConversationDetail?.members) {
                  const m = activeConversationDetail.members.find((mem) => mem.user_id === newMsg.sender_id);
                  if (m?.profile) {
                    senderName = m.profile.display_name || m.profile.full_name || `@${m.profile.username || 'engineer'}`;
                    senderAvatar = m.profile.avatar_url;
                  }
                }
              }

              const formatted: ChatMessage = {
                id: newMsg.id,
                conversation_id: newMsg.conversation_id,
                sender_id: newMsg.sender_id,
                receiver_id: newMsg.receiver_id,
                sender_name: senderName || 'Engineer',
                sender_avatar: senderAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${newMsg.sender_id}`,
                content: newMsg.content || '',
                message_type: newMsg.message_type || 'text',
                attachments: newMsg.attachments || newMsg.metadata?.attachments || [],
                metadata: newMsg.metadata || {},
                created_at: newMsg.created_at,
              };

              return [...prev, formatted];
            });
            setTimeout(scrollToBottom, 100);
          }

          // Always refresh conversations list so sidebar preview & unread counts update in real-time
          loadConversations(true);
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [activeConversationId, user?.id, myProfile, activeConversationDetail]);

  // Periodic polling for real-time updates (every 3 seconds backup)
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

  // Debounced search for direct conversations
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

  // Debounced search for creating group
  useEffect(() => {
    if (!groupUserSearchQuery.trim()) {
      setGroupUserSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await searchProfiles(groupUserSearchQuery.trim());
        const filtered = (res.profiles || []).filter(
          (p: UserProfile) => !selectedGroupMembers.some((sm) => sm.id === p.id) && p.id !== user?.id
        );
        setGroupUserSearchResults(filtered);
      } catch {
        setGroupUserSearchResults([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [groupUserSearchQuery, selectedGroupMembers, user?.id]);

  // Debounced search for adding new members to an existing group
  useEffect(() => {
    if (!addMemberSearchQuery.trim()) {
      setAddMemberSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await searchProfiles(addMemberSearchQuery.trim());
        const currentMemberIds = activeConversationDetail?.members?.map((m) => m.user_id) || [];
        const filtered = (res.profiles || []).filter(
          (p: UserProfile) => !currentMemberIds.includes(p.id)
        );
        setAddMemberSearchResults(filtered);
      } catch {
        setAddMemberSearchResults([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [addMemberSearchQuery, activeConversationDetail]);

  // Open a conversation with browser history support
  const handleSelectConversation = (convId: string) => {
    setActiveConversationId(convId);
    setShowMobileChat(true);
    try {
      window.history.pushState({ chatActive: true, convId }, '', window.location.href);
    } catch {}
  };

  // Back button handler: Exits conversation and returns to conversation list cleanly
  const handleBackToConversations = () => {
    setActiveConversationId(null);
    setActiveConversationDetail(null);
    setShowMobileChat(false);
    if (window.history.state?.chatActive) {
      window.history.back();
    }
  };

  // Start direct conversation with searched user
  const handleSelectUser = async (targetUser: UserProfile) => {
    try {
      const res = await startConversation(targetUser.id);
      if (res.conversation) {
        setSearchQuery('');
        setSearchResults([]);
        await loadConversations();
        handleSelectConversation(res.conversation.id);
      }
    } catch (err: any) {
      alert(`Could not start conversation: ${err.message}`);
    }
  };

  // File attachments selection
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);
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

  // Send message
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

    const tempId = `temp-${Date.now()}`;
    const optimisticAttachments: MessageAttachment[] = currentFiles.map((f, idx) => ({
      id: `temp-att-${idx}`,
      name: f.name,
      size: f.size,
      type: f.type,
      category: f.type.startsWith('image/') ? 'image' : 'document',
      url: f.type.startsWith('image/') ? URL.createObjectURL(f) : '#',
    }));

    const targetReceiverId = activeConversationDetail?.is_group ? undefined : activeConversationDetail?.otherParticipant?.id;

    const optimisticMsg: ChatMessage = {
      id: tempId,
      conversation_id: activeConversationId,
      sender_id: user?.id || myProfile?.id || 'me',
      receiver_id: targetReceiverId,
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
      const res = await sendChatMessage(activeConversationId, text, currentFiles, targetReceiverId);
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

  // ==========================================
  // Group Chat Creation Actions
  // ==========================================
  const handleGroupAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('Group avatar image must be less than 10MB.');
        return;
      }
      setNewGroupAvatarFile(file);
      setNewGroupAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleAddMemberToGroupSelection = (usr: UserProfile) => {
    if (!selectedGroupMembers.some((m) => m.id === usr.id)) {
      setSelectedGroupMembers((prev) => [...prev, usr]);
      setGroupUserSearchQuery('');
      setGroupUserSearchResults([]);
    }
  };

  const handleRemoveMemberFromGroupSelection = (usrId: string) => {
    setSelectedGroupMembers((prev) => prev.filter((m) => m.id !== usrId));
  };

  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newGroupTitle.trim();
    if (!title) {
      alert('Please enter a group name.');
      return;
    }

    setIsCreatingGroup(true);
    try {
      const memberIds = selectedGroupMembers.map((m) => m.id);
      const res = await createGroupConversation(
        title,
        memberIds,
        newGroupAvatarFile,
        newGroupDescription.trim()
      );

      if (res.conversation) {
        setShowCreateGroupModal(false);
        setNewGroupTitle('');
        setNewGroupDescription('');
        setNewGroupAvatarFile(null);
        setNewGroupAvatarPreview(null);
        setSelectedGroupMembers([]);
        await loadConversations();
        handleSelectConversation(res.conversation.id);
      }
    } catch (err: any) {
      alert(`Failed to create group: ${err.message || 'Please try again'}`);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // ==========================================
  // Group Info / Admin Management Actions
  // ==========================================
  const activeConv = conversations.find((c) => c.id === activeConversationId) || activeConversationDetail;
  const isGroup = Boolean(activeConv?.is_group);
  const currentUserId = user?.id || myProfile?.id;
  const isGroupAdmin = isGroup && (
    activeConv?.admin_id === currentUserId ||
    activeConversationDetail?.members?.some((m) => m.user_id === currentUserId && m.role === 'admin')
  );

  const handleSaveGroupTitle = async () => {
    if (!activeConversationId || !editTitleValue.trim()) return;
    setIsSavingTitle(true);
    try {
      const res = await updateGroupDetails(activeConversationId, { title: editTitleValue.trim() });
      if (res.conversation) {
        setActiveConversationDetail(res.conversation);
        setIsEditingTitle(false);
        loadConversations(true);
      }
    } catch (err: any) {
      alert(`Failed to update group name: ${err.message}`);
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleUploadNewGroupAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversationId) return;

    try {
      const res = await uploadGroupAvatar(activeConversationId, file);
      if (res.conversation) {
        setActiveConversationDetail(res.conversation);
        loadConversations(true);
      }
    } catch (err: any) {
      alert(`Avatar upload failed: ${err.message}`);
    }
  };

  const handleAddMemberToActiveGroup = async (targetUser: UserProfile) => {
    if (!activeConversationId) return;
    setIsAddingMembers(true);
    try {
      const res = await addGroupMembers(activeConversationId, [targetUser.id]);
      if (res.conversation) {
        setActiveConversationDetail(res.conversation);
        setAddMemberSearchQuery('');
        setAddMemberSearchResults([]);
        setShowAddMemberSection(false);
        loadConversations(true);
      }
    } catch (err: any) {
      alert(`Failed to add member: ${err.message}`);
    } finally {
      setIsAddingMembers(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!activeConversationId) return;
    if (!window.confirm(`Are you sure you want to remove ${memberName} from this group?`)) return;

    try {
      await removeGroupMember(activeConversationId, memberId);
      const updatedDetail = await fetchConversationDetails(activeConversationId);
      if (updatedDetail.conversation) {
        setActiveConversationDetail(updatedDetail.conversation);
      }
      loadConversations(true);
    } catch (err: any) {
      alert(`Failed to remove member: ${err.message}`);
    }
  };

  const handleLeaveGroup = async () => {
    if (!activeConversationId || !currentUserId) return;
    if (!window.confirm('Are you sure you want to leave this group conversation?')) return;

    setIsLeavingGroup(true);
    try {
      await removeGroupMember(activeConversationId, currentUserId);
      setShowGroupInfoModal(false);
      handleBackToConversations();
      await loadConversations();
    } catch (err: any) {
      alert(`Failed to leave group: ${err.message}`);
    } finally {
      setIsLeavingGroup(false);
    }
  };

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
      <div className="bg-white rounded-3xl border border-brand-border shadow-sm overflow-hidden h-[740px] flex">
        {/* LEFT COLUMN: Conversations Sidebar */}
        <div
          className={`w-full md:w-80 lg:w-96 border-r border-stone-200 flex flex-col bg-stone-50/50 ${
            showMobileChat ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Sidebar Top: Title, Action Buttons & User Search */}
          <div className="p-4 border-b border-stone-200 space-y-3 bg-white">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#C1121F]" />
                <span>Messages</span>
              </h2>

              <div className="flex items-center gap-1.5">
                {/* Create New Group Button */}
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-[#C1121F] border border-red-200 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-2xs"
                  title="Create WhatsApp-like Group Chat"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>+ Group</span>
                </button>

                <span className="text-xs text-stone-500 font-mono bg-stone-100 px-2 py-1 rounded-lg">
                  {conversations.length}
                </span>
              </div>
            </div>

            {/* Search user input */}
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search engineers by @username..."
                className="w-full pl-9 pr-8 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C1121F]/20 font-sans"
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
                <p className="text-[11px]">Search an engineer above or create a group chat to start messaging.</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = conv.id === activeConversationId;
                const isGroupConv = Boolean(conv.is_group);
                const title = isGroupConv
                  ? conv.title || 'Project Group'
                  : conv.otherParticipant?.display_name || conv.otherParticipant?.full_name || `@${conv.otherParticipant?.username || 'user'}`;
                const avatar = isGroupConv
                  ? conv.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${conv.id}`
                  : conv.otherParticipant?.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${conv.otherParticipant?.id || 'guest'}`;

                return (
                  <div
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    className={`p-3 rounded-2xl cursor-pointer transition flex items-center gap-3 ${
                      isSelected
                        ? 'bg-white shadow-sm border border-stone-200 ring-2 ring-[#C1121F]/10'
                        : 'hover:bg-white/70'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <img
                        src={avatar}
                        alt={title}
                        className={`w-11 h-11 object-cover border border-stone-200 ${
                          isGroupConv ? 'rounded-2xl' : 'rounded-full'
                        }`}
                      />
                      {isGroupConv && (
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-stone-800 text-white rounded-full flex items-center justify-center border border-white">
                          <Users className="w-2.5 h-2.5" />
                        </span>
                      )}
                      {conv.unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#C1121F] text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-sm">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-xs font-bold text-stone-900 truncate">{title}</p>
                          {isGroupConv && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-red-50 text-[#C1121F] font-bold rounded shrink-0 border border-red-100">
                              Group
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-stone-400 font-mono shrink-0">
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
              {/* Chat Header with prominent Back Button */}
              <div className="p-3.5 sm:p-4 border-b border-stone-200 flex items-center justify-between bg-white z-10 shadow-xs gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Universal Back Button (Visible on Both Desktop & Mobile) */}
                  <button
                    type="button"
                    onClick={handleBackToConversations}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 font-semibold text-xs transition active:scale-95 shadow-2xs group shrink-0"
                    title="Back to conversation list"
                  >
                    <ArrowLeft className="w-4 h-4 text-stone-600 group-hover:-translate-x-0.5 transition-transform" />
                    <span>Chats</span>
                  </button>

                  {/* Avatar (Clicking opens info drawer for groups) */}
                  <div
                    onClick={() => isGroup && setShowGroupInfoModal(true)}
                    className={`relative shrink-0 ${isGroup ? 'cursor-pointer hover:opacity-90' : ''}`}
                  >
                    <img
                      src={
                        isGroup
                          ? activeConv.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${activeConv.id}`
                          : activeConv.otherParticipant?.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${activeConv.otherParticipant?.id}`
                      }
                      alt="Avatar"
                      className={`w-10 h-10 object-cover border border-stone-200 ${
                        isGroup ? 'rounded-2xl' : 'rounded-full'
                      }`}
                    />
                    {isGroup && (
                      <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-stone-800 text-white rounded-full flex items-center justify-center border border-white">
                        <Users className="w-2 h-2" />
                      </span>
                    )}
                  </div>

                  {/* Header Title & Subtitle */}
                  <div
                    onClick={() => isGroup && setShowGroupInfoModal(true)}
                    className={`min-w-0 ${isGroup ? 'cursor-pointer' : ''}`}
                  >
                    <h3 className="text-sm font-bold text-stone-900 truncate flex items-center gap-1.5">
                      <span>
                        {isGroup
                          ? activeConv.title || 'Project Group'
                          : activeConv.otherParticipant?.display_name || activeConv.otherParticipant?.full_name}
                      </span>
                      {isGroup && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-[#C1121F] font-bold rounded border border-red-100">
                          Group
                        </span>
                      )}
                    </h3>

                    <div className="flex items-center gap-2 text-[11px] text-stone-500 font-mono truncate">
                      {isGroup ? (
                        <span className="hover:text-stone-800 transition">
                          {activeConversationDetail?.members?.length || activeConv.members?.length || 1} members • Tap for group info
                        </span>
                      ) : (
                        <>
                          <span>@{activeConv.otherParticipant?.username || 'user'}</span>
                          <span>•</span>
                          <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Online
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {isGroup ? (
                    <button
                      type="button"
                      onClick={() => setShowGroupInfoModal(true)}
                      className="px-2.5 py-1.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
                      title="Group Details & Member List"
                    >
                      <Info className="w-3.5 h-3.5 text-stone-600" />
                      <span className="hidden sm:inline">Group Info</span>
                    </button>
                  ) : (
                    <span className="text-[10px] font-mono bg-stone-100 px-2 py-1 rounded text-stone-700">
                      {activeConv.otherParticipant?.public_id || 'NX-USER'}
                    </span>
                  )}
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
                      Send a message, share diagrams, upload code documents, and collaborate in real time.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.sender_id === user?.id || msg.sender_id === myProfile?.id;
                    const attachments = msg.attachments || [];
                    const imageAttachments = attachments.filter((a) => a.category === 'image');
                    const documentAttachments = attachments.filter((a) => a.category === 'document');
                    const isSystem = msg.metadata?.is_system_announcement;

                    if (isSystem) {
                      return (
                        <div key={msg.id} className="flex justify-center my-2">
                          <span className="px-3 py-1 bg-stone-200/70 border border-stone-300/50 text-stone-600 rounded-full text-[10px] font-medium shadow-2xs">
                            {msg.content}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isMe && (
                          <img
                            src={msg.sender_avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${msg.sender_id}`}
                            alt={msg.sender_name || 'Sender'}
                            className="w-7 h-7 rounded-full object-cover shrink-0 mb-1 border border-stone-200"
                          />
                        )}

                        <div className={`max-w-sm sm:max-w-md lg:max-w-lg space-y-1 ${isMe ? 'items-end' : 'items-start'}`}>
                          {/* Group Sender Name Header (WhatsApp-style) */}
                          {isGroup && !isMe && (
                            <div className="flex items-center gap-1.5 px-1 text-[11px] font-bold text-[#C1121F]">
                              <span>{msg.sender_name || 'Engineer'}</span>
                              {activeConversationDetail?.admin_id === msg.sender_id && (
                                <span className="text-[9px] px-1 py-0.2 bg-red-100 text-[#C1121F] rounded font-semibold">
                                  Admin
                                </span>
                              )}
                            </div>
                          )}

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

                          {/* Message timestamp & status */}
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
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                    onChange={handleFilesSelected}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach images, documents or spreadsheets (up to 25MB)"
                    className="p-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600 hover:text-stone-900 transition active:scale-95 shrink-0"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={
                      attachedFiles.length > 0
                        ? `Add a caption for ${attachedFiles.length} file(s)...`
                        : isGroup
                        ? `Message ${activeConv.title || 'group'}...`
                        : `Message @${activeConv.otherParticipant?.username || 'engineer'}...`
                    }
                    className="flex-1 px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C1121F]/20"
                  />

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
                Connect and exchange knowledge with teammates, reviewers, and project groups in real time. Share code files, spreadsheets, and architecture diagrams directly.
              </p>
              <button
                type="button"
                onClick={() => setShowCreateGroupModal(true)}
                className="mt-2 px-4 py-2 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-sm transition active:scale-95"
              >
                <Users className="w-4 h-4 text-red-400" />
                <span>Create a Project Group</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================== */}
      {/* 1. CREATE NEW GROUP CHAT MODAL */}
      {/* ========================================== */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="bg-white rounded-3xl border border-stone-200 max-w-lg w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-50 text-[#C1121F] flex items-center justify-center border border-red-100">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-stone-900">Create New Group</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateGroupModal(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGroupSubmit} className="space-y-4">
              {/* Group Avatar & Group Name */}
              <div className="flex items-center gap-4">
                <div className="relative group shrink-0">
                  <img
                    src={
                      newGroupAvatarPreview ||
                      `https://api.dicebear.com/7.x/identicon/svg?seed=${newGroupTitle || 'new_group'}`
                    }
                    alt="Group Avatar"
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-stone-200 bg-stone-50"
                  />
                  <button
                    type="button"
                    onClick={() => groupAvatarInputRef.current?.click()}
                    className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition"
                    title="Upload Group Icon"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                  <input
                    ref={groupAvatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleGroupAvatarSelect}
                    className="hidden"
                  />
                </div>

                <div className="flex-1 space-y-1">
                  <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                    Group Subject / Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newGroupTitle}
                    onChange={(e) => setNewGroupTitle(e.target.value)}
                    placeholder="e.g. Core Engine Team, Hackathon Finals"
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C1121F]/20 font-medium"
                  />
                </div>
              </div>

              {/* Group Description */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                  Description / Topic (Optional)
                </label>
                <input
                  type="text"
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  placeholder="Purpose of this engineering channel..."
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C1121F]/20"
                />
              </div>

              {/* Creator as Admin Notice */}
              <div className="p-3 bg-red-50/60 border border-red-100 rounded-xl flex items-center gap-2.5 text-xs text-stone-700">
                <ShieldCheck className="w-4 h-4 text-[#C1121F] shrink-0" />
                <span>
                  You (<strong className="text-stone-900">@{myProfile?.username || 'you'}</strong>) will automatically become the <strong>Group Administrator</strong>.
                </span>
              </div>

              {/* Add Members Search */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                  Add Engineers / Teammates
                </label>

                {/* Selected Members Chips */}
                {selectedGroupMembers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-stone-50 border border-stone-200 rounded-xl">
                    {selectedGroupMembers.map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-stone-200 rounded-lg text-xs font-semibold text-stone-800 shadow-2xs"
                      >
                        <img
                          src={m.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${m.id}`}
                          alt={m.username}
                          className="w-4 h-4 rounded-full"
                        />
                        <span>{m.display_name || m.full_name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMemberFromGroupSelection(m.id)}
                          className="text-stone-400 hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="relative">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={groupUserSearchQuery}
                    onChange={(e) => setGroupUserSearchQuery(e.target.value)}
                    placeholder="Search by username to add members..."
                    className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C1121F]/20"
                  />
                </div>

                {/* Search Results for Member Selection */}
                {groupUserSearchResults.length > 0 && (
                  <div className="border border-stone-200 rounded-xl p-1.5 max-h-36 overflow-y-auto space-y-1 bg-white shadow-sm">
                    {groupUserSearchResults.map((usr) => (
                      <div
                        key={usr.id}
                        onClick={() => handleAddMemberToGroupSelection(usr)}
                        className="flex items-center justify-between p-2 hover:bg-stone-50 rounded-lg cursor-pointer transition text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={usr.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${usr.id}`}
                            alt={usr.username}
                            className="w-6 h-6 rounded-full"
                          />
                          <div>
                            <p className="font-bold text-stone-900">{usr.display_name || usr.full_name}</p>
                            <p className="text-[10px] text-stone-500 font-mono">@{usr.username}</p>
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold text-[#C1121F] flex items-center gap-1">
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="px-4 py-2 border border-stone-200 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newGroupTitle.trim() || isCreatingGroup}
                  className="px-5 py-2 bg-[#C1121F] hover:bg-[#9B0E19] text-white rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-50 flex items-center gap-2 shadow-sm"
                >
                  {isCreatingGroup ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating Group...</span>
                    </>
                  ) : (
                    <>
                      <Users className="w-3.5 h-3.5" />
                      <span>Create Group</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 2. GROUP INFO & MEMBER LIST MODAL / DRAWER */}
      {/* ========================================== */}
      {showGroupInfoModal && activeConv && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="bg-white rounded-3xl border border-stone-200 max-w-lg w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#C1121F]" />
                <span>Group Information</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowGroupInfoModal(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Group Header: Avatar & Title (Admin can edit) */}
            <div className="flex flex-col items-center text-center space-y-3 p-4 bg-stone-50/70 border border-stone-200 rounded-2xl">
              <div className="relative group">
                <img
                  src={activeConv.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${activeConv.id}`}
                  alt="Group Icon"
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-stone-200 bg-white"
                />
                {isGroupAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => updateGroupAvatarInputRef.current?.click()}
                      className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition"
                      title="Change Group Icon"
                    >
                      <Camera className="w-5 h-5" />
                    </button>
                    <input
                      ref={updateGroupAvatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleUploadNewGroupAvatar}
                      className="hidden"
                    />
                  </>
                )}
              </div>

              {isEditingTitle ? (
                <div className="flex items-center gap-1.5 w-full max-w-xs">
                  <input
                    type="text"
                    value={editTitleValue}
                    onChange={(e) => setEditTitleValue(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-stone-300 rounded-xl text-xs text-stone-900 font-bold"
                  />
                  <button
                    type="button"
                    onClick={handleSaveGroupTitle}
                    disabled={isSavingTitle}
                    className="p-1.5 bg-[#C1121F] text-white rounded-lg text-xs"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingTitle(false)}
                    className="p-1.5 bg-stone-200 text-stone-700 rounded-lg text-xs"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 justify-center">
                  <h4 className="text-base font-bold text-stone-900">{activeConv.title || 'Project Group'}</h4>
                  {isGroupAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditTitleValue(activeConv.title || '');
                        setIsEditingTitle(true);
                      }}
                      className="p-1 text-stone-400 hover:text-stone-700"
                      title="Edit group name"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {activeConv.description && (
                <p className="text-xs text-stone-500 max-w-sm">{activeConv.description}</p>
              )}

              <span className="text-[10px] text-stone-400 font-mono">
                Created {new Date(activeConv.created_at || Date.now()).toLocaleDateString()}
              </span>
            </div>

            {/* Member List & Admin Controls */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                  Participants ({activeConversationDetail?.members?.length || activeConv.members?.length || 1})
                </span>

                {isGroupAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowAddMemberSection((prev) => !prev)}
                    className="text-xs text-[#C1121F] font-bold flex items-center gap-1 hover:underline"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Add Members</span>
                  </button>
                )}
              </div>

              {/* Add Member inline search (Admin only) */}
              {showAddMemberSection && isGroupAdmin && (
                <div className="p-3 bg-red-50/40 border border-red-200 rounded-xl space-y-2">
                  <input
                    type="text"
                    value={addMemberSearchQuery}
                    onChange={(e) => setAddMemberSearchQuery(e.target.value)}
                    placeholder="Search engineers to add to this group..."
                    className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#C1121F]"
                  />
                  {addMemberSearchResults.length > 0 && (
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {addMemberSearchResults.map((usr) => (
                        <div
                          key={usr.id}
                          onClick={() => handleAddMemberToActiveGroup(usr)}
                          className="flex items-center justify-between p-1.5 bg-white rounded-lg hover:bg-stone-50 cursor-pointer text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <img
                              src={usr.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${usr.id}`}
                              alt={usr.username}
                              className="w-5 h-5 rounded-full"
                            />
                            <span className="font-semibold text-stone-900">{usr.display_name || usr.full_name}</span>
                          </div>
                          <span className="text-[10px] font-bold text-[#C1121F]">+ Add</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Members List */}
              <div className="border border-stone-200 rounded-2xl divide-y divide-stone-100 max-h-56 overflow-y-auto">
                {(activeConversationDetail?.members || activeConv.members || []).map((m: GroupMemberInfo) => {
                  const isMemberAdmin = m.role === 'admin' || m.user_id === activeConv.admin_id;
                  const isCurrent = m.user_id === currentUserId;
                  const displayName = m.profile?.display_name || m.profile?.full_name || (isCurrent ? 'You' : 'Member');

                  return (
                    <div key={m.user_id} className="p-2.5 flex items-center justify-between hover:bg-stone-50/50">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={m.profile?.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${m.user_id}`}
                          alt={displayName}
                          className="w-8 h-8 rounded-full object-cover border border-stone-200"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-stone-900 truncate">
                            {displayName} {isCurrent && '(You)'}
                          </p>
                          <p className="text-[10px] text-stone-500 font-mono truncate">
                            @{m.profile?.username || 'engineer'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isMemberAdmin ? (
                          <span className="text-[9px] px-2 py-0.5 bg-red-100 text-[#C1121F] font-bold rounded-full border border-red-200 flex items-center gap-1">
                            <ShieldCheck className="w-2.5 h-2.5" />
                            <span>Admin</span>
                          </span>
                        ) : (
                          <span className="text-[9px] px-2 py-0.5 bg-stone-100 text-stone-600 font-medium rounded-full">
                            Member
                          </span>
                        )}

                        {isGroupAdmin && !isCurrent && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(m.user_id, displayName)}
                            className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title={`Remove ${displayName} from group`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Leave Group Action Button */}
            <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleLeaveGroup}
                disabled={isLeavingGroup}
                className="px-3.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition flex items-center gap-1.5"
              >
                <LogOut className="w-4 h-4" />
                <span>Leave Group</span>
              </button>

              <button
                type="button"
                onClick={() => setShowGroupInfoModal(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 3. FULLSCREEN IMAGE PREVIEW LIGHTBOX MODAL */}
      {/* ========================================== */}
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
