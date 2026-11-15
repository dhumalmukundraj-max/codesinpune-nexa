import { Router, Response } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { profileStorage, UserProfileRecord } from '../services/storage/profileStorage.js';

const router = Router();

// 1. Get current authenticated user profile
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const email = req.user!.email || (req.user as any)?.user_metadata?.email;
    const fullName = (req.user as any)?.user_metadata?.full_name || (req.user as any)?.user_metadata?.display_name;

    const profile = await profileStorage.getProfile(userId, email, fullName);
    res.json({ success: true, profile });
  } catch (err: any) {
    console.error('[Er.NEXA Profile Fetch Error]:', err);
    res.status(500).json({ error: 'Failed to fetch user profile', message: err.message });
  }
});

// 2. Update current authenticated user profile
router.patch('/me', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const email = req.user!.email || (req.user as any)?.user_metadata?.email || '';
    const current = await profileStorage.getProfile(userId, email);

    const { username, display_name, bio, public_id, avatar_url } = req.body;

    // Validate username if provided
    if (username !== undefined && username !== null) {
      const cleanUsername = String(username).trim();
      if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(cleanUsername)) {
        res.status(400).json({
          error: 'Invalid username format',
          message: 'Username must be 3-30 characters containing letters, numbers, underscores, periods, or hyphens.',
        });
        return;
      }
      current.username = cleanUsername.toLowerCase();
    }

    if (display_name !== undefined && display_name !== null) {
      const cleanName = String(display_name).trim().slice(0, 60);
      current.display_name = cleanName || current.username || 'Er.NEXA Engineer';
      current.full_name = current.display_name;
    }

    if (bio !== undefined && bio !== null) {
      current.bio = String(bio).trim().slice(0, 300);
    }

    if (public_id !== undefined && public_id !== null) {
      const cleanPid = String(public_id).trim().slice(0, 30);
      if (cleanPid) {
        current.public_id = cleanPid.toUpperCase();
      }
    }

    if (avatar_url !== undefined && avatar_url !== null) {
      current.avatar_url = String(avatar_url).trim();
    }

    const updated = await profileStorage.upsertProfile(current);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      profile: updated,
    });
  } catch (err: any) {
    console.error('[Er.NEXA Profile Update Error]:', err);
    res.status(400).json({
      error: 'Profile update failed',
      message: err.message || 'An unexpected error occurred while saving the profile.',
    });
  }
});

// 3. Search public profiles by username, display name, or public ID
router.get('/search', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const query = String(req.query.q || '').trim();
    if (!query) {
      res.json({ profiles: [] });
      return;
    }

    const profiles = await profileStorage.searchProfiles(query, req.user!.id, 15);
    res.json({ profiles });
  } catch (err: any) {
    console.error('[Er.NEXA Profile Search Error]:', err);
    res.status(500).json({ error: 'Search failed', message: err.message });
  }
});

// 4. Get a user's public profile by ID or username
router.get('/:idOrUsername', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { idOrUsername } = req.params;
    const profile = await profileStorage.findByUsernameOrId(idOrUsername as string);

    if (!profile) {
      res.status(404).json({ error: 'User profile not found.' });
      return;
    }

    // Return safe public profile
    res.json({
      success: true,
      profile: {
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name || profile.full_name,
        avatar_url: profile.avatar_url,
        public_id: profile.public_id,
        bio: profile.bio,
        created_at: profile.created_at,
      },
    });
  } catch (err: any) {
    console.error('[Er.NEXA Profile Lookup Error]:', err);
    res.status(500).json({ error: 'Failed to retrieve profile', message: err.message });
  }
});

export default router;
