import { Router, Response } from 'express';
import multer from 'multer';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { messageStorage } from '../services/storage/messageStorage.js';
import { profileStorage } from '../services/storage/profileStorage.js';

const router = Router();

// Configure Multer for in-memory file handling (supports images and documents up to 25MB each)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max per file
    files: 10, // Max 10 attachments per message
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      // Images
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      // Documents
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];

    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed types: Images (JPG, PNG, WEBP), PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV.`));
    }
  },
});

// 1. Get all conversations for current user (1-on-1 and groups)
router.get('/conversations', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const conversations = await messageStorage.getUserConversations(userId);
    res.json({ success: true, conversations });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch conversations', message: err.message });
  }
});

// 1.1. Get total unread messages count and unread breakdown by conversation
router.get('/unread-count', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { totalUnread, byConversation } = await messageStorage.getUnreadCounts(userId);
    res.json({ success: true, totalUnread, byConversation });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch unread counts', message: err.message });
  }
});

// 2. Start or retrieve direct conversation with another user
router.post('/conversations', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { recipientId, usernameOrId } = req.body;

    let targetId = recipientId;
    if (!targetId && usernameOrId) {
      const targetProfile = await profileStorage.findByUsernameOrId(usernameOrId);
      if (!targetProfile) {
        res.status(404).json({ error: `User "${usernameOrId}" not found.` });
        return;
      }
      targetId = targetProfile.id;
    }

    if (!targetId) {
      res.status(400).json({ error: 'Recipient user ID or username is required.' });
      return;
    }

    if (targetId === userId) {
      res.status(400).json({ error: 'Cannot start conversation with yourself.' });
      return;
    }

    const conv = await messageStorage.getOrCreateDirectConversation(userId, targetId);
    const targetProfile = await profileStorage.getProfile(targetId);

    res.json({
      success: true,
      conversation: {
        id: conv.id,
        is_group: false,
        otherParticipant: targetProfile,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to initiate conversation', message: err.message });
  }
});

// 3. Create a new WhatsApp-like group conversation
router.post(
  '/conversations/group',
  requireAuth,
  upload.single('avatar'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const title = req.body.title || 'New Group';
      let memberIds: string[] = [];

      if (Array.isArray(req.body.memberIds)) {
        memberIds = req.body.memberIds;
      } else if (typeof req.body.memberIds === 'string') {
        try {
          const parsed = JSON.parse(req.body.memberIds);
          if (Array.isArray(parsed)) memberIds = parsed;
        } catch {
          memberIds = req.body.memberIds.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      }

      let avatarUrl = req.body.avatarUrl || req.body.avatar_url;
      const description = req.body.description || '';

      // If an avatar file was uploaded in the request
      if (req.file) {
        const tempConvId = `group_${Date.now()}`;
        avatarUrl = await messageStorage.uploadGroupAvatar(tempConvId, {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          buffer: req.file.buffer,
        });
      }

      const groupConv = await messageStorage.createGroupConversation(
        userId,
        title,
        memberIds,
        avatarUrl,
        description
      );

      res.json({ success: true, conversation: groupConv });
    } catch (err: any) {
      console.error('[Er.NEXA Group Create Error]:', err);
      res.status(400).json({ error: 'Failed to create group', message: err.message });
    }
  }
);

// 4. Get specific conversation details (including member list and roles)
router.get('/conversations/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id as string;
    const conversation = await messageStorage.getConversation(conversationId, userId);
    res.json({ success: true, conversation });
  } catch (err: any) {
    res.status(403).json({ error: 'Failed to fetch conversation details', message: err.message });
  }
});

// 5. Update group details (title, avatarUrl, description)
router.patch('/conversations/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id as string;
    const { title, avatar_url, avatarUrl, description } = req.body;

    const updated = await messageStorage.updateGroupDetails(conversationId, userId, {
      title,
      avatar_url: avatar_url || avatarUrl,
      description,
    });

    res.json({ success: true, conversation: updated });
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to update group details', message: err.message });
  }
});

// 6. Upload/change group avatar picture
router.post(
  '/conversations/:id/avatar',
  requireAuth,
  upload.single('avatar'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const conversationId = req.params.id as string;

      if (!req.file) {
        res.status(400).json({ error: 'No image file uploaded.' });
        return;
      }

      const avatarUrl = await messageStorage.uploadGroupAvatar(conversationId, {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        buffer: req.file.buffer,
      });

      const updated = await messageStorage.updateGroupDetails(conversationId, userId, {
        avatar_url: avatarUrl,
      });

      res.json({ success: true, avatar_url: avatarUrl, conversation: updated });
    } catch (err: any) {
      res.status(400).json({ error: 'Failed to upload group avatar', message: err.message });
    }
  }
);

// 7. Add members to group (Admin only)
router.post('/conversations/:id/members', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id as string;
    let { memberIds } = req.body;

    if (!Array.isArray(memberIds)) {
      if (typeof memberIds === 'string') {
        memberIds = [memberIds];
      } else {
        memberIds = [];
      }
    }

    if (memberIds.length === 0) {
      res.status(400).json({ error: 'At least one member ID is required.' });
      return;
    }

    const updated = await messageStorage.addGroupMembers(conversationId, userId, memberIds);
    res.json({ success: true, conversation: updated });
  } catch (err: any) {
    res.status(403).json({ error: 'Failed to add group members', message: err.message });
  }
});

// 8. Remove a member from group (Admin) OR Leave group (Member leaving)
router.delete(
  '/conversations/:id/members/:memberId',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const conversationId = req.params.id as string;
      const memberIdToRemove = req.params.memberId as string;

      const result = await messageStorage.removeGroupMember(conversationId, userId, memberIdToRemove);
      res.json({ success: true, left: result.left });
    } catch (err: any) {
      res.status(403).json({ error: 'Failed to remove member / leave group', message: err.message });
    }
  }
);

// 9. Get messages for a specific conversation
router.get('/conversations/:id/messages', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id as string;

    const messages = await messageStorage.getMessages(conversationId, userId);
    res.json({ success: true, messages });
  } catch (err: any) {
    res.status(403).json({ error: 'Failed to fetch messages', message: err.message });
  }
});

// 9.1. Explicitly mark conversation messages as read
router.post('/conversations/:id/read', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id as string;

    const result = await messageStorage.markConversationAsRead(conversationId, userId);
    res.json({ success: true, conversationId, read_at: result.read_at });
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to mark conversation as read', message: err.message });
  }
});

// 10. Send a message with optional text content and attachments (supports JSON or multipart/form-data)
router.post(
  '/conversations/:id/messages',
  requireAuth,
  upload.array('attachments', 10),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const conversationId = req.params.id as string;
      const content = req.body.content || '';

      const uploadedFiles = (req.files as Express.Multer.File[]) || [];
      let processedAttachments = [];

      // Process uploaded files if any
      if (uploadedFiles.length > 0) {
        processedAttachments = await messageStorage.processAttachments(
          conversationId,
          uploadedFiles.map((f) => ({
            originalname: f.originalname,
            mimetype: f.mimetype,
            size: f.size,
            buffer: f.buffer,
          }))
        );
      } else if (Array.isArray(req.body.attachments)) {
        processedAttachments = req.body.attachments;
      }

      // Check if message has at least text content or one attachment
      if (!content.trim() && processedAttachments.length === 0) {
        res.status(400).json({ error: 'Message must contain either text content or at least one attachment.' });
        return;
      }

      const message = await messageStorage.sendMessage(
        conversationId,
        userId,
        content,
        processedAttachments
      );

      res.json({ success: true, message });
    } catch (err: any) {
      console.error('[Er.NEXA Messages Error]:', err);
      res.status(403).json({ error: 'Failed to send message', message: err.message });
    }
  }
);

// 11. Secure attachment download / view endpoint (verified participant access)
router.get(
  '/conversations/:id/attachments/:attachmentId/download',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const conversationId = req.params.id as string;
      const attachmentId = req.params.attachmentId as string;

      const fileResult = await messageStorage.getAttachmentFile(conversationId, userId, attachmentId);

      if (fileResult.isRedirect && typeof fileResult.streamOrBuffer === 'string') {
        res.redirect(fileResult.streamOrBuffer);
        return;
      }

      res.setHeader('Content-Type', fileResult.mimetype || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(fileResult.filename)}"`
      );
      res.send(fileResult.streamOrBuffer);
    } catch (err: any) {
      res.status(403).json({ error: 'Download failed', message: err.message });
    }
  }
);

export default router;
