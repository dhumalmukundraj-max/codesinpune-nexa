import { Router, Response } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { syncStorage } from '../services/storage/syncStorage.js';
import { GitHubSyncService } from '../services/githubSyncService.js';
import { supabaseAdmin } from '../config/index.js';

const router = Router({ mergeParams: true });

// 1. Get GitHub Sync Configuration & Connection Status
router.get('/config', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const config = await syncStorage.getConfig(id);

    if (!config) {
      res.json({
        connected: false,
        config: null,
      });
      return;
    }

    // Mask sensitive token
    const maskedToken = config.github_token
      ? `${config.github_token.slice(0, 4)}••••${config.github_token.slice(-4)}`
      : undefined;

    res.json({
      connected: config.status !== 'disconnected',
      config: {
        ...config,
        github_token: maskedToken,
        has_token: Boolean(config.github_token),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve sync configuration', message: err.message });
  }
});

// 2. Connect Project to GitHub Repository
router.post('/connect', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { repoUrl, githubToken, syncInterval, webhookSecret } = req.body;

    if (!repoUrl) {
      res.status(400).json({ error: 'Repository URL or slug is required (e.g. owner/repo).' });
      return;
    }

    // Validate access against GitHub API
    const repoInfo = await GitHubSyncService.validateAndGetRepoInfo(repoUrl, githubToken);

    // Save Sync Config
    const config = await syncStorage.saveConfig({
      project_id: id,
      repo_owner: repoInfo.owner,
      repo_name: repoInfo.name,
      repo_url: repoInfo.fullName,
      default_branch: repoInfo.defaultBranch,
      github_token: githubToken || undefined,
      webhook_secret: webhookSecret || undefined,
      sync_interval: syncInterval || 'disabled',
      last_synced_at: new Date().toISOString(),
      last_commit_sha: repoInfo.latestCommitSha,
      status: 'connected',
    });

    // Update project source type in database
    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('projects').update({
          source_type: 'github',
          repository_url: `https://github.com/${repoInfo.fullName}`,
          updated_at: new Date().toISOString(),
        }).eq('id', id);
      } catch {}
    }

    // Record initial connection in history
    await syncStorage.addHistory({
      project_id: id,
      trigger_type: 'initial',
      commit_sha: repoInfo.latestCommitSha,
      commit_message: repoInfo.latestCommitMessage,
      commit_author: repoInfo.latestCommitAuthor,
      commits_count: 1,
      files_changed_count: 0,
      changed_files: [],
      status: 'completed',
    });

    res.json({
      success: true,
      message: `Successfully connected to repository ${repoInfo.fullName} on branch ${repoInfo.defaultBranch}.`,
      config: {
        ...config,
        github_token: githubToken ? `${githubToken.slice(0, 4)}••••` : undefined,
      },
      repoInfo,
    });
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to connect repository', message: err.message });
  }
});

// 3. Disconnect GitHub Repository
router.post('/disconnect', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await syncStorage.deleteConfig(id);

    res.json({
      success: true,
      message: 'GitHub repository successfully disconnected from project.',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to disconnect repository', message: err.message });
  }
});

// 4. Trigger Manual "Sync Now"
router.post('/manual', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const result = await GitHubSyncService.performManualSync(id, 'manual');

    res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Synchronization failed', message: err.message });
  }
});

// 5. Get Synchronization History
router.get('/history', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const limit = parseInt(req.query.limit as string, 10) || 25;
    const history = await syncStorage.getHistory(id, limit);

    res.json({ history });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch sync history', message: err.message });
  }
});

// 6. Update Scheduled Sync Interval
router.patch('/interval', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { interval } = req.body;

    const validIntervals = ['disabled', '30m', '1h', '6h', '24h'];
    if (!validIntervals.includes(interval)) {
      res.status(400).json({ error: 'Invalid interval. Allowed values: disabled, 30m, 1h, 6h, 24h.' });
      return;
    }

    const config = await syncStorage.getConfig(id);
    if (!config) {
      res.status(404).json({ error: 'Sync configuration not found.' });
      return;
    }

    const updated = await syncStorage.saveConfig({
      ...config,
      sync_interval: interval,
    });

    res.json({
      success: true,
      sync_interval: updated.sync_interval,
      message: `Scheduled synchronization set to: ${interval}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update schedule', message: err.message });
  }
});

export default router;
