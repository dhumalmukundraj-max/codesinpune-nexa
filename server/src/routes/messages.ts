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
    // Allowed extensions and mimetypes
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

// 1. Get all conversations for current user
router.get('/conversations', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const conversations = await messageStorage.getUserConversations(userId);
    res.json({ success: true, conversations });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch conversations', message: err.message });
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
        otherParticipant: targetProfile,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to initiate conversation', message: err.message });
  }
});

// 3. Get messages for a specific conversation
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

// 4. Send a message with optional text content and attachments (supports JSON or multipart/form-data)
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

// 5. Secure attachment download / view endpoint (verified participant access)
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
