import { Router, Response } from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { AuthenticatedRequest, optionalAuth, requireAuth } from '../middleware/auth.js';
import { parseZipBuffer, parseLocalDirectory, parseBrowserUploadedFiles, ParsedProject } from '../services/fileParser.js';
import { fetchGitHubRepo } from '../services/githubService.js';
import { analyzeProjectWithGemini, type AnalysisResult } from '../services/geminiService.js';
import { isConfigured, supabaseAdmin } from '../config/index.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
    fieldSize: 100 * 1024 * 1024, // 100MB max for text fields (e.g. folderFiles JSON)
  },
});

// 1. Preview Project (Before Analysis)
router.post('/preview', upload.single('zipFile'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { sourceType, repoUrl, githubToken, localPath, folderFiles } = req.body;
    let parsed: ParsedProject;

    if (req.file) {
      parsed = parseZipBuffer(req.file.buffer, req.file.originalname);
    } else if (sourceType === 'github' && repoUrl) {
      parsed = await fetchGitHubRepo(repoUrl, githubToken);
    } else if (sourceType === 'desktop' && localPath) {
      parsed = parseLocalDirectory(localPath);
    } else if (folderFiles) {
      const filesArray = typeof folderFiles === 'string' ? JSON.parse(folderFiles) : folderFiles;
      parsed = parseBrowserUploadedFiles(filesArray);
    } else {
      res.status(400).json({ error: 'No project source provided for preview.' });
      return;
    }

    res.json({
      name: parsed.name,
      totalFiles: parsed.totalFiles,
      totalSize: parsed.totalSize,
      languages: parsed.languages,
      frameworks: parsed.frameworks,
      folderStructure: parsed.folderStructure,
      files: parsed.files.map((f) => ({
        path: f.path,
        size: f.size,
        language: f.language,
      })),
      sampleFiles: parsed.files.slice(0, 50).map((f) => ({
        path: f.path,
        size: f.size,
        language: f.language,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to preview project', message: err.message });
  }
});

// 2. Full Project Intelligence Analysis & Optional Direct DB Connection
router.post('/run', upload.single('zipFile'), optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!isConfigured.gemini) {
      res.status(503).json({
        error: 'Gemini Not Configured',
        message: 'Google Gemini API key is missing. Please set GEMINI_API_KEY in your .env file.',
      });
      return;
    }

    const { sourceType, repoUrl, githubToken, localPath, folderFiles, customName, autoSave, projectId, projectPassword } = req.body;
    let parsed: ParsedProject;

    if (req.file) {
      parsed = parseZipBuffer(req.file.buffer, req.file.originalname);
    } else if (sourceType === 'github' && repoUrl) {
      parsed = await fetchGitHubRepo(repoUrl, githubToken);
    } else if (sourceType === 'desktop' && localPath) {
      parsed = parseLocalDirectory(localPath);
    } else if (folderFiles) {
      const filesArray = typeof folderFiles === 'string' ? JSON.parse(folderFiles) : folderFiles;
      parsed = parseBrowserUploadedFiles(filesArray);
    } else {
      res.status(400).json({ error: 'No project source provided for analysis.' });
      return;
    }

    if (parsed.files.length === 0) {
      res.status(400).json({
        error: 'Empty Project',
        message: 'No analyzable source files found in the provided project. Make sure the project folder or ZIP contains readable code files.',
      });
      return;
    }

    const effectiveName = customName || parsed.name;
    const analysis: AnalysisResult = await analyzeProjectWithGemini(
      effectiveName,
      parsed.files,
      parsed.folderStructure
    );

    // If autoSave is requested or projectId provided, connect to Supabase
    let savedProjectId: string | null = null;
    if (autoSave && req.user && supabaseAdmin) {
      const userId = req.user.id;
      const compPct = analysis.progressMetrics?.completionPercentage || 0;

      if (projectId) {
        // Update existing project
        await supabaseAdmin
          .from('projects')
          .update({
            completion_percentage: compPct,
            languages: parsed.languages,
            frameworks: parsed.frameworks,
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId);

        await supabaseAdmin
          .from('project_analyses')
          .update({
            summary: analysis.summary,
            flowchart_mermaid: analysis.flowchartMermaid,
            block_diagram_mermaid: analysis.blockDiagramMermaid,
            roadmap: analysis.roadmap,
            progress_metrics: analysis.progressMetrics,
            updated_at: new Date().toISOString(),
          })
          .eq('project_id', projectId);

        savedProjectId = projectId;
      } else {
        // Password hashing if specified
        let projectPasswordHash = null;
        let hasPassword = false;
        if (projectPassword && typeof projectPassword === 'string' && projectPassword.trim().length > 0) {
          projectPasswordHash = await bcrypt.hash(projectPassword.trim(), 10);
          hasPassword = true;
        }

        // Insert new project
        const { data: proj, error: projErr } = await supabaseAdmin
          .from('projects')
          .insert({
            user_id: userId,
            name: effectiveName,
            description: analysis.summary?.introduction?.tagline || '',
            project_password_hash: projectPasswordHash,
            has_password: hasPassword,
            status: 'ready',
            completion_percentage: compPct,
            languages: parsed.languages,
            frameworks: parsed.frameworks,
            source_type: sourceType || 'folder',
            repository_url: repoUrl || null,
          })
          .select('id')
          .single();

        if (projErr) {
          console.error('AutoSave project creation error:', projErr);
        } else if (proj) {
          savedProjectId = proj.id;
          await supabaseAdmin.from('project_analyses').insert({
            project_id: proj.id,
            summary: analysis.summary,
            flowchart_mermaid: analysis.flowchartMermaid,
            block_diagram_mermaid: analysis.blockDiagramMermaid,
            roadmap: analysis.roadmap,
            progress_metrics: analysis.progressMetrics,
            file_tree: parsed.files.slice(0, 500).map((f) => ({ path: f.path, size: f.size, language: f.language })),
          });

          await supabaseAdmin.from('project_permissions').insert({
            project_id: proj.id,
            user_id: userId,
            user_email: req.user.email,
            role: 'owner',
            granted_by: userId,
          });

          // Insert file metadata records
          const fileRecords = parsed.files.slice(0, 100).map((f) => ({
            project_id: proj.id,
            file_path: f.path,
            file_size: f.size,
            language: f.language,
          }));
          if (fileRecords.length > 0) {
            await supabaseAdmin.from('project_files').insert(fileRecords);
          }
        }
      }
    }

    res.json({
      success: true,
      savedProjectId,
      project: {
        name: effectiveName,
        totalFiles: parsed.totalFiles,
        totalSize: parsed.totalSize,
        languages: parsed.languages,
        frameworks: parsed.frameworks,
        folderStructure: parsed.folderStructure,
        files: parsed.files.map((f) => ({
          path: f.path,
          size: f.size,
          language: f.language,
        })),
      },
      analysis,
    });
  } catch (err: any) {
    console.error('Analysis execution error:', err);
    res.status(500).json({
      error: 'Analysis Failed',
      message: err.message || 'An unexpected error occurred during AI analysis.',
    });
  }
});

export default router;
