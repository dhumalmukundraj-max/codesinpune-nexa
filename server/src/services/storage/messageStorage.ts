import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { supabaseAdmin } from '../../config/index.js';
import { profileStorage, UserProfileRecord } from './profileStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../../../server/data/round3');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

const LOCAL_MESSAGES_FILE = path.join(DATA_DIR, 'messenger_data.json');

export interface MessageRecord {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name?: string;
  sender_avatar?: string;
  content: string;
  created_at: string;
  read_by?: string[];
}

export interface ConversationRecord {
  id: string;
  title?: string;
  participant_ids: string[];
  created_at: string;
  updated_at: string;
  last_message?: {
    content: string;
    sender_id: string;
    created_at: string;
  };
}

export interface ConversationDetailView {
  id: string;
  otherParticipant: UserProfileRecord;
  lastMessage?: {
    content: string;
    sender_id: string;
    created_at: string;
  };
  unreadCount: number;
  updated_at: string;
}

interface LocalMessengerState {
  conversations: ConversationRecord[];
  messages: MessageRecord[];
  reads: Record<string, string>; // `${convId}:${userId}` -> ISO timestamp
}

function readLocalMessenger(): LocalMessengerState {
  ensureDataDir();
  if (fs.existsSync(LOCAL_MESSAGES_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(LOCAL_MESSAGES_FILE, 'utf-8'));
    } catch {}
  }
  return { conversations: [], messages: [], reads: {} };
}

function writeLocalMessenger(state: LocalMessengerState) {
  ensureDataDir();
  fs.writeFileSync(LOCAL_MESSAGES_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

export const messageStorage = {
  /**
   * Retrieves or creates a 1-to-1 conversation between userA and userB
   */
  async getOrCreateDirectConversation(userA: string, userB: string): Promise<ConversationRecord> {
    const state = readLocalMessenger();

    // Check if conversation already exists in local state
    const existing = state.conversations.find((c) =>
      c.participant_ids.length === 2 &&
      c.participant_ids.includes(userA) &&
      c.participant_ids.includes(userB)
    );

    if (existing) {
      return existing;
    }

    // Check in Supabase if available
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
            .in('conversation_id', convIds)
            .limit(1);

          if (matched && matched.length > 0) {
            const foundId = matched[0].conversation_id;
            const conv: ConversationRecord = {
              id: foundId,
              participant_ids: [userA, userB],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            state.conversations.push(conv);
            writeLocalMessenger(state);
            return conv;
          }
        }

        // Create new in Supabase
        const { data: newConv } = await supabaseAdmin
          .from('conversations')
          .insert({})
          .select()
          .single();

        if (newConv) {
          await supabaseAdmin.from('conversation_participants').insert([
            { conversation_id: newConv.id, user_id: userA },
            { conversation_id: newConv.id, user_id: userB },
          ]);

          const conv: ConversationRecord = {
            id: newConv.id,
            participant_ids: [userA, userB],
            created_at: newConv.created_at,
            updated_at: newConv.updated_at,
          };
          state.conversations.push(conv);
          writeLocalMessenger(state);
          return conv;
        }
      } catch {}
    }

    // Local fallback creation
    const newConv: ConversationRecord = {
      id: crypto.randomUUID(),
      participant_ids: [userA, userB],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    state.conversations.push(newConv);
    writeLocalMessenger(state);
    return newConv;
  },

  /**
   * Retrieves conversation list for a user with participant profiles and unread count
   */
  async getUserConversations(userId: string): Promise<ConversationDetailView[]> {
    const state = readLocalMessenger();
    const userConvs = state.conversations.filter((c) => c.participant_ids.includes(userId));
    const views: ConversationDetailView[] = [];

    for (const c of userConvs) {
      const otherId = c.participant_ids.find((id) => id !== userId) || userId;
      const otherProfile = await profileStorage.getProfile(otherId);

      // Count unread
      const lastRead = state.reads[`${c.id}:${userId}`] || '1970-01-01';
      const unreadCount = state.messages.filter(
        (m) => m.conversation_id === c.id && m.sender_id !== userId && m.created_at > lastRead
      ).length;

      views.push({
        id: c.id,
        otherParticipant: otherProfile,
        lastMessage: c.last_message,
        unreadCount,
        updated_at: c.updated_at,
      });
    }

    // Sort by latest message / update
    return views.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  },

  /**
   * Retrieves ordered messages for a conversation
   */
  async getMessages(conversationId: string, userId: string): Promise<MessageRecord[]> {
    const state = readLocalMessenger();
    const conv = state.conversations.find((c) => c.id === conversationId);

    // Participant verification
    if (conv && !conv.participant_ids.includes(userId)) {
      throw new Error('Access denied to this conversation.');
    }

    // Mark as read
    state.reads[`${conversationId}:${userId}`] = new Date().toISOString();
    writeLocalMessenger(state);

    // Try Supabase first
    if (supabaseAdmin) {
      try {
        const { data } = await supabaseAdmin
          .from('messages')
          .select('id, conversation_id, sender_id, content, created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })
          .limit(100);

        if (data && data.length > 0) {
          return data;
        }
      } catch {}
    }

    return state.messages
      .filter((m) => m.conversation_id === conversationId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  },

  /**
   * Sends a message in a conversation
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string
  ): Promise<MessageRecord> {
    const state = readLocalMessenger();
    let conv = state.conversations.find((c) => c.id === conversationId);

    if (conv && !conv.participant_ids.includes(senderId)) {
      throw new Error('You are not a participant in this conversation.');
    }

    const now = new Date().toISOString();
    const messageId = crypto.randomUUID();

    const senderProfile = await profileStorage.getProfile(senderId);

    const message: MessageRecord = {
      id: messageId,
      conversation_id: conversationId,
      sender_id: senderId,
      sender_name: senderProfile.display_name || senderProfile.full_name || 'Engineer',
      sender_avatar: senderProfile.avatar_url,
      content: content.trim(),
      created_at: now,
    };

    // Save in Supabase
    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('messages').insert({
          id: messageId,
          conversation_id: conversationId,
          sender_id: senderId,
          content: message.content,
          created_at: now,
        });

        await supabaseAdmin
          .from('conversations')
          .update({ updated_at: now })
          .eq('id', conversationId);
      } catch {}
    }

    // Save in local state
    state.messages.push(message);
    if (conv) {
      conv.updated_at = now;
      conv.last_message = {
        content: message.content,
        sender_id: senderId,
        created_at: now,
      };
    }
    state.reads[`${conversationId}:${senderId}`] = now;
    writeLocalMessenger(state);

    return message;
  },
};
