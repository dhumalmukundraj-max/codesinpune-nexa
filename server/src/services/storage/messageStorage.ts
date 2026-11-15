import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { supabaseAdmin } from '../../config/index.js';
import { profileStorage, UserProfileRecord } from './profileStorage.js';

function getDataDir(): string {
  const candidates = [
    path.resolve(process.cwd(), 'data/round3'),
    path.resolve(process.cwd(), 'server/data/round3'),
    path.join(os.tmpdir(), 'ernexa_round3'),
  ];

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) {
        fs.mkdirSync(candidate, { recursive: true });
      }
      const testFile = path.join(candidate, '.write_test_msg');
      fs.writeFileSync(testFile, 'ok', 'utf-8');
      fs.unlinkSync(testFile);
      return candidate;
    } catch {}
  }
  return '';
}

function getAttachmentsDir(conversationId: string): string {
  const base = getDataDir();
  const dir = path.join(base, 'attachments', conversationId);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {}
  return dir;
}

export type MessageType = 'text' | 'image' | 'document' | 'mixed';

export interface MessageAttachment {
  id: string;
  name: string;
  size: number;
  type: string; // MIME type
  category: 'image' | 'document';
  url: string; // View or download URL
  storage_path?: string;
  thumbnail_url?: string;
}

export interface MessageRecord {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id?: string;
  sender_name?: string;
  sender_avatar?: string;
  content: string;
  created_at: string;
  read_by?: string[];
  message_type?: MessageType;
  attachments?: MessageAttachment[];
  metadata?: Record<string, any>;
}

export interface GroupMemberInfo {
  user_id: string;
  role: 'admin' | 'member';
  joined_at?: string;
  profile?: UserProfileRecord;
}

export interface ConversationRecord {
  id: string;
  title?: string;
  is_group?: boolean;
  avatar_url?: string;
  admin_id?: string;
  description?: string;
  participant_ids: string[];
  roles?: Record<string, 'admin' | 'member'>;
  created_at: string;
  updated_at: string;
  last_message?: {
    content: string;
    sender_id: string;
    sender_name?: string;
    created_at: string;
    message_type?: MessageType;
    attachments_count?: number;
  };
}

export interface ConversationDetailView {
  id: string;
  title?: string;
  is_group: boolean;
  avatar_url?: string;
  admin_id?: string;
  description?: string;
  otherParticipant?: UserProfileRecord;
  members?: GroupMemberInfo[];
  lastMessage?: {
    content: string;
    sender_id: string;
    sender_name?: string;
    created_at: string;
    message_type?: MessageType;
    attachments_count?: number;
  };
  unreadCount: number;
  updated_at: string;
}

interface LocalMessengerState {
  conversations: ConversationRecord[];
  messages: MessageRecord[];
  reads: Record<string, string>; // `${convId}:${userId}` -> ISO timestamp
}

let inMemoryMessenger: LocalMessengerState = {
  conversations: [],
  messages: [],
  reads: {},
};

function readLocalMessenger(): LocalMessengerState {
  try {
    const dir = getDataDir();
    if (dir) {
      const file = path.join(dir, 'messenger_data.json');
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.conversations)) {
          inMemoryMessenger = parsed;
          return parsed;
        }
      }
    }
  } catch {}
  return inMemoryMessenger;
}

function writeLocalMessenger(state: LocalMessengerState) {
  inMemoryMessenger = state;
  try {
    const dir = getDataDir();
    if (dir) {
      const file = path.join(dir, 'messenger_data.json');
      fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf-8');
    }
  } catch {}
}

const ATTACHMENT_BUCKET = 'messenger-attachments';
let bucketInitialized = false;

async function ensureAttachmentBucket() {
  if (bucketInitialized || !supabaseAdmin) return;
  try {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === ATTACHMENT_BUCKET);
    if (!exists) {
      await supabaseAdmin.storage.createBucket(ATTACHMENT_BUCKET, {
        public: true, // Allows direct viewing with signed / public links
        fileSizeLimit: 30 * 1024 * 1024, // 30MB
      });
    }
    bucketInitialized = true;
  } catch (err) {
    // Non-fatal if bucket already exists or permissions handled out-of-band
  }
}

