import { Router, Response } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/index.js';

const router = Router();

// Helper to check user permission
async function checkProjectRole(projectId: string, userId: string): Promise<string | null> {
  if (!supabaseAdmin) return null;

  // Check owner
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('user_id')
    .eq('id', projectId)
    .single();

  if (project && project.user_id === userId) {
    return 'owner';
  }

  // Check permissions table
  const { data: perm } = await supabaseAdmin
    .from('project_permissions')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single();

  return perm ? perm.role : null;
}

// 1. Submit or update a human review / handover approval
router.post('/:projectId/review', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Database not available' });
      return;
    }

    const projectId = req.params.projectId as string;
    const userId = req.user!.id;
    const { status, notes, editedSummary } = req.body;

    const role = await checkProjectRole(projectId, userId);
    if (!role || !['owner', 'reviewer', 'editor'].includes(role)) {
      res.status(403).json({ error: 'Insufficient permissions to review or edit this project.' });
      return;
    }

    // Insert or update review record
    const { data: review, error: rErr } = await supabaseAdmin
      .from('project_reviews')
      .insert({
        project_id: projectId,
        reviewer_id: userId,
        status: status || 'under_review',
        notes: notes || '',
        edited_summary: editedSummary || null,
        approved_at: status === 'approved' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (rErr) throw rErr;

    // If editedSummary provided and user has permission, update the project_analyses summary
    if (editedSummary && ['owner', 'reviewer', 'editor'].includes(role)) {
      await supabaseAdmin
        .from('project_analyses')
        .update({
          summary: editedSummary,
          updated_at: new Date().toISOString(),
        })
        .eq('project_id', projectId);
    }

    res.json({
      success: true,
      review,
      message: status === 'approved' ? 'Handover report approved successfully.' : 'Review submitted.',
    });
  } catch (err: any) {
    console.error('Review error:', err);
    res.status(500).json({ error: 'Failed to process review', message: err.message });
  }
});

// 2. Share project with another user by email
router.post('/:projectId/share', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Database not available' });
      return;
    }

    const projectId = req.params.projectId as string;
    const userId = req.user!.id;
    const { email, role } = req.body;

    if (!email || !role) {
      res.status(400).json({ error: 'Target email and role (reviewer, editor, viewer) are required.' });
      return;
    }

    const validRoles = ['reviewer', 'editor', 'viewer'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: 'Invalid role. Must be one of: reviewer, editor, viewer.' });
      return;
    }

    // Check if current user is owner
    const callerRole = await checkProjectRole(projectId, userId);
    if (callerRole !== 'owner') {
      res.status(403).json({ error: 'Only the project owner can share this project.' });
      return;
    }

    // Find target user by email in profiles
    const { data: targetProfile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (profileErr || !targetProfile) {
      res.status(404).json({
        error: 'User not found',
        message: `No registered user found with email "${email}". The user must register with Er.NEXA first.`,
      });
      return;
    }

    // Insert or update permission
    const { data: perm, error: permErr } = await supabaseAdmin
      .from('project_permissions')
      .upsert({
        project_id: projectId,
        user_id: targetProfile.id,
        user_email: targetProfile.email,
        role,
        granted_by: userId,
      })
      .select()
      .single();

    if (permErr) throw permErr;

    res.json({
      success: true,
      permission: perm,
      message: `Project successfully shared with ${email} as ${role}.`,
    });
  } catch (err: any) {
    console.error('Share error:', err);
    res.status(500).json({ error: 'Failed to share project', message: err.message });
  }
});

// 3. Get permissions list for a project
router.get('/:projectId/permissions', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Database not available' });
      return;
    }

    const projectId = req.params.projectId as string;
    const userId = req.user!.id;

    const callerRole = await checkProjectRole(projectId, userId);
    if (!callerRole) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { data: perms, error: permErr } = await supabaseAdmin
      .from('project_permissions')
      .select('id, user_id, user_email, role, created_at')
      .eq('project_id', projectId);

    if (permErr) throw permErr;

    res.json({ permissions: perms || [], callerRole });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch permissions', message: err.message });
  }
});

export default router;
