import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { supabaseAdmin, isConfigured, config } from '../config/index.js';
import { ProgressCalculator } from '../services/progressCalculator.js';

const router = Router();

// 1. List Projects for authenticated user
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Database not available' });
      return;
    }

    const userId = req.user!.id;

    // Fetch projects owned or permitted
    const { data: ownedProjects, error: ownedErr } = await supabaseAdmin
      .from('projects')
      .select('id, name, description, has_password, status, completion_percentage, languages, frameworks, source_type, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (ownedErr) throw ownedErr;

    // Fetch projects where user is shared
    const { data: sharedPerms, error: sharedErr } = await supabaseAdmin
      .from('project_permissions')
      .select('project_id, role, projects(id, name, description, has_password, status, completion_percentage, languages, frameworks, source_type, created_at, updated_at)')
      .eq('user_id', userId);

    if (sharedErr) throw sharedErr;

    const sharedProjects = (sharedPerms || [])
      .map((p: any) => ({
        ...p.projects,
        userRole: p.role,
      }))
      .filter((p: any) => p && p.id);

    // Merge and deduplicate
    const projectMap = new Map();
    (ownedProjects || []).forEach((p: any) => projectMap.set(p.id, { ...p, userRole: 'owner' }));
    sharedProjects.forEach((p: any) => {
      if (!projectMap.has(p.id)) projectMap.set(p.id, p);
    });

    res.json({ projects: Array.from(projectMap.values()) });
  } catch (err: any) {
    console.error('Fetch projects error:', err);
    res.status(500).json({ error: 'Failed to fetch projects', message: err.message });
  }
});

// 2. Save New Project & Analysis
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Database not available' });
      return;
    }

    const userId = req.user!.id;
    const {
      name,
      description,
      password,
      analysis,
      languages,
      frameworks,
      sourceType,
      repositoryUrl,
      files,
      originalFilename,
      originalFolderName,
      originalLocalPath,
      analysisMethod,
    } = req.body;

    if (!name || !analysis) {
      res.status(400).json({ error: 'Project name and analysis payload are required.' });
      return;
    }

    // Password hashing if specified
    let projectPasswordHash = null;
    let hasPassword = false;
    if (password && password.trim().length > 0) {
      projectPasswordHash = await bcrypt.hash(password.trim(), 10);
      hasPassword = true;
    }

    // Authoritative calculation of completion percentage
    const progressResult = ProgressCalculator.calculate(
      analysis.summary?.existingFunctionalities || [],
      analysis.summary?.unfinishedTasks || [],
      analysis.progressMetrics?.completionPercentage || 0
    );
    const completionPercentage = progressResult.completionPercentage;

    // Insert project
    const { data: project, error: projErr } = await supabaseAdmin
      .from('projects')
      .insert({
        user_id: userId,
        name,
        description: description || analysis.summary?.introduction?.tagline || '',
        project_password_hash: projectPasswordHash,
        has_password: hasPassword,
        status: 'ready',
        completion_percentage: completionPercentage,
        languages: languages || [],
        frameworks: frameworks || [],
        source_type: sourceType || 'folder',
        repository_url: repositoryUrl || null,
        original_filename: originalFilename || null,
        original_folder_name: originalFolderName || null,
        original_local_path: originalLocalPath || null,
        analysis_method: analysisMethod || sourceType || 'folder',
        source_connection_status: 'active',
      })
      .select()
      .single();

    if (projErr) throw projErr;

    // Insert project analysis
    const { error: analysisErr } = await supabaseAdmin
      .from('project_analyses')
      .insert({
        project_id: project.id,
        summary: analysis.summary || {},
        flowchart_mermaid: analysis.flowchartMermaid || '',
        block_diagram_mermaid: analysis.blockDiagramMermaid || '',
        roadmap: analysis.roadmap || { phases: [] },
        progress_metrics: {
          ...(analysis.progressMetrics || {}),
          ...progressResult,
        },
        file_tree: files?.slice(0, 500) || [],
        raw_stats: {
          totalFiles: files?.length || 0,
        },
      });

    if (analysisErr) throw analysisErr;

    // Insert owner permission
    await supabaseAdmin.from('project_permissions').insert({
      project_id: project.id,
      user_id: userId,
      user_email: req.user!.email,
      role: 'owner',
      granted_by: userId,
    });

    res.status(201).json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        hasPassword: project.has_password,
        completionPercentage: project.completion_percentage,
      },
    });
  } catch (err: any) {
    console.error('Save project error:', err);
    res.status(500).json({ error: 'Failed to save project', message: err.message });
  }
});

