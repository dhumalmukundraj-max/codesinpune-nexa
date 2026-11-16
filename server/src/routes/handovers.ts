import { Router, Response } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { handoverStorage } from '../services/storage/handoverStorage.js';
import { HandoverEngine } from '../services/handoverEngine.js';
import { profileStorage } from '../services/storage/profileStorage.js';
import { supabaseAdmin } from '../config/index.js';

const router = Router();

// 1. List handovers for current authenticated user
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const handovers = await handoverStorage.listHandovers(userId);
    res.json({ success: true, handovers });
  } catch (err: any) {
    console.error('[Handovers API] List Error:', err);
    res.status(500).json({ error: 'Failed to list handovers', message: err.message });
  }
});

// 2. Get user notifications
router.get('/user/notifications', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const notifications = await handoverStorage.getNotifications(userId);
    res.json({ success: true, notifications });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch notifications', message: err.message });
  }
});

// 3. Mark notification as read
router.post('/user/notifications/:notifId/read', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const notifId = req.params.notifId as string;
    await handoverStorage.markNotificationRead(notifId, userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to mark notification as read', message: err.message });
  }
});

// 4. Create new Knowledge Handover & trigger AI synthesis grounded in project evidence
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const {
      project_id,
      title,
      description,
      outgoing_member_id,
      incoming_member_id,
      reviewer_id,
      target_date,
      notes,
      focus_areas,
    } = req.body;

    if (!project_id) {
      res.status(400).json({ error: 'Validation Error', message: 'project_id is required.' });
      return;
    }

    let projectName = 'Software Project';
    let analysisData: any = {};

    // Fetch real project and analysis data from database
    if (supabaseAdmin) {
      try {
        const [projRes, analysisRes] = await Promise.all([
          supabaseAdmin.from('projects').select('name').eq('id', project_id).single(),
          supabaseAdmin.from('project_analyses').select('*').eq('project_id', project_id).single(),
        ]);

        if (projRes.data?.name) projectName = projRes.data.name;
        if (analysisRes.data) {
          analysisData = {
            summary: analysisRes.data.summary,
            flowchartMermaid: analysisRes.data.flowchart_mermaid,
            blockDiagramMermaid: analysisRes.data.block_diagram_mermaid,
            roadmap: analysisRes.data.roadmap,
            progressMetrics: analysisRes.data.progress_metrics,
          };
        }
      } catch (dbErr) {
        console.warn('[Handovers API] Could not load analysis from Supabase:', dbErr);
      }
    }

    // Resolve outgoing and incoming member display names
    let outgoingMemberName = 'Outgoing Engineer';
    let incomingMemberName = 'Incoming Engineer';

    if (outgoing_member_id) {
      const p = await profileStorage.getProfile(outgoing_member_id);
      outgoingMemberName = p.display_name || p.full_name || p.email || 'Outgoing Engineer';
    }
    if (incoming_member_id) {
      const p = await profileStorage.getProfile(incoming_member_id);
      incomingMemberName = p.display_name || p.full_name || p.email || 'Incoming Engineer';
    }

    // Synthesize Sections A-M, Evidence Claims, and Continuation Checklist
    const synthesized = await HandoverEngine.generateHandover({
      projectId: project_id,
      projectName,
      outgoingMemberName,
      incomingMemberName,
      targetDate: target_date,
      notes,
      focusAreas: focus_areas,
      analysisData,
    });

    const handoverTitle = title || `${projectName} — Operational Knowledge Handover`;

    const created = await handoverStorage.createHandover({
      project_id,
      title: handoverTitle,
      description: description || `Complete engineering knowledge handover from ${outgoingMemberName} to ${incomingMemberName}.`,
      creator_id: userId,
      outgoing_member_id: outgoing_member_id || null,
      incoming_member_id: incoming_member_id || null,
      reviewer_id: reviewer_id || null,
      content: synthesized.content,
      claims: synthesized.claims,
      metadata: {
        targetDate: target_date || null,
        notes: notes || '',
        focusAreas: focus_areas || '',
        checklist: synthesized.checklist,
      },
    });

    res.status(201).json({
      success: true,
      handover: created,
    });
  } catch (err: any) {
    console.error('[Handovers API] Create Error:', err);
    res.status(500).json({ error: 'Failed to create handover', message: err.message });
  }
});

// 5. Get Handover Details (Handover + Claims + Versions + Comments + Acknowledgement)
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const data = await handoverStorage.getHandoverById(id);

    if (!data.handover) {
      res.status(404).json({ error: 'Not Found', message: 'Handover report not found.' });
      return;
    }

    res.json({
      success: true,
      ...data,
    });
  } catch (err: any) {
    console.error('[Handovers API] Get Detail Error:', err);
    res.status(500).json({ error: 'Failed to fetch handover', message: err.message });
  }
});

