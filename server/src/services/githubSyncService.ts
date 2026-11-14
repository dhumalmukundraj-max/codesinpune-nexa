import crypto from 'crypto';
import { syncStorage, GitHubSyncConfigRecord, GitHubSyncHistoryRecord } from './storage/syncStorage.js';
import { graphStorage } from './storage/graphStorage.js';
import { taskStorage } from './storage/taskStorage.js';
import { supabaseAdmin } from '../config/index.js';
import { runIncrementalAnalysis, ChangedFilePayload } from './incrementalAnalyzer.js';
import { KnowledgeGraphEngine } from './knowledgeGraphEngine.js';
import { RoadmapEngine } from './roadmapEngine.js';
import { AnalysisResult } from './geminiServiceTypes.js';

export interface GitHubRepoInfo {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  description: string;
  isPrivate: boolean;
  latestCommitSha: string;
  latestCommitMessage: string;
  latestCommitAuthor: string;
  latestCommitDate: string;
}

export class GitHubSyncService {
  /**
   * Normalizes repository URL or slug into { owner, repo }
   */
  static parseRepoSlug(repoUrlOrSlug: string): { owner: string; repo: string } {
    const clean = repoUrlOrSlug.trim().replace(/\/$/, '');
    const match = clean.match(/(?:https?:\/\/github\.com\/|^)([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)(?:\.git)?$/);
    if (!match) {
      throw new Error('Invalid GitHub repository format. Use "owner/repo" or "https://github.com/owner/repo"');
    }
    return { owner: match[1], repo: match[2] };
  }

  /**
   * Validates and retrieves repository info from GitHub REST API
   */
  static async validateAndGetRepoInfo(repoUrlOrSlug: string, token?: string): Promise<GitHubRepoInfo> {
    const { owner, repo } = this.parseRepoSlug(repoUrlOrSlug);
    const headers: Record<string, string> = {
      'User-Agent': 'Er.NEXA-Continuous-Sync',
      Accept: 'application/vnd.github.v3+json',
    };
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    // 1. Fetch Repository Metadata
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!repoRes.ok) {
      if (repoRes.status === 404) {
        throw new Error(`Repository ${owner}/${repo} not found or is private (require personal access token).`);
      }
      if (repoRes.status === 401 || repoRes.status === 403) {
        throw new Error('GitHub API rate limit exceeded or invalid Personal Access Token.');
      }
      throw new Error(`GitHub API error: ${repoRes.status} ${repoRes.statusText}`);
    }

    const repoData = (await repoRes.json()) as any;
    const defaultBranch = repoData.default_branch || 'main';

    // 2. Fetch Latest Commit on Default Branch
    let latestCommitSha = '';
    let latestCommitMessage = '';
    let latestCommitAuthor = '';
    let latestCommitDate = new Date().toISOString();

    try {
      const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${defaultBranch}`, { headers });
      if (commitRes.ok) {
        const commitData = (await commitRes.json()) as any;
        latestCommitSha = commitData.sha || '';
        latestCommitMessage = commitData.commit?.message || 'Initial commit';
        latestCommitAuthor = commitData.commit?.author?.name || commitData.author?.login || 'Developer';
        latestCommitDate = commitData.commit?.author?.date || new Date().toISOString();
      }
    } catch {
      // fallback
    }

    return {
      owner,
      name: repo,
      fullName: repoData.full_name || `${owner}/${repo}`,
      defaultBranch,
      description: repoData.description || '',
      isPrivate: Boolean(repoData.private),
      latestCommitSha,
      latestCommitMessage,
      latestCommitAuthor,
      latestCommitDate,
    };
  }

  /**
   * Fetches raw content of a specific file from GitHub
   */
  static async fetchFileContent(
    owner: string,
    repo: string,
    filePath: string,
    ref: string,
    token?: string
  ): Promise<string> {
    const headers: Record<string, string> = {
      'User-Agent': 'Er.NEXA-Continuous-Sync',
      Accept: 'application/vnd.github.v3.raw',
    };
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(ref)}`,
        { headers }
      );
      if (res.ok) {
        return await res.text();
      }
    } catch {
      // ignore
    }
    return '';
  }

  /**
   * Compares two commits and returns list of changed files and new commits
   */
  static async getCompareDiff(
    owner: string,
    repo: string,
    baseSha: string,
    headSha: string,
    token?: string
  ): Promise<{ commits: any[]; files: any[] }> {
    const headers: Record<string, string> = {
      'User-Agent': 'Er.NEXA-Continuous-Sync',
      Accept: 'application/vnd.github.v3+json',
    };
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/compare/${baseSha}...${headSha}`,
      { headers }
    );

    if (!res.ok) {
      throw new Error(`GitHub Compare API returned ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as any;
    return {
      commits: data.commits || [],
      files: data.files || [],
    };
  }

  /**
   * Performs manual "Sync Now" for a project
   */
  static async performManualSync(
    projectId: string,
    triggerType: 'manual' | 'scheduled' | 'webhook' = 'manual'
  ): Promise<{
    status: 'up_to_date' | 'completed' | 'failed';
    message: string;
    commitsCount: number;
    filesChangedCount: number;
    latestCommitSha?: string;
  }> {
    const startTime = Date.now();
    const config = await syncStorage.getConfig(projectId);
    if (!config || config.status === 'disconnected') {
      throw new Error('Project is not connected to a GitHub repository.');
    }

    // Set status to syncing
    await syncStorage.saveConfig({
      ...config,
      status: 'syncing',
    });

    try {
      const repoInfo = await this.validateAndGetRepoInfo(config.repo_url, config.github_token);
      const latestSha = repoInfo.latestCommitSha;

      // 1. Check if already up to date
      if (config.last_commit_sha && config.last_commit_sha === latestSha) {
        await syncStorage.saveConfig({
          ...config,
          status: 'up_to_date',
          last_synced_at: new Date().toISOString(),
          last_error: undefined,
        });

        await syncStorage.addHistory({
          project_id: projectId,
          trigger_type: triggerType,
          commit_sha: latestSha,
          commit_message: repoInfo.latestCommitMessage,
          commit_author: repoInfo.latestCommitAuthor,
          commits_count: 0,
          files_changed_count: 0,
          changed_files: [],
          status: 'completed',
          analysis_duration_ms: Date.now() - startTime,
        });

        return {
          status: 'up_to_date',
          message: 'Repository is already up to date. No new commits detected.',
          commitsCount: 0,
          filesChangedCount: 0,
          latestCommitSha: latestSha,
        };
      }

      // 2. Identify new commits and changed files
      let changedFilesList: ChangedFilePayload[] = [];
      let commitsCount = 1;
      let commitMessage = repoInfo.latestCommitMessage;
      let commitAuthor = repoInfo.latestCommitAuthor;

      if (config.last_commit_sha && config.last_commit_sha !== latestSha) {
        try {
          const diff = await this.getCompareDiff(
            config.repo_owner,
            config.repo_name,
            config.last_commit_sha,
            latestSha,
            config.github_token
          );
          commitsCount = diff.commits.length || 1;
          if (diff.commits.length > 0) {
            const last = diff.commits[diff.commits.length - 1];
            commitMessage = last.commit?.message || commitMessage;
            commitAuthor = last.commit?.author?.name || commitAuthor;
          }

          // Fetch contents for added/modified files (limit to top 30 to avoid rate limits)
          const fileTasks = (diff.files || []).slice(0, 30).map(async (file: any) => {
            let content = '';
            if (file.status !== 'removed') {
              content = await this.fetchFileContent(
                config.repo_owner,
                config.repo_name,
                file.filename,
                latestSha,
                config.github_token
              );
            }
            return {
              path: file.filename,
              status: file.status as any,
              content,
              patch: file.patch,
            };
          });

          changedFilesList = await Promise.all(fileTasks);
        } catch (compareErr) {
          console.warn('[Er.NEXA Sync] Compare diff error, using single commit fallback:', compareErr);
        }
      }

      // 3. Retrieve current project analysis
      let currentAnalysis: AnalysisResult | null = null;
      let projectName = config.repo_name;

      if (supabaseAdmin) {
        try {
          const { data: projData } = await supabaseAdmin.from('projects').select('name').eq('id', projectId).single();
          if (projData) projectName = projData.name;

          const { data: analysisData } = await supabaseAdmin.from('project_analyses').select('*').eq('project_id', projectId).single();
          if (analysisData) {
            currentAnalysis = {
              summary: analysisData.summary,
              flowchartMermaid: analysisData.flowchart_mermaid,
              blockDiagramMermaid: analysisData.block_diagram_mermaid,
              roadmap: analysisData.roadmap,
              progressMetrics: analysisData.progress_metrics,
            };
          }
        } catch {}
      }

      // 4. Run Incremental AI Analysis
      if (currentAnalysis && changedFilesList.length > 0) {
        const updatedAnalysis = await runIncrementalAnalysis(
          projectName,
          currentAnalysis,
          changedFilesList,
          commitMessage,
          latestSha
        );

        // Update database
        if (supabaseAdmin) {
          try {
            await supabaseAdmin.from('projects').update({
              completion_percentage: updatedAnalysis.progressMetrics.completionPercentage,
              updated_at: new Date().toISOString(),
            }).eq('id', projectId);

            await supabaseAdmin.from('project_analyses').update({
              summary: updatedAnalysis.summary,
              flowchart_mermaid: updatedAnalysis.flowchartMermaid,
              block_diagram_mermaid: updatedAnalysis.blockDiagramMermaid,
              roadmap: updatedAnalysis.roadmap,
              progress_metrics: updatedAnalysis.progressMetrics,
              updated_at: new Date().toISOString(),
            }).eq('project_id', projectId);

            // Record analysis version snapshot
            const { count } = await supabaseAdmin.from('project_analysis_versions').select('id', { count: 'exact', head: true }).eq('project_id', projectId);
            await supabaseAdmin.from('project_analysis_versions').insert({
              project_id: projectId,
              version_number: (count || 0) + 1,
              commit_sha: latestSha,
              summary: updatedAnalysis.summary,
              flowchart_mermaid: updatedAnalysis.flowchartMermaid,
              block_diagram_mermaid: updatedAnalysis.blockDiagramMermaid,
              progress_metrics: updatedAnalysis.progressMetrics,
              trigger_reason: `Git sync: ${commitMessage.slice(0, 80)}`,
            });
          } catch (dbErr) {
            console.warn('[Er.NEXA Sync] Database update warning:', dbErr);
          }
        }

        // 5. Incrementally update Knowledge Graph
        try {
          const graphFiles = changedFilesList.map((f) => ({
            path: f.path,
            content: f.content,
            size: f.content?.length || 0,
          }));
          const generatedGraph = KnowledgeGraphEngine.generateGraph(projectId, projectName, graphFiles, updatedAnalysis);
          await graphStorage.saveGraph(projectId, generatedGraph);
        } catch (graphErr) {
          console.warn('[Er.NEXA Sync] Graph update warning:', graphErr);
        }

        // 6. Refresh Roadmap Tasks
        try {
          await RoadmapEngine.refreshTasksOnSync(projectId, projectName, updatedAnalysis);
        } catch (taskErr) {
          console.warn('[Er.NEXA Sync] Task refresh warning:', taskErr);
        }
      }

      // 7. Update Sync Config Status & History
      await syncStorage.saveConfig({
        ...config,
        status: 'up_to_date',
        last_commit_sha: latestSha,
        last_synced_at: new Date().toISOString(),
        last_error: undefined,
      });

      await syncStorage.addHistory({
        project_id: projectId,
        trigger_type: triggerType,
        commit_sha: latestSha,
        commit_message: commitMessage,
        commit_author: commitAuthor,
        commits_count: commitsCount,
        files_changed_count: changedFilesList.length,
        changed_files: changedFilesList.map((f) => ({ path: f.path, status: f.status })),
        status: 'completed',
        analysis_duration_ms: Date.now() - startTime,
      });

      return {
        status: 'completed',
        message: `Successfully synchronized ${commitsCount} commit(s) and ${changedFilesList.length} changed file(s).`,
        commitsCount,
        filesChangedCount: changedFilesList.length,
        latestCommitSha: latestSha,
      };
    } catch (err: any) {
      await syncStorage.saveConfig({
        ...config,
        status: 'failed',
        last_error: err.message,
      });

      await syncStorage.addHistory({
        project_id: projectId,
        trigger_type: triggerType,
        commits_count: 0,
        files_changed_count: 0,
        changed_files: [],
        status: 'failed',
        error_message: err.message,
        analysis_duration_ms: Date.now() - startTime,
      });

      throw err;
    }
  }

  /**
   * Verifies GitHub Webhook HMAC SHA-256 signature
   */
  static verifyWebhookSignature(rawBuffer: Buffer, signatureHeader?: string, secret?: string): boolean {
    if (!secret) return true; // If no secret configured, allow (warn in logs)
    if (!signatureHeader) return false;

    try {
      const hmac = crypto.createHmac('sha256', secret);
      const digest = `sha256=${hmac.update(rawBuffer).digest('hex')}`;
      return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signatureHeader));
    } catch {
      return false;
    }
  }

  /**
   * Processes GitHub push webhook events
   */
  static async processWebhookPushEvent(
    deliveryId: string,
    payload: any,
    rawBuffer: Buffer,
    signatureHeader?: string
  ): Promise<{ success: boolean; message: string }> {
    // 1. Idempotency check
    const isProcessed = await syncStorage.isDeliveryProcessed(deliveryId);
    if (isProcessed) {
      return { success: true, message: 'Event already processed (idempotent skipped).' };
    }

    const repo = payload.repository;
    if (!repo || !repo.owner) {
      throw new Error('Invalid webhook payload: Missing repository metadata.');
    }

    const ownerName = repo.owner.name || repo.owner.login;
    const repoName = repo.name;

    // 2. Find associated Er.NEXA project
    const syncConfig = await syncStorage.findConfigByRepo(ownerName, repoName);
    if (!syncConfig) {
      return { success: false, message: `No Er.NEXA project connected to repository ${ownerName}/${repoName}.` };
    }

    // 3. Verify HMAC Signature
    if (syncConfig.webhook_secret) {
      const isValid = this.verifyWebhookSignature(rawBuffer, signatureHeader, syncConfig.webhook_secret);
      if (!isValid) {
        throw new Error('Invalid GitHub webhook signature. Verification failed.');
      }
    }

    // 4. Record Webhook Event
    await syncStorage.recordWebhookEvent({
      delivery_id: deliveryId,
      event_type: 'push',
      repo_full_name: repo.full_name || `${ownerName}/${repoName}`,
      project_id: syncConfig.project_id,
      commit_sha: payload.after,
      payload: {
        ref: payload.ref,
        commits_count: payload.commits?.length || 0,
        pusher: payload.pusher,
      },
      processed: true,
    });

    // 5. Execute Incremental Synchronization
    const syncResult = await this.performManualSync(syncConfig.project_id, 'webhook');
    return { success: true, message: syncResult.message };
  }
}