// 3. Unlock Password-Protected Project
router.post('/:id/unlock', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Database not available' });
      return;
    }

    const { id } = req.params;
    const { password } = req.body;

    const { data: project, error: projErr } = await supabaseAdmin
      .from('projects')
      .select('id, name, has_password, project_password_hash, user_id')
      .eq('id', id)
      .single();

    if (projErr || !project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    if (!project.has_password) {
      res.json({ success: true, message: 'Project is not password-protected' });
      return;
    }

    if (!password) {
      res.status(400).json({ error: 'Password required' });
      return;
    }

    const match = await bcrypt.compare(password, project.project_password_hash || '');
    if (!match) {
      res.status(401).json({ error: 'Invalid project password' });
      return;
    }

    // Issue unlock token
    const unlockToken = jwt.sign(
      { projectId: project.id, authorized: true, userId: req.user!.id },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      unlockToken,
      message: 'Project unlocked successfully',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Unlock failed', message: err.message });
  }
});

// 4. Get Project Details & Analysis
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Database not available' });
      return;
    }

    const { id } = req.params;
    const userId = req.user!.id;
    const unlockToken = req.headers['x-project-token'] as string;

    const { data: project, error: projErr } = await supabaseAdmin
      .from('projects')
      .select('*, project_permissions(role, user_id)')
      .eq('id', id)
      .single();

    if (projErr || !project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Check ownership or permissions
    const isOwner = project.user_id === userId;
    const permission = project.project_permissions?.find((p: any) => p.user_id === userId);

    if (!isOwner && !permission) {
      res.status(403).json({ error: 'Access denied to this project' });
      return;
    }

    // Check password protection
    if (project.has_password) {
      let isUnlocked = false;
      if (unlockToken) {
        try {
          const decoded = jwt.verify(unlockToken, config.jwtSecret) as any;
          if (decoded && decoded.projectId === id) {
            isUnlocked = true;
          }
        } catch {
          isUnlocked = false;
        }
      }

      if (!isUnlocked) {
        res.json({
          project: {
            id: project.id,
            name: project.name,
            description: project.description,
            has_password: true,
            isLocked: true,
            status: project.status,
            userRole: isOwner ? 'owner' : permission?.role,
            created_at: project.created_at,
          },
          isLocked: true,
        });
        return;
      }
    }

    // Fetch full analysis
    const { data: analysis, error: analysisErr } = await supabaseAdmin
      .from('project_analyses')
      .select('*')
      .eq('project_id', id)
      .single();

    if (analysisErr) throw analysisErr;

    // Fetch reviews
    const { data: reviews } = await supabaseAdmin
      .from('project_reviews')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false });

    // Sanitize project object
    const { project_password_hash, ...safeProject } = project;

    res.json({
      project: {
        ...safeProject,
        userRole: isOwner ? 'owner' : permission?.role,
        isLocked: false,
      },
      analysis,
      reviews: reviews || [],
    });
  } catch (err: any) {
    console.error('Get project error:', err);
    res.status(500).json({ error: 'Failed to fetch project', message: err.message });
  }
});

// 5. Delete Project (Cascading deletion of all artifacts and reviews)
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Database not available' });
      return;
    }

    const { id } = req.params;
    const userId = req.user!.id;

    // Check owner
    const { data: project, error: fetchErr } = await supabaseAdmin
      .from('projects')
      .select('id, user_id, name')
      .eq('id', id)
      .single();

    if (fetchErr || !project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    if (project.user_id !== userId) {
      res.status(403).json({ error: 'Only the project owner can delete this project.' });
      return;
    }

    // Delete project (cascade removes analyses, permissions, reviews, files)
    const { error: delErr } = await supabaseAdmin
      .from('projects')
      .delete()
      .eq('id', id);

    if (delErr) throw delErr;

    res.json({
      success: true,
      message: `Project "${project.name}" and all associated artifacts deleted.`,
    });
  } catch (err: any) {
    console.error('Delete project error:', err);
    res.status(500).json({ error: 'Failed to delete project', message: err.message });
  }
});

