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
  sender_name?: string;
  sender_avatar?: string;
  content: string;
  created_at: string;
  read_by?: string[];
  message_type?: MessageType;
  attachments?: MessageAttachment[];
  metadata?: Record<string, any>;
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
    message_type?: MessageType;
    attachments_count?: number;
  };
}

export interface ConversationDetailView {
  id: string;
  otherParticipant: UserProfileRecord;
  lastMessage?: {
    content: string;
    sender_id: string;
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
   * Retrieves ordered messages for a conversation, including attachment metadata
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
        const { data, error } = await supabaseAdmin
          .from('messages')
          .select('id, conversation_id, sender_id, content, attachments, message_type, metadata, created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })
          .limit(150);

        if (data && data.length > 0 && !error) {
          return data.map((m: any) => {
            const rawAttachments = m.attachments || m.metadata?.attachments || [];
            return {
              id: m.id,
              conversation_id: m.conversation_id,
              sender_id: m.sender_id,
              content: m.content || '',
              message_type: m.message_type || (rawAttachments.length > 0 ? 'mixed' : 'text'),
              attachments: rawAttachments,
              metadata: m.metadata || {},
              created_at: m.created_at,
            };
          });
        }
      } catch {}
    }

    return state.messages
      .filter((m) => m.conversation_id === conversationId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(a.created_at).getTime());
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

    if (conv && !conv.participant_ids.includes(senderId)) {
      throw new Error('You are not a participant in this conversation.');
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

    const message: MessageRecord = {
      id: messageId,
      conversation_id: conversationId,
      sender_id: senderId,
      sender_name: senderProfile.display_name || senderProfile.full_name || 'Engineer',
      sender_avatar: senderProfile.avatar_url,
      content: content ? content.trim() : '',
      created_at: now,
      message_type: messageType,
      attachments,
      metadata: {
        attachments,
        message_type: messageType,
      },
    };

    // Save in Supabase
    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('messages').insert({
          id: messageId,
          conversation_id: conversationId,
          sender_id: senderId,
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

    // Save in local state
    state.messages.push(message);
    if (conv) {
      conv.updated_at = now;
      conv.last_message = {
        content: message.content || (attachments.length > 0 ? `Shared ${attachments.length} file(s)` : 'New message'),
        sender_id: senderId,
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
};