export const messageStorage = {
  /**
   * Retrieves or creates a 1-to-1 conversation between userA and userB
   */
  async getOrCreateDirectConversation(userA: string, userB: string): Promise<ConversationRecord> {
    const state = readLocalMessenger();

    // 1. Check in Supabase first (PRIMARY store)
    if (supabaseAdmin) {
      try {
        const { data: userAConvs } = await supabaseAdmin
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', userA);

        if (userAConvs && userAConvs.length > 0) {
          const convIds = userAConvs.map((c: any) => c.conversation_id);
          const { data: matched } = await supabaseAdmin
            .from('conversation_participants')
            .select('conversation_id')
            .eq('user_id', userB)
            .in('conversation_id', convIds);

          if (matched && matched.length > 0) {
            for (const m of matched) {
              const { data: convData } = await supabaseAdmin
                .from('conversations')
                .select('*')
                .eq('id', m.conversation_id)
                .single();

              if (convData && !convData.is_group) {
                const conv: ConversationRecord = {
                  id: convData.id,
                  title: convData.title,
                  is_group: false,
                  participant_ids: [userA, userB],
                  roles: { [userA]: 'member', [userB]: 'member' },
                  created_at: convData.created_at || new Date().toISOString(),
                  updated_at: convData.updated_at || new Date().toISOString(),
                };
                const existingIdx = state.conversations.findIndex((c) => c.id === conv.id);
                if (existingIdx >= 0) {
                  state.conversations[existingIdx] = conv;
                } else {
                  state.conversations.push(conv);
                }
                writeLocalMessenger(state);
                return conv;
              }
            }
          }
        }

        // Create new direct conversation in Supabase
        const convId = crypto.randomUUID();
        const now = new Date().toISOString();
        const { data: newConv } = await supabaseAdmin
          .from('conversations')
          .insert({
            id: convId,
            is_group: false,
            created_at: now,
            updated_at: now,
          })
          .select()
          .maybeSingle();

        const effectiveId = newConv?.id || convId;
        await supabaseAdmin.from('conversation_participants').insert([
          { conversation_id: effectiveId, user_id: userA, role: 'member' },
          { conversation_id: effectiveId, user_id: userB, role: 'member' },
        ]);

        const conv: ConversationRecord = {
          id: effectiveId,
          is_group: false,
          participant_ids: [userA, userB],
          roles: { [userA]: 'member', [userB]: 'member' },
          created_at: newConv?.created_at || now,
          updated_at: newConv?.updated_at || now,
        };
        const existingIdx = state.conversations.findIndex((c) => c.id === conv.id);
        if (existingIdx >= 0) {
          state.conversations[existingIdx] = conv;
        } else {
          state.conversations.push(conv);
        }
        writeLocalMessenger(state);
        return conv;
      } catch (err: any) {
        console.warn('[Er.NEXA messageStorage] Supabase direct conv lookup/create fallback:', err.message);
      }
    }

    // 2. Check if direct conversation already exists in local fallback state
    const existing = state.conversations.find((c) =>
      !c.is_group &&
      c.participant_ids.length === 2 &&
      c.participant_ids.includes(userA) &&
      c.participant_ids.includes(userB)
    );

    if (existing) {
      return existing;
    }

    // Local fallback creation
    const newConv: ConversationRecord = {
      id: crypto.randomUUID(),
      is_group: false,
      participant_ids: [userA, userB],
      roles: { [userA]: 'member', [userB]: 'member' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    state.conversations.push(newConv);
    writeLocalMessenger(state);
    return newConv;
  },

  /**
   * Creates a WhatsApp-like group conversation with multiple members and admin role
   */
  async createGroupConversation(
    creatorId: string,
    title: string,
    memberIds: string[],
    avatarUrl?: string,
    description?: string
  ): Promise<ConversationDetailView> {
    const state = readLocalMessenger();
    const now = new Date().toISOString();
    const convId = crypto.randomUUID();

    const cleanTitle = (title || 'Er.NEXA Project Group').trim();
    const allMemberIds = Array.from(new Set([creatorId, ...memberIds.filter(Boolean)]));
    const roleMap: Record<string, 'admin' | 'member'> = {};
    allMemberIds.forEach((uid) => {
      roleMap[uid] = uid === creatorId ? 'admin' : 'member';
    });

    const finalAvatar = avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${convId}`;

    // 1. Try Supabase
    if (supabaseAdmin) {
      try {
        const { data: newConv, error: convErr } = await supabaseAdmin
          .from('conversations')
          .insert({
            id: convId,
            title: cleanTitle,
            is_group: true,
            avatar_url: finalAvatar,
            admin_id: creatorId,
            description: description || '',
            created_at: now,
            updated_at: now,
          })
          .select()
          .single();

        if (newConv && !convErr) {
          const participantInserts = allMemberIds.map((uid) => ({
            conversation_id: convId,
            user_id: uid,
            role: roleMap[uid],
          }));
          await supabaseAdmin.from('conversation_participants').insert(participantInserts);
        } else if (convErr) {
          // If extended columns are not present yet in schema, fallback to basic fields
          await supabaseAdmin.from('conversations').insert({
            id: convId,
            title: cleanTitle,
            is_group: true,
            created_at: now,
            updated_at: now,
          });
          const basicParticipants = allMemberIds.map((uid) => ({
            conversation_id: convId,
            user_id: uid,
          }));
          await supabaseAdmin.from('conversation_participants').insert(basicParticipants);
        }
      } catch (err: any) {
        console.warn('[Er.NEXA messageStorage] Supabase group create warning:', err.message);
      }
    }

    // 2. Local State
    const convRecord: ConversationRecord = {
      id: convId,
      title: cleanTitle,
      is_group: true,
      avatar_url: finalAvatar,
      admin_id: creatorId,
      description: description || '',
      participant_ids: allMemberIds,
      roles: roleMap,
      created_at: now,
      updated_at: now,
    };
    state.conversations.push(convRecord);

    // Initial group creation system announcement
    const creatorProf = await profileStorage.getProfile(creatorId);
    const creatorName = creatorProf.display_name || creatorProf.full_name || `@${creatorProf.username || 'admin'}`;
    const initialMessage: MessageRecord = {
      id: crypto.randomUUID(),
      conversation_id: convId,
      sender_id: creatorId,
      sender_name: creatorName,
      sender_avatar: creatorProf.avatar_url,
      content: `🎉 ${creatorName} created group "${cleanTitle}"`,
      created_at: now,
      message_type: 'text',
      attachments: [],
      metadata: { is_system_announcement: true },
    };

    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('messages').insert({
          id: initialMessage.id,
          conversation_id: convId,
          sender_id: creatorId,
          content: initialMessage.content,
          message_type: 'text',
          attachments: [],
          metadata: initialMessage.metadata,
          created_at: now,
        });
      } catch {}
    }

    state.messages.push(initialMessage);
    convRecord.last_message = {
      content: initialMessage.content,
      sender_id: creatorId,
      sender_name: creatorName,
      created_at: now,
      message_type: 'text',
    };
    state.reads[`${convId}:${creatorId}`] = now;
    writeLocalMessenger(state);

    // Build return detail view
    const members: GroupMemberInfo[] = [];
    for (const pid of allMemberIds) {
      const p = await profileStorage.getProfile(pid);
      members.push({
        user_id: pid,
        role: roleMap[pid],
        profile: p,
      });
    }

    return {
      id: convId,
      title: cleanTitle,
      is_group: true,
      avatar_url: finalAvatar,
      admin_id: creatorId,
      description: description || '',
      members,
      lastMessage: convRecord.last_message,
      unreadCount: 0,
      updated_at: now,
    };
  },

  /**
   * Adds new members to an existing group conversation (Admin only)
   */
  async addGroupMembers(
    conversationId: string,
    requesterId: string,
    newMemberIds: string[]
  ): Promise<ConversationDetailView> {
    const state = readLocalMessenger();
    const conv = state.conversations.find((c) => c.id === conversationId);
    if (!conv) {
      throw new Error('Conversation not found.');
    }
    if (!conv.is_group) {
      throw new Error('Cannot add members to an individual direct chat.');
    }

    const requesterRole = conv.roles?.[requesterId] || (conv.admin_id === requesterId ? 'admin' : 'member');
    if (requesterRole !== 'admin') {
      throw new Error('Only group administrators can add new members.');
    }

    const uniqueNewIds = newMemberIds.filter((id) => !conv.participant_ids.includes(id) && Boolean(id));
    if (uniqueNewIds.length === 0) {
      return this.getConversation(conversationId, requesterId);
    }

    const now = new Date().toISOString();
    uniqueNewIds.forEach((uid) => {
      conv.participant_ids.push(uid);
      if (!conv.roles) conv.roles = {};
      conv.roles[uid] = 'member';
    });
    conv.updated_at = now;

    if (supabaseAdmin) {
      try {
        const rows = uniqueNewIds.map((uid) => ({
          conversation_id: conversationId,
          user_id: uid,
          role: 'member',
        }));
        await supabaseAdmin.from('conversation_participants').insert(rows);
      } catch (err: any) {
        console.warn('[Er.NEXA messageStorage] Supabase add member notice:', err.message);
      }
    }

    const requesterProf = await profileStorage.getProfile(requesterId);
    const addedProfiles = await Promise.all(uniqueNewIds.map((id) => profileStorage.getProfile(id)));
    const addedNames = addedProfiles.map((p) => p.display_name || p.full_name || `@${p.username}`).join(', ');

    const sysMsg: MessageRecord = {
      id: crypto.randomUUID(),
      conversation_id: conversationId,
      sender_id: requesterId,
      sender_name: requesterProf.display_name || requesterProf.full_name,
      sender_avatar: requesterProf.avatar_url,
      content: `👋 ${requesterProf.display_name || 'Admin'} added ${addedNames} to the group`,
      created_at: now,
      message_type: 'text',
      attachments: [],
      metadata: { is_system_announcement: true },
    };

    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('messages').insert({
          id: sysMsg.id,
          conversation_id: conversationId,
          sender_id: requesterId,
          content: sysMsg.content,
          message_type: 'text',
          attachments: [],
          metadata: sysMsg.metadata,
          created_at: now,
        });
      } catch {}
    }

    state.messages.push(sysMsg);
    conv.last_message = {
      content: sysMsg.content,
      sender_id: requesterId,
      sender_name: requesterProf.display_name,
      created_at: now,
      message_type: 'text',
    };
    writeLocalMessenger(state);

    return this.getConversation(conversationId, requesterId);
  },

  /**
   * Removes a member from group (Admin) OR allows a user to leave the group
   */
  async removeGroupMember(
    conversationId: string,
    requesterId: string,
    memberIdToRemove: string
  ): Promise<{ success: boolean; left: boolean }> {
    const state = readLocalMessenger();
    const conv = state.conversations.find((c) => c.id === conversationId);
    if (!conv) {
      throw new Error('Conversation not found.');
    }
    if (!conv.is_group) {
      throw new Error('Cannot remove members from an individual chat.');
    }

    const isSelfLeaving = requesterId === memberIdToRemove;
    const requesterRole = conv.roles?.[requesterId] || (conv.admin_id === requesterId ? 'admin' : 'member');

    if (!isSelfLeaving && requesterRole !== 'admin') {
      throw new Error('Only group administrators can remove members.');
    }

    const now = new Date().toISOString();
    conv.participant_ids = conv.participant_ids.filter((id) => id !== memberIdToRemove);
    if (conv.roles) delete conv.roles[memberIdToRemove];
    conv.updated_at = now;

    // If leaving member was admin, transfer admin rights to the next available participant
    if (conv.admin_id === memberIdToRemove && conv.participant_ids.length > 0) {
      const nextAdmin = conv.participant_ids[0];
      conv.admin_id = nextAdmin;
      if (!conv.roles) conv.roles = {};
      conv.roles[nextAdmin] = 'admin';

      if (supabaseAdmin) {
        try {
          await supabaseAdmin
            .from('conversations')
            .update({ admin_id: nextAdmin })
            .eq('id', conversationId);
          await supabaseAdmin
            .from('conversation_participants')
            .update({ role: 'admin' })
            .match({ conversation_id: conversationId, user_id: nextAdmin });
        } catch {}
      }
    }

    if (supabaseAdmin) {
      try {
        await supabaseAdmin
          .from('conversation_participants')
          .delete()
          .match({ conversation_id: conversationId, user_id: memberIdToRemove });
      } catch (err: any) {
        console.warn('[Er.NEXA messageStorage] Supabase remove member notice:', err.message);
      }
    }

    const removedProf = await profileStorage.getProfile(memberIdToRemove);
    const requesterProf = await profileStorage.getProfile(requesterId);
    const content = isSelfLeaving
      ? `🚪 ${removedProf.display_name || 'A member'} left the group`
      : `🚫 ${requesterProf.display_name || 'Admin'} removed ${removedProf.display_name || 'a member'} from the group`;

    const sysMsg: MessageRecord = {
      id: crypto.randomUUID(),
      conversation_id: conversationId,
      sender_id: requesterId,
      sender_name: requesterProf.display_name || requesterProf.full_name,
      sender_avatar: requesterProf.avatar_url,
      content,
      created_at: now,
      message_type: 'text',
      attachments: [],
      metadata: { is_system_announcement: true },
    };

    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('messages').insert({
          id: sysMsg.id,
          conversation_id: conversationId,
          sender_id: requesterId,
          content: sysMsg.content,
          message_type: 'text',
          attachments: [],
          metadata: sysMsg.metadata,
          created_at: now,
        });
      } catch {}
    }

    state.messages.push(sysMsg);
    conv.last_message = {
      content: sysMsg.content,
      sender_id: requesterId,
      sender_name: requesterProf.display_name,
      created_at: now,
      message_type: 'text',
    };
    writeLocalMessenger(state);

    return { success: true, left: isSelfLeaving };
  },

  /**
   * Updates group details (subject/title, avatar_url, description)
   */
  async updateGroupDetails(
    conversationId: string,
    requesterId: string,
    updates: { title?: string; avatar_url?: string; description?: string }
  ): Promise<ConversationDetailView> {
    const state = readLocalMessenger();
    const conv = state.conversations.find((c) => c.id === conversationId);
    if (!conv) throw new Error('Conversation not found.');
    if (!conv.is_group) throw new Error('Cannot update group details on direct chat.');
    if (!conv.participant_ids.includes(requesterId)) throw new Error('Access denied.');

    const now = new Date().toISOString();
    const oldTitle = conv.title;
    if (updates.title !== undefined && updates.title.trim()) {
      conv.title = updates.title.trim();
    }
    if (updates.avatar_url !== undefined && updates.avatar_url.trim()) {
      conv.avatar_url = updates.avatar_url.trim();
    }
    if (updates.description !== undefined) {
      conv.description = updates.description.trim();
    }
    conv.updated_at = now;

    if (supabaseAdmin) {
      try {
        await supabaseAdmin
          .from('conversations')
          .update({
            title: conv.title,
            avatar_url: conv.avatar_url,
            description: conv.description,
            updated_at: now,
          })
          .eq('id', conversationId);
      } catch (err: any) {
        console.warn('[Er.NEXA messageStorage] Supabase group update notice:', err.message);
      }
    }

    if (updates.title && updates.title.trim() !== oldTitle) {
      const requesterProf = await profileStorage.getProfile(requesterId);
      const sysMsg: MessageRecord = {
        id: crypto.randomUUID(),
        conversation_id: conversationId,
        sender_id: requesterId,
        sender_name: requesterProf.display_name || requesterProf.full_name,
        sender_avatar: requesterProf.avatar_url,
        content: `✏️ ${requesterProf.display_name || 'Admin'} changed group name to "${conv.title}"`,
        created_at: now,
        message_type: 'text',
        attachments: [],
        metadata: { is_system_announcement: true },
      };
      state.messages.push(sysMsg);
      conv.last_message = {
        content: sysMsg.content,
        sender_id: requesterId,
        sender_name: requesterProf.display_name,
        created_at: now,
        message_type: 'text',
      };
    }

    writeLocalMessenger(state);
    return this.getConversation(conversationId, requesterId);
  },

  /**
   * Retrieves full details for a conversation (individual or group)
   */
  async getConversation(conversationId: string, userId: string): Promise<ConversationDetailView> {
    const state = readLocalMessenger();
    let conv = state.conversations.find((c) => c.id === conversationId);

    // If not in local state, try loading from Supabase
    if (!conv && supabaseAdmin) {
      try {
        const { data: convData } = await supabaseAdmin
          .from('conversations')
          .select('*')
          .eq('id', conversationId)
          .single();

        if (convData) {
          const { data: participants } = await supabaseAdmin
            .from('conversation_participants')
            .select('user_id, role')
            .eq('conversation_id', conversationId);

          const pIds = (participants || []).map((p: any) => p.user_id);
          const roleMap: Record<string, 'admin' | 'member'> = {};
          (participants || []).forEach((p: any) => {
            roleMap[p.user_id] = p.role || 'member';
          });

          conv = {
            id: convData.id,
            title: convData.title,
            is_group: Boolean(convData.is_group),
            avatar_url: convData.avatar_url,
            admin_id: convData.admin_id,
            description: convData.description,
            participant_ids: pIds,
            roles: roleMap,
            created_at: convData.created_at,
            updated_at: convData.updated_at,
          };
          state.conversations.push(conv);
          writeLocalMessenger(state);
        }
      } catch {}
    }

    if (!conv || !conv.participant_ids.includes(userId)) {
      throw new Error('Conversation not found or access denied.');
    }

    const lastRead = state.reads[`${conv.id}:${userId}`] || '1970-01-01';
    let unreadCount = state.messages.filter(
      (m) => m.conversation_id === conv.id && m.sender_id !== userId && m.created_at > lastRead
    ).length;

    // Fetch latest message and accurate unread count from Supabase if available
    if (supabaseAdmin) {
      try {
        const { data: recentMsgs } = await supabaseAdmin
          .from('messages')
          .select('id, conversation_id, sender_id, receiver_id, content, attachments, message_type, metadata, created_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (recentMsgs && recentMsgs.length > 0) {
          const latestMsg = recentMsgs[0];
          const sProf = await profileStorage.getProfile(latestMsg.sender_id);
          const atts = latestMsg.attachments || latestMsg.metadata?.attachments || [];
          conv.last_message = {
            content: latestMsg.content || (atts.length > 0 ? `Shared ${atts.length} file(s)` : 'New message'),
            sender_id: latestMsg.sender_id,
            sender_name: sProf.display_name || sProf.full_name || `@${sProf.username || 'user'}`,
            created_at: latestMsg.created_at,
            message_type: latestMsg.message_type || (atts.length > 0 ? 'mixed' : 'text'),
            attachments_count: atts.length,
          };
          unreadCount = recentMsgs.filter(
            (m: any) => m.sender_id !== userId && m.created_at > lastRead
          ).length;
        }
      } catch {}
    }

    if (conv.is_group) {
      const members: GroupMemberInfo[] = [];
      for (const pid of conv.participant_ids) {
        const prof = await profileStorage.getProfile(pid);
        const role = (conv.roles && conv.roles[pid]) || (conv.admin_id === pid ? 'admin' : 'member');
        members.push({
          user_id: pid,
          role,
          profile: prof,
        });
      }

      return {
        id: conv.id,
        title: conv.title || 'Project Group',
        is_group: true,
        avatar_url: conv.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${conv.id}`,
        admin_id: conv.admin_id,
        description: conv.description,
        members,
        lastMessage: conv.last_message,
        unreadCount,
        updated_at: conv.updated_at,
      };
    } else {
      const otherId = conv.participant_ids.find((id) => id !== userId) || userId;
      const otherProfile = await profileStorage.getProfile(otherId);

      return {
        id: conv.id,
        is_group: false,
        otherParticipant: otherProfile,
        lastMessage: conv.last_message,
        unreadCount,
        updated_at: conv.updated_at,
      };
    }
  },

  /**
   * Retrieves conversation list for a user with participant profiles, groups and unread count
   */
  async getUserConversations(userId: string): Promise<ConversationDetailView[]> {
    const state = readLocalMessenger();
    const viewsMap = new Map<string, ConversationDetailView>();

    // 1. Supabase as PRIMARY persistent database
    if (supabaseAdmin) {
      try {
        const { data: userParticipantRows, error: pErr } = await supabaseAdmin
          .from('conversation_participants')
          .select('conversation_id, role, last_read_at')
          .eq('user_id', userId);

        if (!pErr && userParticipantRows && userParticipantRows.length > 0) {
          const convIds = userParticipantRows.map((r: any) => r.conversation_id);
          const userReadMap = new Map<string, string>();
          userParticipantRows.forEach((r: any) => {
            if (r.last_read_at) {
              userReadMap.set(r.conversation_id, r.last_read_at);
              state.reads[`${r.conversation_id}:${userId}`] = r.last_read_at;
            }
          });

          // Discrete resilient query for conversations (no problematic nested foreign key embeds)
          const { data: convRows, error: cErr } = await supabaseAdmin
            .from('conversations')
            .select('id, title, is_group, avatar_url, admin_id, description, created_at, updated_at')
            .in('id', convIds);

          if (!cErr && convRows && convRows.length > 0) {
            // Discrete query for all participants in these conversations
            const { data: allParticipants } = await supabaseAdmin
              .from('conversation_participants')
              .select('conversation_id, user_id, role')
              .in('conversation_id', convIds);

            // Discrete query for recent messages
            const { data: messagesData } = await supabaseAdmin
              .from('messages')
              .select('id, conversation_id, sender_id, receiver_id, content, attachments, message_type, metadata, created_at')
              .in('conversation_id', convIds)
              .order('created_at', { ascending: false });

            const latestMsgByConv = new Map<string, any>();
            const unreadByConv = new Map<string, number>();

            if (messagesData) {
              for (const m of messagesData) {
                if (!latestMsgByConv.has(m.conversation_id)) {
                  latestMsgByConv.set(m.conversation_id, m);
                }
                const lastRead = userReadMap.get(m.conversation_id) || state.reads[`${m.conversation_id}:${userId}`] || '1970-01-01';
                if (m.sender_id !== userId && new Date(m.created_at).getTime() > new Date(lastRead).getTime()) {
                  unreadByConv.set(m.conversation_id, (unreadByConv.get(m.conversation_id) || 0) + 1);
                }
              }
            }

            const participantsByConv = new Map<string, Array<{ user_id: string; role: 'admin' | 'member' }>>();
            (allParticipants || []).forEach((p: any) => {
              const list = participantsByConv.get(p.conversation_id) || [];
              list.push({ user_id: p.user_id, role: p.role || 'member' });
              participantsByConv.set(p.conversation_id, list);
            });

            for (const conv of convRows) {
              const parts = participantsByConv.get(conv.id) || [{ user_id: userId, role: 'member' }];
              const pIds = parts.map((p) => p.user_id);
              const roleMap: Record<string, 'admin' | 'member'> = {};
              parts.forEach((p) => { roleMap[p.user_id] = p.role; });

              const existingIdx = state.conversations.findIndex((c) => c.id === conv.id);
              const convRecord: ConversationRecord = {
                id: conv.id,
                title: conv.title,
                is_group: Boolean(conv.is_group),
                avatar_url: conv.avatar_url,
                admin_id: conv.admin_id,
                description: conv.description,
                participant_ids: pIds,
                roles: roleMap,
                created_at: conv.created_at || new Date().toISOString(),
                updated_at: conv.updated_at || new Date().toISOString(),
              };

              const rawLastMsg = latestMsgByConv.get(conv.id);
              if (rawLastMsg) {
                const senderProf = await profileStorage.getProfile(rawLastMsg.sender_id);
                const senderName = senderProf.display_name || senderProf.full_name || `@${senderProf.username || 'user'}`;
                const rawAttachments = rawLastMsg.attachments || rawLastMsg.metadata?.attachments || [];
                const attCount = Array.isArray(rawAttachments) ? rawAttachments.length : 0;
                convRecord.last_message = {
                  content: rawLastMsg.content || (attCount > 0 ? `Shared ${attCount} file(s)` : 'New message'),
                  sender_id: rawLastMsg.sender_id,
                  sender_name: senderName,
                  created_at: rawLastMsg.created_at,
                  message_type: rawLastMsg.message_type || (attCount > 0 ? 'mixed' : 'text'),
                  attachments_count: attCount,
                };
              }

              if (existingIdx >= 0) {
                state.conversations[existingIdx] = {
                  ...state.conversations[existingIdx],
                  ...convRecord,
                  last_message: convRecord.last_message || state.conversations[existingIdx].last_message,
                };
              } else {
                state.conversations.push(convRecord);
              }

              const unreadCount = unreadByConv.get(conv.id) || 0;

              if (conv.is_group) {
                const members: GroupMemberInfo[] = [];
                for (const pid of pIds) {
                  const prof = await profileStorage.getProfile(pid);
                  members.push({
                    user_id: pid,
                    role: roleMap[pid] || (conv.admin_id === pid ? 'admin' : 'member'),
                    profile: prof,
                  });
                }

                viewsMap.set(conv.id, {
                  id: conv.id,
                  title: conv.title || 'Project Group',
                  is_group: true,
                  avatar_url: conv.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${conv.id}`,
                  admin_id: conv.admin_id,
                  description: conv.description,
                  members,
                  lastMessage: convRecord.last_message,
                  unreadCount,
                  updated_at: conv.updated_at || conv.created_at || new Date().toISOString(),
                });
              } else {
                const otherId = pIds.find((id) => id !== userId) || userId;
                const otherProfile = await profileStorage.getProfile(otherId);

                viewsMap.set(conv.id, {
                  id: conv.id,
                  is_group: false,
                  otherParticipant: otherProfile,
                  lastMessage: convRecord.last_message,
                  unreadCount,
                  updated_at: conv.updated_at || conv.created_at || new Date().toISOString(),
                });
              }
            }
            writeLocalMessenger(state);
          }
        }
      } catch (err: any) {
        console.warn('[Er.NEXA messageStorage] Supabase getUserConversations warning:', err.message);
      }
    }

    // 2. Fallback merge with local state cache
    const userConvs = state.conversations.filter((c) => c.participant_ids.includes(userId));
    for (const c of userConvs) {
      if (!viewsMap.has(c.id)) {
        const lastRead = state.reads[`${c.id}:${userId}`] || '1970-01-01';
        const unreadCount = state.messages.filter(
          (m) => m.conversation_id === c.id && m.sender_id !== userId && m.created_at > lastRead
        ).length;

        if (c.is_group) {
          const members: GroupMemberInfo[] = [];
          for (const pid of c.participant_ids) {
            const prof = await profileStorage.getProfile(pid);
            const role = (c.roles && c.roles[pid]) || (c.admin_id === pid ? 'admin' : 'member');
            members.push({
              user_id: pid,
              role,
              profile: prof,
            });
          }

          viewsMap.set(c.id, {
            id: c.id,
            title: c.title || 'Project Group',
            is_group: true,
            avatar_url: c.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${c.id}`,
            admin_id: c.admin_id,
            description: c.description,
            members,
            lastMessage: c.last_message,
            unreadCount,
            updated_at: c.updated_at,
          });
        } else {
          const otherId = c.participant_ids.find((id) => id !== userId) || userId;
          const otherProfile = await profileStorage.getProfile(otherId);

          viewsMap.set(c.id, {
            id: c.id,
            is_group: false,
            otherParticipant: otherProfile,
            lastMessage: c.last_message,
            unreadCount,
            updated_at: c.updated_at,
          });
        }
      }
    }

    const views = Array.from(viewsMap.values());
    return views.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  },

  /**
   * Retrieves ordered messages for a conversation, populating sender identity
   */
  async getMessages(conversationId: string, userId: string): Promise<MessageRecord[]> {
    const state = readLocalMessenger();
    let conv = state.conversations.find((c) => c.id === conversationId);

    // If conversation not in local state, check Supabase
    if (!conv && supabaseAdmin) {
      try {
        const { data: convData } = await supabaseAdmin
          .from('conversations')
          .select('*')
          .eq('id', conversationId)
          .single();
        if (convData) {
          const { data: pData } = await supabaseAdmin
            .from('conversation_participants')
            .select('user_id, role')
            .eq('conversation_id', conversationId);
          const pIds = (pData || []).map((p: any) => p.user_id);
          const roleMap: Record<string, 'admin' | 'member'> = {};
          (pData || []).forEach((p: any) => { roleMap[p.user_id] = p.role || 'member'; });

          conv = {
            id: convData.id,
            title: convData.title,
            is_group: Boolean(convData.is_group),
            avatar_url: convData.avatar_url,
            admin_id: convData.admin_id,
            description: convData.description,
            participant_ids: pIds,
            roles: roleMap,
            created_at: convData.created_at,
            updated_at: convData.updated_at,
          };
          state.conversations.push(conv);
          writeLocalMessenger(state);
        }
      } catch {}
    }

    // Participant verification
    if (conv && !conv.participant_ids.includes(userId)) {
      throw new Error('Access denied to this conversation.');
    }

    // Mark as read in local cache and Supabase Database
    const nowIso = new Date().toISOString();
    state.reads[`${conversationId}:${userId}`] = nowIso;
    writeLocalMessenger(state);

    if (supabaseAdmin) {
      try {
        await supabaseAdmin
          .from('conversation_participants')
          .update({ last_read_at: nowIso })
          .match({ conversation_id: conversationId, user_id: userId });
      } catch (err: any) {
        console.warn('[Er.NEXA messageStorage] Supabase getMessages mark read warning:', err.message);
      }
    }

    let fetchedMessages: MessageRecord[] = [];

    // Query Supabase messages as PRIMARY store
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('messages')
          .select('id, conversation_id, sender_id, receiver_id, content, attachments, message_type, metadata, created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })
          .limit(500);

        if (data && data.length > 0 && !error) {
          fetchedMessages = data.map((m: any) => {
            const rawAttachments = m.attachments || m.metadata?.attachments || [];
            return {
              id: m.id,
              conversation_id: m.conversation_id,
              sender_id: m.sender_id,
              receiver_id: m.receiver_id || undefined,
              content: m.content || '',
              message_type: m.message_type || (rawAttachments.length > 0 ? 'mixed' : 'text'),
              attachments: rawAttachments,
              metadata: m.metadata || {},
              created_at: m.created_at,
            };
          });

          // Sync into local state messages
          for (const fm of fetchedMessages) {
            const exists = state.messages.some((sm) => sm.id === fm.id);
            if (!exists) {
              state.messages.push(fm);
            }
          }
          writeLocalMessenger(state);
        }
      } catch (err: any) {
        console.warn('[Er.NEXA messageStorage] Supabase getMessages warning:', err.message);
      }
    }

    if (fetchedMessages.length === 0) {
      fetchedMessages = state.messages
        .filter((m) => m.conversation_id === conversationId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(a.created_at).getTime());
    }

    // Ensure sender display name and avatar are populated for group chat clarity
    const profileCache = new Map<string, UserProfileRecord>();
    for (const msg of fetchedMessages) {
      if (!msg.sender_name || !msg.sender_avatar) {
        let prof = profileCache.get(msg.sender_id);
        if (!prof) {
          prof = await profileStorage.getProfile(msg.sender_id);
          profileCache.set(msg.sender_id, prof);
        }
        msg.sender_name = msg.sender_name || prof.display_name || prof.full_name || `@${prof.username || 'engineer'}`;
        msg.sender_avatar = msg.sender_avatar || prof.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${msg.sender_id}`;
      }
    }

    return fetchedMessages;
  },

  /**
   * Uploads raw uploaded files to Supabase Storage and local fallback,
   * returning normalized MessageAttachment objects.
   */
  async processAttachments(
    conversationId: string,
    files: Array<{ originalname: string; mimetype: string; size: number; buffer: Buffer }>
  ): Promise<MessageAttachment[]> {
    await ensureAttachmentBucket();
    const attachments: MessageAttachment[] = [];
    const localDir = getAttachmentsDir(conversationId);

    for (const f of files) {
      const attachmentId = crypto.randomUUID();
      const sanitizedName = f.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const isImage = f.mimetype.startsWith('image/');
      const category: 'image' | 'document' = isImage ? 'image' : 'document';
      const storagePath = `conversations/${conversationId}/${Date.now()}-${attachmentId.slice(0, 8)}-${sanitizedName}`;

      let publicUrl = `/api/messages/conversations/${conversationId}/attachments/${attachmentId}/download`;

      // 1. Try Supabase Storage upload
      if (supabaseAdmin) {
        try {
          const { error: uploadErr } = await supabaseAdmin.storage
            .from(ATTACHMENT_BUCKET)
            .upload(storagePath, f.buffer, {
              contentType: f.mimetype,
              upsert: true,
            });

          if (!uploadErr) {
            const { data: urlData } = supabaseAdmin.storage
              .from(ATTACHMENT_BUCKET)
              .getPublicUrl(storagePath);

            if (urlData?.publicUrl) {
              publicUrl = urlData.publicUrl;
            }
          }
        } catch (storageErr) {
          console.warn('[Er.NEXA messageStorage] Supabase storage upload warning:', storageErr);
        }
      }

      // 2. Always write to local fallback attachments folder for offline resilience
      try {
        const localFilePath = path.join(localDir, `${attachmentId}_${sanitizedName}`);
        fs.writeFileSync(localFilePath, f.buffer);
      } catch {}

      attachments.push({
        id: attachmentId,
        name: f.originalname,
        size: f.size,
        type: f.mimetype,
        category,
        url: publicUrl,
        storage_path: storagePath,
      });
    }

    return attachments;
  },

  /**
   * Uploads group avatar image to Supabase Storage or local fallback
   */
  async uploadGroupAvatar(
    conversationId: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer }
  ): Promise<string> {
    await ensureAttachmentBucket();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const storagePath = `groups/${conversationId}/avatar-${Date.now()}-${sanitizedName}`;
    let avatarUrl = '';

    if (supabaseAdmin) {
      try {
        const { error } = await supabaseAdmin.storage
          .from(ATTACHMENT_BUCKET)
          .upload(storagePath, file.buffer, {
            contentType: file.mimetype,
            upsert: true,
          });
        if (!error) {
          const { data } = supabaseAdmin.storage
            .from(ATTACHMENT_BUCKET)
            .getPublicUrl(storagePath);
          if (data?.publicUrl) {
            avatarUrl = data.publicUrl;
          }
        }
      } catch {}
    }

    if (!avatarUrl) {
      const localDir = getAttachmentsDir(conversationId);
      const filename = `avatar_${Date.now()}_${sanitizedName}`;
      fs.writeFileSync(path.join(localDir, filename), file.buffer);
      avatarUrl = `/api/messages/conversations/${conversationId}/attachments/${filename}/download`;
    }

    return avatarUrl;
  },

  /**
   * Sends a message with optional text content and optional attachments
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    attachments: MessageAttachment[] = []
  ): Promise<MessageRecord> {
    const state = readLocalMessenger();
    let conv = state.conversations.find((c) => c.id === conversationId);

    // If conv not cached locally, look up from Supabase
    if (!conv && supabaseAdmin) {
      try {
        const { data: convData } = await supabaseAdmin
          .from('conversations')
          .select('*')
          .eq('id', conversationId)
          .single();
        if (convData) {
          const { data: pData } = await supabaseAdmin
            .from('conversation_participants')
            .select('user_id, role')
            .eq('conversation_id', conversationId);
          const pIds = (pData || []).map((p: any) => p.user_id);
          const roleMap: Record<string, 'admin' | 'member'> = {};
          (pData || []).forEach((p: any) => { roleMap[p.user_id] = p.role || 'member'; });

          conv = {
            id: convData.id,
            title: convData.title,
            is_group: Boolean(convData.is_group),
            avatar_url: convData.avatar_url,
            admin_id: convData.admin_id,
            description: convData.description,
            participant_ids: pIds,
            roles: roleMap,
            created_at: convData.created_at,
            updated_at: convData.updated_at,
          };
          state.conversations.push(conv);
          writeLocalMessenger(state);
        }
      } catch {}
    }

    if (conv && !conv.participant_ids.includes(senderId)) {
      throw new Error('You are not a participant in this conversation.');
    }

    // Determine receiver_id for direct 1-to-1 conversation
    let receiverId: string | undefined = undefined;
    if (conv && !conv.is_group) {
      receiverId = conv.participant_ids.find((id) => id !== senderId);
    } else if (!conv && supabaseAdmin) {
      try {
        const { data: pData } = await supabaseAdmin
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', conversationId);
        const other = (pData || []).find((p: any) => p.user_id !== senderId);
        if (other) receiverId = other.user_id;
      } catch {}
    }

    const now = new Date().toISOString();
    const messageId = crypto.randomUUID();
    const senderProfile = await profileStorage.getProfile(senderId);

    // Determine message type
    let messageType: MessageType = 'text';
    if (attachments.length > 0) {
      const hasImages = attachments.some((a) => a.category === 'image');
      const hasDocs = attachments.some((a) => a.category === 'document');
      const hasText = Boolean(content && content.trim());

      if (hasText) {
        messageType = 'mixed';
      } else if (hasImages && hasDocs) {
        messageType = 'mixed';
      } else if (hasImages) {
        messageType = 'image';
      } else {
        messageType = 'document';
      }
    }

    const senderDisplayName = senderProfile.display_name || senderProfile.full_name || `@${senderProfile.username || 'engineer'}`;
    const message: MessageRecord = {
      id: messageId,
      conversation_id: conversationId,
      sender_id: senderId,
      receiver_id: receiverId,
      sender_name: senderDisplayName,
      sender_avatar: senderProfile.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${senderId}`,
      content: content ? content.trim() : '',
      created_at: now,
      message_type: messageType,
      attachments,
      metadata: {
        attachments,
        message_type: messageType,
      },
    };

    // Save in Supabase as PRIMARY store
    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('messages').insert({
          id: messageId,
          conversation_id: conversationId,
          sender_id: senderId,
          receiver_id: receiverId || null,
          content: message.content,
          attachments: message.attachments,
          message_type: messageType,
          metadata: message.metadata,
          created_at: now,
        });

        await supabaseAdmin
          .from('conversations')
          .update({ updated_at: now })
          .eq('id', conversationId);
      } catch (err: any) {
        console.warn('[Er.NEXA messageStorage] Supabase message insert fallback:', err.message);
      }
    }

    // Save in local state cache
    state.messages.push(message);
    if (conv) {
      conv.updated_at = now;
      conv.last_message = {
        content: message.content || (attachments.length > 0 ? `Shared ${attachments.length} file(s)` : 'New message'),
        sender_id: senderId,
        sender_name: senderDisplayName,
        created_at: now,
        message_type: messageType,
        attachments_count: attachments.length,
      };
    }
    state.reads[`${conversationId}:${senderId}`] = now;
    writeLocalMessenger(state);

    return message;
  },

  /**
   * Retrieves an attachment for downloading or viewing with participant validation
   */
  async getAttachmentFile(
    conversationId: string,
    userId: string,
    attachmentId: string
  ): Promise<{ filename: string; mimetype: string; streamOrBuffer: Buffer | string; isRedirect?: boolean }> {
    const state = readLocalMessenger();
    const conv = state.conversations.find((c) => c.id === conversationId);

    // Verify user is in conversation
    if (conv && !conv.participant_ids.includes(userId)) {
      throw new Error('Access denied. You are not a participant in this conversation.');
    }

    // Find attachment metadata
    const message = state.messages.find((m) =>
      m.conversation_id === conversationId &&
      m.attachments?.some((a) => a.id === attachmentId)
    );
    const attachment = message?.attachments?.find((a) => a.id === attachmentId);

    if (!attachment) {
      // Check if attachmentId matches a local file (e.g. avatar)
      const localDir = getAttachmentsDir(conversationId);
      if (fs.existsSync(localDir)) {
        const files = fs.readdirSync(localDir);
        const match = files.find((f) => f.includes(attachmentId));
        if (match) {
          const fullPath = path.join(localDir, match);
          return {
            filename: match,
            mimetype: match.endsWith('.png') ? 'image/png' : match.endsWith('.jpg') || match.endsWith('.jpeg') ? 'image/jpeg' : 'application/octet-stream',
            streamOrBuffer: fs.readFileSync(fullPath),
          };
        }
      }
      throw new Error('Attachment not found.');
    }

    // 1. Try local disk file
    const localDir = getAttachmentsDir(conversationId);
    if (fs.existsSync(localDir)) {
      const files = fs.readdirSync(localDir);
      const match = files.find((f) => f.startsWith(`${attachmentId}_`));
      if (match) {
        const fullPath = path.join(localDir, match);
        const buffer = fs.readFileSync(fullPath);
        return {
          filename: attachment.name,
          mimetype: attachment.type,
          streamOrBuffer: buffer,
        };
      }
    }

    // 2. Try Supabase Storage signed download URL
    if (supabaseAdmin && attachment.storage_path) {
      try {
        const { data } = await supabaseAdmin.storage
          .from(ATTACHMENT_BUCKET)
          .createSignedUrl(attachment.storage_path, 3600); // 1 hour download link

        if (data?.signedUrl) {
          return {
            filename: attachment.name,
            mimetype: attachment.type,
            streamOrBuffer: data.signedUrl,
            isRedirect: true,
          };
        }
      } catch {}
    }

    throw new Error('File content could not be located.');
  },

  /**
   * Explicitly marks all messages in a conversation as read for a given user
   */
  async markConversationAsRead(
    conversationId: string,
    userId: string
  ): Promise<{ success: boolean; read_at: string }> {
    const now = new Date().toISOString();
    const state = readLocalMessenger();
    state.reads[`${conversationId}:${userId}`] = now;
    writeLocalMessenger(state);

    if (supabaseAdmin) {
      try {
        await supabaseAdmin
          .from('conversation_participants')
          .update({ last_read_at: now })
          .match({ conversation_id: conversationId, user_id: userId });
      } catch (err: any) {
        console.warn('[Er.NEXA messageStorage] Supabase markConversationAsRead warning:', err.message);
      }
    }

    return { success: true, read_at: now };
  },

  /**
   * Calculates unread messages across all conversations for a user
   */
  async getUnreadCounts(
    userId: string
  ): Promise<{ totalUnread: number; byConversation: Record<string, number> }> {
    const convs = await this.getUserConversations(userId);
    const byConversation: Record<string, number> = {};
    let totalUnread = 0;

    for (const c of convs) {
      if (c.unreadCount > 0) {
        byConversation[c.id] = c.unreadCount;
        totalUnread += c.unreadCount;
      }
    }

    return { totalUnread, byConversation };
  },
};