// 6. Update Project Progress & Task Checklist Status (Centralized Progress Sync)
router.patch('/:id/progress', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Database not available' });
      return;
    }

    const id = req.params.id as string;
    const userId = req.user!.id;
    const { checkedMap, taskUpdates } = req.body;

    // Check permissions
    const { data: project, error: projErr } = await supabaseAdmin
      .from('projects')
      .select('id, user_id, project_permissions(role, user_id)')
      .eq('id', id)
      .single();

    if (projErr || !project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const isOwner = project.user_id === userId;
    const permission = project.project_permissions?.find((p: any) => p.user_id === userId);
    if (!isOwner && !permission) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Fetch analysis
    const { data: analysis, error: aErr } = await supabaseAdmin
      .from('project_analyses')
      .select('*')
      .eq('project_id', id)
      .single();

    if (aErr || !analysis) {
      res.status(404).json({ error: 'Analysis not found' });
      return;
    }

    const summary = analysis.summary || {};
    const built = summary.existingFunctionalities || [];
    let remaining = summary.unfinishedTasks || [];

    // Apply checklist updates
    if (checkedMap && typeof checkedMap === 'object') {
      remaining = remaining.map((t: any, idx: number) => {
        const isChecked = checkedMap[`rem-${idx}`] ?? (t.status === 'completed' || t.isCompleted);
        return {
          ...t,
          status: isChecked ? 'completed' : 'pending',
          isCompleted: Boolean(isChecked),
        };
      });
    } else if (taskUpdates && Array.isArray(taskUpdates)) {
      remaining = taskUpdates;
    }

    summary.unfinishedTasks = remaining;

    // Authoritative calculation
    const progressResult = ProgressCalculator.calculate(
      built,
      remaining,
      analysis.progress_metrics?.completionPercentage || 0
    );

    const now = new Date().toISOString();

    // Persist to projects table
    await supabaseAdmin
      .from('projects')
      .update({
        completion_percentage: progressResult.completionPercentage,
        updated_at: now,
      })
      .eq('id', id);

    // Persist to project_analyses table
    await supabaseAdmin
      .from('project_analyses')
      .update({
        summary,
        progress_metrics: {
          ...(analysis.progress_metrics || {}),
          ...progressResult,
        },
        updated_at: now,
      })
      .eq('project_id', id);

    res.json({
      success: true,
      message: 'Project progress successfully updated and synchronized.',
      completionPercentage: progressResult.completionPercentage,
      progressMetrics: progressResult,
      summary,
    });
  } catch (err: any) {
    console.error('Update progress error:', err);
    res.status(500).json({ error: 'Failed to update progress', message: err.message });
  }
});

// 7. Comprehensive Save Project Endpoint
router.put('/:id/save', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Database not available' });
      return;
    }

    const id = req.params.id as string;
    const userId = req.user!.id;
    const { name, description, summary, roadmap, progressMetrics, flowchartMermaid, blockDiagramMermaid } = req.body;

    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    if (project.user_id !== userId) {
      res.status(403).json({ error: 'Only project owner can save modifications.' });
      return;
    }

    const now = new Date().toISOString();

    // Compute progress if summary provided
    let completionPercentage = undefined;
    if (summary) {
      const calc = ProgressCalculator.calculate(
        summary.existingFunctionalities || [],
        summary.unfinishedTasks || [],
        progressMetrics?.completionPercentage || 0
      );
      completionPercentage = calc.completionPercentage;
    }

    // Update project record
    const projectUpdates: any = { updated_at: now };
    if (name) projectUpdates.name = name;
    if (description !== undefined) projectUpdates.description = description;
    if (completionPercentage !== undefined) projectUpdates.completion_percentage = completionPercentage;

    await supabaseAdmin.from('projects').update(projectUpdates).eq('id', id);

    // Update analysis record
    const analysisUpdates: any = { updated_at: now };
    if (summary) analysisUpdates.summary = summary;
    if (roadmap) analysisUpdates.roadmap = roadmap;
    if (progressMetrics) analysisUpdates.progress_metrics = progressMetrics;
    if (flowchartMermaid !== undefined) analysisUpdates.flowchart_mermaid = flowchartMermaid;
    if (blockDiagramMermaid !== undefined) analysisUpdates.block_diagram_mermaid = blockDiagramMermaid;

    await supabaseAdmin.from('project_analyses').update(analysisUpdates).eq('project_id', id);

    res.json({
      success: true,
      message: 'Project and all analyses saved successfully.',
      completionPercentage,
    });
  } catch (err: any) {
    console.error('Save project error:', err);
    res.status(500).json({ error: 'Failed to save project', message: err.message });
  }
});

