import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabaseAdmin } from '../../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../../../server/data/round3');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getLocalConfigPath(projectId: string): string {
  ensureDataDir();
  return path.join(DATA_DIR, `sync_config_${projectId}.json`);
}

function getLocalHistoryPath(projectId: string): string {
  ensureDataDir();
  return path.join(DATA_DIR, `sync_history_${projectId}.json`);
}

export interface GitHubSyncConfigRecord {
  id?: string;
  project_id: string;
  repo_owner: string;
  repo_name: string;
  repo_url: string;
  default_branch: string;
  github_token?: string;
  webhook_secret?: string;
  webhook_id?: number;
  sync_interval: 'disabled' | '30m' | '1h' | '6h' | '24h';
  last_synced_at?: string;
  last_commit_sha?: string;
  status: 'connected' | 'disconnected' | 'syncing' | 'up_to_date' | 'changes_detected' | 'failed';
  last_error?: string;
  created_at?: string;
  updated_at?: string;
}

export interface GitHubSyncHistoryRecord {
  id?: string;
  project_id: string;
  trigger_type: 'manual' | 'webhook' | 'scheduled' | 'initial';
  commit_sha?: string;
  commit_message?: string;
  commit_author?: string;
  commits_count: number;
  files_changed_count: number;
  changed_files: any[];
  status: 'started' | 'completed' | 'failed';
  error_message?: string;
  analysis_duration_ms?: number;
  created_at?: string;
}

export const syncStorage = {
  async getConfig(projectId: string): Promise<GitHubSyncConfigRecord | null> {
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('github_sync_configs')
          .select('*')
          .eq('project_id', projectId)
          .single();

        if (!error && data) return data as GitHubSyncConfigRecord;
      } catch {
        // Fallback to local
      }
    }

    const localFile = getLocalConfigPath(projectId);
    if (fs.existsSync(localFile)) {
      try {
        return JSON.parse(fs.readFileSync(localFile, 'utf-8'));
      } catch {
        return null;
      }
    }
    return null;
  },

  async getAllActiveConfigs(): Promise<GitHubSyncConfigRecord[]> {
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('github_sync_configs')
          .select('*')
          .neq('sync_interval', 'disabled')
          .neq('status', 'disconnected');

        if (!error && data) return data as GitHubSyncConfigRecord[];
      } catch {
        // Fallback to local
      }
    }

    ensureDataDir();
    const configs: GitHubSyncConfigRecord[] = [];
    const files = fs.readdirSync(DATA_DIR);
    for (const file of files) {
      if (file.startsWith('sync_config_') && file.endsWith('.json')) {
        try {
          const cfg = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'));
          if (cfg.sync_interval && cfg.sync_interval !== 'disabled' && cfg.status !== 'disconnected') {
            configs.push(cfg);
          }
        } catch {}
      }
    }
    return configs;
  },

  async findConfigByRepo(repoOwner: string, repoName: string): Promise<GitHubSyncConfigRecord | null> {
    const ownerLower = repoOwner.toLowerCase();
    const nameLower = repoName.toLowerCase();

    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('github_sync_configs')
          .select('*')
          .ilike('repo_owner', ownerLower)
          .ilike('repo_name', nameLower)
          .single();

        if (!error && data) return data as GitHubSyncConfigRecord;
      } catch {}
    }

    ensureDataDir();
    const files = fs.readdirSync(DATA_DIR);
    for (const file of files) {
      if (file.startsWith('sync_config_') && file.endsWith('.json')) {
        try {
          const cfg = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'));
          if (
            cfg.repo_owner?.toLowerCase() === ownerLower &&
            cfg.repo_name?.toLowerCase() === nameLower
          ) {
            return cfg;
          }
        } catch {}
      }
    }
    return null;
  },

  async saveConfig(config: GitHubSyncConfigRecord): Promise<GitHubSyncConfigRecord> {
    const record: GitHubSyncConfigRecord = {
      ...config,
      updated_at: new Date().toISOString(),
      created_at: config.created_at || new Date().toISOString(),
    };

    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('github_sync_configs')
          .upsert(record, { onConflict: 'project_id' })
          .select()
          .single();

        if (!error && data) {
          // Keep local backup in sync
          fs.writeFileSync(getLocalConfigPath(record.project_id), JSON.stringify(data, null, 2));
          return data as GitHubSyncConfigRecord;
        }
      } catch {}
    }

    fs.writeFileSync(getLocalConfigPath(record.project_id), JSON.stringify(record, null, 2));
    return record;
  },

  async deleteConfig(projectId: string): Promise<void> {
    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('github_sync_configs').delete().eq('project_id', projectId);
      } catch {}
    }

    const localFile = getLocalConfigPath(projectId);
    if (fs.existsSync(localFile)) {
      fs.unlinkSync(localFile);
    }
  },

  async addHistory(item: GitHubSyncHistoryRecord): Promise<GitHubSyncHistoryRecord> {
    const record: GitHubSyncHistoryRecord = {
      ...item,
      created_at: item.created_at || new Date().toISOString(),
    };

    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('github_sync_history')
          .insert(record)
          .select()
          .single();

        if (!error && data) {
          this.appendLocalHistory(record.project_id, data);
          return data as GitHubSyncHistoryRecord;
        }
      } catch {}
    }

    this.appendLocalHistory(record.project_id, record);
    return record;
  },

  async getHistory(projectId: string, limit: number = 20): Promise<GitHubSyncHistoryRecord[]> {
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('github_sync_history')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (!error && data) return data as GitHubSyncHistoryRecord[];
      } catch {}
    }

    const localFile = getLocalHistoryPath(projectId);
    if (fs.existsSync(localFile)) {
      try {
        const items = JSON.parse(fs.readFileSync(localFile, 'utf-8'));
        return (items || []).slice(0, limit);
      } catch {
        return [];
      }
    }
    return [];
  },

  appendLocalHistory(projectId: string, record: GitHubSyncHistoryRecord) {
    const localFile = getLocalHistoryPath(projectId);
    let items: GitHubSyncHistoryRecord[] = [];
    if (fs.existsSync(localFile)) {
      try {
        items = JSON.parse(fs.readFileSync(localFile, 'utf-8'));
      } catch {
        items = [];
      }
    }
    items.unshift(record);
    if (items.length > 50) items = items.slice(0, 50);
    fs.writeFileSync(localFile, JSON.stringify(items, null, 2));
  },

  async isDeliveryProcessed(deliveryId: string): Promise<boolean> {
    if (supabaseAdmin) {
      try {
        const { data } = await supabaseAdmin
          .from('webhook_events')
          .select('id')
          .eq('delivery_id', deliveryId)
          .single();
        if (data) return true;
      } catch {}
    }
    return false;
  },

  async recordWebhookEvent(event: {
    delivery_id: string;
    event_type: string;
    repo_full_name: string;
    project_id?: string;
    commit_sha?: string;
    payload?: any;
    processed?: boolean;
  }) {
    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('webhook_events').insert({
          delivery_id: event.delivery_id,
          event_type: event.event_type,
          repo_full_name: event.repo_full_name,
          project_id: event.project_id || null,
          commit_sha: event.commit_sha || null,
          payload: event.payload || {},
          processed: Boolean(event.processed),
        });
      } catch {}
    }
  },
};

