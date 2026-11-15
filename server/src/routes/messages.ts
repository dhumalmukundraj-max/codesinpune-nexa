import { Router, Response } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { messageStorage } from '../services/storage/messageStorage.js';
import { profileStorage } from '../services/storage/profileStorage.js';

const router = Router();

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

// 4. Send a message in a conversation
router.post('/conversations/:id/messages', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id as string;
    const { content } = req.body;

    if (!content || !String(content).trim()) {
      res.status(400).json({ error: 'Message content cannot be empty.' });
      return;
    }

    const message = await messageStorage.sendMessage(conversationId, userId, String(content).trim());
    res.json({ success: true, message });
  } catch (err: any) {
    res.status(403).json({ error: 'Failed to send message', message: err.message });
  }
});

export default router;
