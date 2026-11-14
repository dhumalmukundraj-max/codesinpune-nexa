import { Router, Response } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { graphStorage } from '../services/storage/graphStorage.js';
import { KnowledgeGraphEngine } from '../services/knowledgeGraphEngine.js';
import { supabaseAdmin } from '../config/index.js';

const router = Router({ mergeParams: true });

// 1. Get Knowledge Graph for a project
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    let graph = await graphStorage.getGraph(id);

    // If no graph exists yet, auto-generate from project analysis and files
    if (graph.nodes.length === 0) {
      let projectName = 'Software Project';
      let analysisData: any = null;
      let filesList: any[] = [];

      if (supabaseAdmin) {
        try {
          const [projRes, analysisRes, filesRes] = await Promise.all([
            supabaseAdmin.from('projects').select('name').eq('id', id).single(),
            supabaseAdmin.from('project_analyses').select('*').eq('project_id', id).single(),
            supabaseAdmin.from('project_files').select('file_path, file_size, language').eq('project_id', id).limit(200),
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
            filesList = (analysisRes.data.file_tree || []).map((f: any) => ({
              path: f.path || f.filePath,
              language: f.language,
              size: f.size || f.fileSize,
              content: f.content || '',
            }));
          }

          if (filesList.length === 0 && filesRes.data) {
            filesList = filesRes.data.map((f: any) => ({
              path: f.file_path,
              language: f.language,
              size: f.file_size,
            }));
          }
        } catch {}
      }

      graph = KnowledgeGraphEngine.generateGraph(id, projectName, filesList, analysisData);
      await graphStorage.saveGraph(id, graph);
    }

    res.json({
      success: true,
      graph,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve knowledge graph', message: err.message });
  }
});

// 2. Regenerate Knowledge Graph from project files
router.post('/generate', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    let projectName = 'Software Project';
    let analysisData: any = null;
    let filesList: any[] = [];

    if (supabaseAdmin) {
      try {
        const [projRes, analysisRes, filesRes] = await Promise.all([
          supabaseAdmin.from('projects').select('name').eq('id', id).single(),
          supabaseAdmin.from('project_analyses').select('*').eq('project_id', id).single(),
          supabaseAdmin.from('project_files').select('file_path, file_size, language').eq('project_id', id).limit(300),
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
          filesList = (analysisRes.data.file_tree || []).map((f: any) => ({
            path: f.path || f.filePath,
            language: f.language,
            size: f.size || f.fileSize,
            content: f.content || '',
          }));
        }

        if (filesList.length === 0 && filesRes.data) {
          filesList = filesRes.data.map((f: any) => ({
            path: f.file_path,
            language: f.language,
            size: f.file_size,
          }));
        }
      } catch {}
    }

    const graph = KnowledgeGraphEngine.generateGraph(id, projectName, filesList, analysisData);
    await graphStorage.saveGraph(id, graph);

    res.json({
      success: true,
      message: 'Knowledge graph regenerated successfully.',
      graph,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate knowledge graph', message: err.message });
  }
});

export default router;