// 6. Update Handover Section Content (Creates a new Version snapshot)
router.put('/:id/content', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const { content, change_summary } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Validation Error', message: 'Updated content is required.' });
      return;
    }

    const result = await handoverStorage.updateContent(
      id,
      content,
      userId,
      change_summary || 'Updated handover sections'
    );

    res.json({
      success: true,
      handover: result.handover,
      newVersionNumber: result.newVersionNumber,
    });
  } catch (err: any) {
    console.error('[Handovers API] Content Update Error:', err);
    res.status(500).json({ error: 'Failed to update content', message: err.message });
  }
});

// 7. Verify or Challenge a Claim
router.post('/:id/claims/:claimId/verify', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const handoverId = req.params.id as string;
    const claimId = req.params.claimId as string;
    const userId = req.user!.id;
    const { verification_status, reviewer_notes } = req.body;

    if (!['VERIFIED FACT', 'AI INFERENCE', 'UNKNOWN', 'CONFLICTING INFORMATION'].includes(verification_status)) {
      res.status(400).json({ error: 'Invalid Status', message: 'verification_status must be a recognized tier.' });
      return;
    }

    const updatedClaim = await handoverStorage.verifyClaim(
      claimId,
      handoverId,
      verification_status,
      userId,
      reviewer_notes
    );

    res.json({
      success: true,
      claim: updatedClaim,
    });
  } catch (err: any) {
    console.error('[Handovers API] Claim Verification Error:', err);
    res.status(500).json({ error: 'Failed to verify claim', message: err.message });
  }
});

// 8. Submit for Human Review (Status -> UNDER_REVIEW)
router.post('/:id/submit-review', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;

    const updated = await handoverStorage.submitForReview(id, userId);
    res.json({
      success: true,
      handover: updated,
    });
  } catch (err: any) {
    console.error('[Handovers API] Submit Review Error:', err);
    res.status(500).json({ error: 'Failed to submit for review', message: err.message });
  }
});

// 9. Human Review Decision (Approve or Request Revisions)
// STRICT RULE: AI NEVER self-approves. Only human reviewers or owners can approve.
router.post('/:id/review', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const { decision, notes } = req.body;

    if (decision !== 'APPROVED' && decision !== 'REVISION_REQUIRED') {
      res.status(400).json({
        error: 'Invalid Decision',
        message: 'Review decision must be either APPROVED or REVISION_REQUIRED.',
      });
      return;
    }

    const updated = await handoverStorage.reviewHandover(id, userId, decision, notes || '');
    res.json({
      success: true,
      handover: updated,
    });
  } catch (err: any) {
    console.error('[Handovers API] Review Decision Error:', err);
    res.status(500).json({ error: 'Failed to process review decision', message: err.message });
  }
});

// 10. Share Approved Handover (Status -> SHARED)
router.post('/:id/share', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;

    const updated = await handoverStorage.shareHandover(id, userId);
    res.json({
      success: true,
      handover: updated,
    });
  } catch (err: any) {
    console.error('[Handovers API] Share Error:', err);
    res.status(500).json({ error: 'Failed to share handover', message: err.message });
  }
});

// 11. Update Continuation Checklist
router.post('/:id/checklist', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { checklist } = req.body;

    if (!Array.isArray(checklist)) {
      res.status(400).json({ error: 'Validation Error', message: 'checklist must be an array.' });
      return;
    }

    const updated = await handoverStorage.updateChecklistState(id, checklist);
    res.json({
      success: true,
      handover: updated,
    });
  } catch (err: any) {
    console.error('[Handovers API] Checklist Error:', err);
    res.status(500).json({ error: 'Failed to update checklist', message: err.message });
  }
});

// 12. Digital Handover Acknowledgement (Incoming Member signs receipt)
router.post('/:id/acknowledge', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const { checklist_state, comments, missing_information_reported, status, version_number } = req.body;

    const result = await handoverStorage.acknowledgeHandover({
      handover_id: id,
      member_id: userId,
      version_number: version_number || 1,
      checklist_state: checklist_state || {},
      comments: comments || '',
      missing_information_reported: missing_information_reported || '',
      status: status === 'NEEDS_CLARIFICATION' ? 'NEEDS_CLARIFICATION' : 'CONFIRMED',
    });

    res.json({
      success: true,
      handover: result.handover,
      acknowledgement: result.acknowledgement,
    });
  } catch (err: any) {
    console.error('[Handovers API] Acknowledgement Error:', err);
    res.status(500).json({ error: 'Failed to acknowledge handover', message: err.message });
  }
});

// 13. Add Comment or Clarification
router.post('/:id/comments', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const { content, section_key, claim_id, comment_type } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Validation Error', message: 'Comment content cannot be empty.' });
      return;
    }

    const comment = await handoverStorage.addComment({
      handover_id: id,
      author_id: userId,
      section_key,
      claim_id,
      comment_type,
      content: content.trim(),
    });

    res.status(201).json({
      success: true,
      comment,
    });
  } catch (err: any) {
    console.error('[Handovers API] Add Comment Error:', err);
    res.status(500).json({ error: 'Failed to add comment', message: err.message });
  }
});

export default router;
