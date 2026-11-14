import cron, { ScheduledTask } from 'node-cron';
import { syncStorage } from './storage/syncStorage.js';
import { GitHubSyncService } from './githubSyncService.js';

export class SchedulerService {
  private static task: ScheduledTask | null = null;
  private static isRunning = false;

  /**
   * Initializes the server-side repository synchronization scheduler
   */
  static init() {
    if (this.task) {
      this.task.stop();
    }

    // Runs every 5 minutes to check eligible projects
    this.task = cron.schedule('*/5 * * * *', async () => {
      if (this.isRunning) return;
      this.isRunning = true;

      try {
        await this.checkAndRunScheduledSyncs();
      } catch (err) {
        console.error('[Er.NEXA Scheduler] Error in background sync task:', err);
      } finally {
        this.isRunning = false;
      }
    });

    console.log('⏰ [Er.NEXA] Scheduled Repository Synchronization service initialized (interval checks active)');
  }

  /**
   * Evaluates active configs against their configured intervals
   */
  static async checkAndRunScheduledSyncs() {
    const activeConfigs = await syncStorage.getAllActiveConfigs();
    const now = Date.now();

    for (const config of activeConfigs) {
      if (!config.sync_interval || config.sync_interval === 'disabled') continue;

      let intervalMs = 0;
      switch (config.sync_interval) {
        case '30m':
          intervalMs = 30 * 60 * 1000;
          break;
        case '1h':
          intervalMs = 60 * 60 * 1000;
          break;
        case '6h':
          intervalMs = 6 * 60 * 60 * 1000;
          break;
        case '24h':
          intervalMs = 24 * 60 * 60 * 1000;
          break;
      }

      if (intervalMs === 0) continue;

      const lastSync = config.last_synced_at ? new Date(config.last_synced_at).getTime() : 0;
      if (now - lastSync >= intervalMs) {
        console.log(`[Er.NEXA Scheduler] Triggering scheduled sync for project "${config.project_id}" (${config.repo_owner}/${config.repo_name})`);
        try {
          await GitHubSyncService.performManualSync(config.project_id, 'scheduled');
        } catch (err: any) {
          console.warn(`[Er.NEXA Scheduler] Scheduled sync failed for ${config.repo_owner}/${config.repo_name}:`, err.message);
        }
      }
    }
  }

  static stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
  }
}