// 8. Change Project Encryption Password (AES-256 Key Rotation)
router.post('/:id/encryption/change-password', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Database not available' });
      return;
    }

    const id = req.params.id as string;
    const userId = req.user!.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('id, user_id, has_password, project_password_hash')
      .eq('id', id)
      .single();

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    if (project.user_id !== userId) {
      res.status(403).json({ error: 'Only the project owner can change the encryption password.' });
      return;
    }

    // Verify current password if previously protected
    if (project.has_password && project.project_password_hash) {
      if (!currentPassword) {
        res.status(400).json({ error: 'Current encryption password is required.' });
        return;
      }
      const match = await bcrypt.compare(currentPassword, project.project_password_hash);
      if (!match) {
        res.status(401).json({ error: 'Current password verification failed. Please try again.' });
        return;
      }
    }

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      res.status(400).json({ error: 'New password and confirmation password do not match.' });
      return;
    }

    // Derive new password hash
    const newHash = await bcrypt.hash(newPassword.trim(), 10);
    const now = new Date().toISOString();

    // Atomic update
    await supabaseAdmin
      .from('projects')
      .update({
        has_password: true,
        project_password_hash: newHash,
        encryption_updated_at: now,
        updated_at: now,
      })
      .eq('id', id);

    // Issue refreshed unlock token for immediate session continuity
    const unlockToken = jwt.sign(
      { projectId: project.id, authorized: true, userId },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Project encryption password successfully changed and verified.',
      unlockToken,
    });
  } catch (err: any) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to update encryption password', message: err.message });
  }
});

// 9. Remove Project Encryption Password Protection
router.post('/:id/encryption/remove-password', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Database not available' });
      return;
    }

    const id = req.params.id as string;
    const userId = req.user!.id;
    const { currentPassword, confirmRemove } = req.body;

    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('id, user_id, has_password, project_password_hash')
      .eq('id', id)
      .single();

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    if (project.user_id !== userId) {
      res.status(403).json({ error: 'Only the project owner can remove password protection.' });
      return;
    }

    if (!project.has_password) {
      res.json({ success: true, message: 'Project is already unprotected.' });
      return;
    }

    if (!confirmRemove) {
      res.status(400).json({ error: 'Explicit confirmation is required to remove encryption protection.' });
      return;
    }

    if (!currentPassword) {
      res.status(400).json({ error: 'Current password is required to remove protection.' });
      return;
    }

    const match = await bcrypt.compare(currentPassword, project.project_password_hash || '');
    if (!match) {
      res.status(401).json({ error: 'Current password verification failed. Protection was not removed.' });
      return;
    }

    const now = new Date().toISOString();

    // Safely remove password protection
    await supabaseAdmin
      .from('projects')
      .update({
        has_password: false,
        project_password_hash: null,
        encryption_updated_at: now,
        updated_at: now,
      })
      .eq('id', id);

    res.json({
      success: true,
      message: 'Password encryption protection successfully removed. Project is now accessible without a password.',
    });
  } catch (err: any) {
    console.error('Remove password error:', err);
    res.status(500).json({ error: 'Failed to remove encryption password', message: err.message });
  }
});

export default router;


