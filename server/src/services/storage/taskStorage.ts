import fs from 'fs';
import path from 'path';
import os from 'os';
import { supabaseAdmin } from '../../config/index.js';

function getDataDir(): string {
  const candidates = [
    path.resolve(process.cwd(), 'data/round3'),
    path.resolve(process.cwd(), 'server/data/round3'),
    path.join(os.tmpdir(), 'ernexa_round3'),
  ];

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) {
        fs.mkdirSync(candidate, { recursive: true });
      }
      const testFile = path.join(candidate, '.write_test_task');
      fs.writeFileSync(testFile, 'ok', 'utf-8');
      fs.unlinkSync(testFile);
      return candidate;
    } catch {}
  }
  return '';
}

function getLocalTaskPath(projectId: string): string {
  const dir = getDataDir();
  return dir ? path.join(dir, `tasks_${projectId}.json`) : '';
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

// In-memory cache for tasks
const memoryTasks = new Map<string, ProjectTaskRecord[]>();

export const taskStorage = {
  async getTasks(projectId: string): Promise<ProjectTaskRecord[]> {
    // 1. Try Supabase
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('project_tasks')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
          memoryTasks.set(projectId, data as ProjectTaskRecord[]);
          return data as ProjectTaskRecord[];
        }
      } catch {}
    }

    // 2. Try Local File
    const localFile = getLocalTaskPath(projectId);
    if (localFile && fs.existsSync(localFile)) {
      try {
        const tasks = JSON.parse(fs.readFileSync(localFile, 'utf-8'));
        memoryTasks.set(projectId, tasks);
        return tasks;
      } catch {}
    }

    // 3. Fallback to memory
    return memoryTasks.get(projectId) || [];
  },

  async saveTasks(projectId: string, tasks: ProjectTaskRecord[]): Promise<ProjectTaskRecord[]> {
    const formatted = tasks.map((t, idx) => ({
      ...t,
      id: t.id || `task-${projectId.slice(0, 8)}-${idx + 1}`,
      project_id: projectId,
      updated_at: new Date().toISOString(),
      created_at: t.created_at || new Date().toISOString(),
    }));

    memoryTasks.set(projectId, formatted);

    // Persist to Supabase
    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('project_tasks').delete().eq('project_id', projectId);
        if (formatted.length > 0) {
          const chunkSize = 40;
          for (let i = 0; i < formatted.length; i += chunkSize) {
            await supabaseAdmin.from('project_tasks').insert(formatted.slice(i, i + chunkSize));
          }
        }
      } catch (err: any) {
        console.warn('[Er.NEXA taskStorage] Supabase saveTasks notice:', err.message);
      }
    }

    // Persist to local disk
    try {
      const localFile = getLocalTaskPath(projectId);
      if (localFile) {
        fs.writeFileSync(localFile, JSON.stringify(formatted, null, 2), 'utf-8');
      }
    } catch {}

    return formatted;
  },

  async upsertTask(projectId: string, task: ProjectTaskRecord): Promise<ProjectTaskRecord> {
    const existing = await this.getTasks(projectId);
    const updated = {
      ...task,
      project_id: projectId,
      updated_at: new Date().toISOString(),
      created_at: task.created_at || new Date().toISOString(),
    };

    const index = existing.findIndex((t) => t.id === task.id);
    if (index >= 0) {
      existing[index] = updated;
    } else {
      existing.push(updated);
    }

    // Persist single task to Supabase
    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('project_tasks').upsert(updated);
      } catch (err: any) {
        console.warn('[Er.NEXA taskStorage] Supabase upsertTask notice:', err.message);
      }
    }

    await this.saveTasks(projectId, existing);
    return updated;
  },

  async deleteTask(projectId: string, taskId: string): Promise<void> {
    const existing = await this.getTasks(projectId);
    const filtered = existing.filter((t) => t.id !== taskId);

    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('project_tasks').delete().eq('id', taskId).eq('project_id', projectId);
      } catch {}
    }

    await this.saveTasks(projectId, filtered);
  },
};
