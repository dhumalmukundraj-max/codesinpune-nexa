import { Router, Response } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { taskStorage } from '../services/storage/taskStorage.js';
import { RoadmapEngine } from '../services/roadmapEngine.js';
import { supabaseAdmin } from '../config/index.js';

const router = Router({ mergeParams: true });

// 1. Get Roadmap Tasks & Phases for a project
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    let tasks = await taskStorage.getTasks(id);

    // If no tasks exist yet, auto-generate from project analysis
    if (tasks.length === 0) {
      let projectName = 'Software Project';
      let analysisData: any = null;

      if (supabaseAdmin) {
        try {
          const [projRes, analysisRes] = await Promise.all([
            supabaseAdmin.from('projects').select('name').eq('id', id).single(),
            supabaseAdmin.from('project_analyses').select('*').eq('project_id', id).single(),
          ]);

          if (projRes.data) projectName = projRes.data.name;
          if (analysisRes.data) {
            analysisData = {
              summary: analysisRes.data.summary,
              flowchartMermaid: analysisRes.data.flowchart_mermaid,
              blockDiagramMermaid: analysisRes.data.block_diagram_mermaid,
              roadmap: analysisRes.data.roadmap,
              progressMetrics: analysisRes.data.progress_metrics,
            };
          }
        } catch {}
      }

      if (analysisData) {
        tasks = await RoadmapEngine.generateTasksFromGaps(id, projectName, analysisData);
      }
    }

    const phases = RoadmapEngine.groupTasksByPhase(tasks);

    res.json({
      success: true,
      tasks,
      phases,
      summary: {
        total: tasks.length,
        completed: tasks.filter((t) => t.status === 'completed').length,
        inProgress: tasks.filter((t) => t.status === 'in_progress').length,
        pending: tasks.filter((t) => t.status === 'pending' || t.status === 'suggested').length,
        critical: tasks.filter((t) => t.priority === 'critical').length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve tasks', message: err.message });
  }
});

// 2. Generate or Refresh AI Task Recommendations from detected gaps
router.post('/generate', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    let projectName = 'Software Project';
    let analysisData: any = null;

    if (supabaseAdmin) {
      try {
        const [projRes, analysisRes] = await Promise.all([
          supabaseAdmin.from('projects').select('name').eq('id', id).single(),
          supabaseAdmin.from('project_analyses').select('*').eq('project_id', id).single(),
        ]);

        if (projRes.data) projectName = projRes.data.name;
        if (analysisRes.data) {
          analysisData = {
            summary: analysisRes.data.summary,
            flowchartMermaid: analysisRes.data.flowchart_mermaid,
            blockDiagramMermaid: analysisRes.data.block_diagram_mermaid,
            roadmap: analysisRes.data.roadmap,
            progressMetrics: analysisRes.data.progress_metrics,
          };
        }
      } catch {}
    }

    if (!analysisData) {
      res.status(404).json({ error: 'Project analysis not found. Run analysis first.' });
      return;
    }

    const tasks = await RoadmapEngine.generateTasksFromGaps(id, projectName, analysisData);
    const phases = RoadmapEngine.groupTasksByPhase(tasks);

    res.json({
      success: true,
      message: 'AI task recommendations refreshed successfully.',
      tasks,
      phases,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate task recommendations', message: err.message });
  }
});

// 3. Update an existing Task (accept, reject, change status, assign owner, edit details)
router.patch('/:taskId', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const taskId = req.params.taskId as string;
    const updates = req.body;

    const existingTasks = await taskStorage.getTasks(id);
    const targetTask = existingTasks.find((t) => t.id === taskId);

    if (!targetTask) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    const updatedTask = {
      ...targetTask,
      ...updates,
      id: taskId,
      project_id: id,
    };

    const saved = await taskStorage.upsertTask(id, updatedTask);
    const allTasks = await taskStorage.getTasks(id);
    const phases = RoadmapEngine.groupTasksByPhase(allTasks);

    res.json({
      success: true,
      task: saved,
      phases,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update task', message: err.message });
  }
});

// 4. Delete or dismiss a task
router.delete('/:taskId', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const taskId = req.params.taskId as string;
    await taskStorage.deleteTask(id, taskId);

    const allTasks = await taskStorage.getTasks(id);
    const phases = RoadmapEngine.groupTasksByPhase(allTasks);

    res.json({
      success: true,
      message: 'Task removed successfully.',
      phases,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete task', message: err.message });
  }
});

export default router;
