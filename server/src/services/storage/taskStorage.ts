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

function getLocalTaskPath(projectId: string): string {
  ensureDataDir();
  return path.join(DATA_DIR, `tasks_${projectId}.json`);
}

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskStatus = 'suggested' | 'accepted' | 'rejected' | 'pending' | 'in_progress' | 'completed';
export type GapType =
  | 'incomplete_functionality'
  | 'unfinished_task'
  | 'missing_error_handling'
  | 'missing_validation'
  | 'missing_tests'
  | 'documentation_gap'
  | 'technical_debt'
  | 'dependency_issue'
  | 'general_enhancement';

export interface ProjectTaskRecord {
  id: string;
  project_id: string;
  phase_id: string;
  phase_name: string;
  title: string;
  description: string;
  reason?: string;
  evidence?: string;
  source_file_refs?: string[];
  priority: TaskPriority;
  priority_rationale?: string;
  estimated_complexity?: 'small' | 'medium' | 'large';
  dependencies?: string[];
  suggested_owner?: string;
  assigned_owner?: string;
  status: TaskStatus;
  implementation_steps?: string[];
  expected_outcome?: string;
  gap_type?: GapType;
  evidence_verification?: 'verified_issue' | 'ai_inferred_issue' | 'unknown_evidence';
  created_at?: string;
  updated_at?: string;
}

export interface RoadmapPhaseSummary {
  id: string;
  name: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  tasks: ProjectTaskRecord[];
}

export const taskStorage = {
  async getTasks(projectId: string): Promise<ProjectTaskRecord[]> {
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('project_tasks')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
          return data as ProjectTaskRecord[];
        }
      } catch {}
    }

    const localFile = getLocalTaskPath(projectId);
    if (fs.existsSync(localFile)) {
      try {
        return JSON.parse(fs.readFileSync(localFile, 'utf-8'));
      } catch {}
    }

    return [];
  },

  async saveTasks(projectId: string, tasks: ProjectTaskRecord[]): Promise<ProjectTaskRecord[]> {
    const formatted = tasks.map((t) => ({
      ...t,
      project_id: projectId,
      updated_at: new Date().toISOString(),
      created_at: t.created_at || new Date().toISOString(),
    }));

    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('project_tasks').delete().eq('project_id', projectId);
        if (formatted.length > 0) {
          const chunkSize = 50;
          for (let i = 0; i < formatted.length; i += chunkSize) {
            await supabaseAdmin.from('project_tasks').insert(formatted.slice(i, i + chunkSize));
          }
        }
      } catch {}
    }

    fs.writeFileSync(getLocalTaskPath(projectId), JSON.stringify(formatted, null, 2));
    return formatted;
  },

  async upsertTask(projectId: string, task: ProjectTaskRecord): Promise<ProjectTaskRecord> {
    const existing = await this.getTasks(projectId);
    const index = existing.findIndex((t) => t.id === task.id);
    const updatedTask = {
      ...task,
      project_id: projectId,
      updated_at: new Date().toISOString(),
      created_at: task.created_at || new Date().toISOString(),
    };

    if (index >= 0) {
      existing[index] = updatedTask;
    } else {
      existing.push(updatedTask);
    }

    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('project_tasks').upsert(updatedTask);
      } catch {}
    }

    fs.writeFileSync(getLocalTaskPath(projectId), JSON.stringify(existing, null, 2));
    return updatedTask;
  },

  async deleteTask(projectId: string, taskId: string): Promise<void> {
    const existing = await this.getTasks(projectId);
    const filtered = existing.filter((t) => t.id !== taskId);

    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('project_tasks').delete().eq('id', taskId).eq('project_id', projectId);
      } catch {}
    }

    fs.writeFileSync(getLocalTaskPath(projectId), JSON.stringify(filtered, null, 2));
  },
};

