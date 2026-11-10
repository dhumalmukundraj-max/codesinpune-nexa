import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, optionalAuth } from '../middleware/auth.js';
import { supabaseAdmin, geminiClient, isConfigured, config } from '../config/index.js';
import { generateContentWithResilience } from '../services/geminiResilience.js';

const router = Router();

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// 1. Launch Assistant Trigger / Deep Link Handoff
router.post('/launch', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { projectId } = req.body;
    res.json({
      success: true,
      deepLink: `ernexa://assistant?projectId=${projectId}`,
      webFallbackUrl: `/assistant?projectId=${projectId}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate launch link', message: err.message });
  }
});

// 2. Get Project Context for Launch Assistant (Password Protected)
router.get('/:projectId/context', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const unlockToken = (req.headers['x-project-token'] as string) || (req.query.token as string);

    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Database not available' });
      return;
    }

    const { data: project, error: pErr } = await supabaseAdmin
      .from('projects')
      .select('id, name, description, completion_percentage, frameworks, languages, status, has_password')
      .eq('id', projectId)
      .single();

    if (pErr || !project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Enforce project-specific password for assistant context
    if (project.has_password) {
      let isUnlocked = false;
      if (unlockToken) {
        try {
          const decoded = jwt.verify(unlockToken, config.jwtSecret) as any;
          if (decoded && decoded.projectId === projectId) {
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
          },
          isLocked: true,
        });
        return;
      }
    }

    const { data: analysis, error: aErr } = await supabaseAdmin
      .from('project_analyses')
      .select('summary, flowchart_mermaid, block_diagram_mermaid, roadmap, progress_metrics, raw_stats')
      .eq('project_id', projectId)
      .single();

    if (aErr || !analysis) {
      res.status(404).json({ error: 'Project analysis not found' });
      return;
    }

    res.json({
      project: {
        ...project,
        isLocked: false,
      },
      analysis,
      isLocked: false,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load project context', message: err.message });
  }
});

// 2. Chat with Project Assistant (AI Engine - Password Protected)
router.post('/:projectId/chat', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { message, history, activeFileContext } = req.body;
    const unlockToken = (req.headers['x-project-token'] as string) || (req.body.unlockToken as string);

    if (!message || message.trim().length === 0) {
      res.status(400).json({ error: 'Message cannot be empty.' });
      return;
    }

    if (!isConfigured.gemini || !geminiClient) {
      res.status(503).json({
        error: 'Gemini Not Configured',
        message: 'Google Gemini API is not configured in .env. Assistant chat requires GEMINI_API_KEY.',
      });
      return;
    }

    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Database not available' });
      return;
    }

    // Load Project Knowledge Base
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('id, name, description, completion_percentage, has_password')
      .eq('id', projectId)
      .single();

    if (!project) {
      res.status(404).json({ error: 'Project not found for the given ID.' });
      return;
    }

    // Enforce project-specific password for assistant chat
    if (project.has_password) {
      let isUnlocked = false;
      if (unlockToken) {
        try {
          const decoded = jwt.verify(unlockToken, config.jwtSecret) as any;
          if (decoded && decoded.projectId === projectId) {
            isUnlocked = true;
          }
        } catch {
          isUnlocked = false;
        }
      }

      if (!isUnlocked) {
        res.status(401).json({
          error: 'This project is password-protected. Please enter the project password to access the Launch Assistant.',
          isLocked: true,
        });
        return;
      }
    }

    const { data: analysis } = await supabaseAdmin
      .from('project_analyses')
      .select('summary, flowchart_mermaid, block_diagram_mermaid, roadmap, progress_metrics')
      .eq('project_id', projectId)
      .single();

    if (!analysis) {
      res.status(404).json({ error: 'Project analysis not found for the given ID.' });
      return;
    }

    const knowledgeBase = `
PROJECT KNOWLEDGE BASE FOR "${project.name}" (ID: ${project.id})
Current Completion: ${project.completion_percentage}%

1. SUMMARY & INTRODUCTION:
${JSON.stringify(analysis.summary?.introduction || {}, null, 2)}

2. TECHNICAL DECISIONS & EVIDENCE:
${JSON.stringify(analysis.summary?.decisions || [], null, 2)}

3. EXISTING FUNCTIONALITIES:
${JSON.stringify(analysis.summary?.existingFunctionalities || [], null, 2)}

4. UNFINISHED TASKS & TODOS:
${JSON.stringify(analysis.summary?.unfinishedTasks || [], null, 2)}

5. TECHNICAL DOCUMENTATION & SETUP:
${JSON.stringify(analysis.summary?.technicalDocumentation || {}, null, 2)}

6. DEPENDENCIES:
${JSON.stringify(analysis.summary?.dependencies || [], null, 2)}

7. ROADMAP & PHASES:
${JSON.stringify(analysis.roadmap || {}, null, 2)}

8. PROGRESS METRICS:
${JSON.stringify(analysis.progress_metrics || {}, null, 2)}

9. SYSTEM ARCHITECTURE & BLOCK DIAGRAM (MERMAID):
${analysis.block_diagram_mermaid || 'None'}

10. SYSTEM FLOWCHART (MERMAID):
${analysis.flowchart_mermaid || 'None'}
`;

    const activeFileSection = activeFileContext
      ? `\nCURRENTLY ACTIVE FILE IN DESKTOP ASSISTANT:\nPath: ${activeFileContext.path}\nContent:\n\`\`\`\n${activeFileContext.content}\n\`\`\`\n`
      : '';

    // Convert past history
    const pastChatContext = (history || [])
      .slice(-6)
      .map((h: ChatMessage) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
      .join('\n');

    const prompt = `
You are the Er.NEXA Desktop Launch Assistant for the project "${project.name}".
Your goal is to guide developers, reviewers, and engineering teams using EXCLUSIVELY this project's reconstructed knowledge.

GROUNDING & INTEGRITY RULES:
1. ONLY answer questions using the Project Knowledge Base provided below.
2. NEVER mix information from other projects or fabricate details.
3. If an answer cannot be determined from the knowledge base, state clearly: "Based on the project's reconstructed knowledge base, this information is not documented."
4. Whenever you reference a decision, functionality, or task, provide a source tag, such as "[Source: Technical Decisions - Topic]" or "[Source: Unfinished Tasks]" or "[File: path/to/file]".
5. Provide actionable advice for next development steps when asked, respecting the existing project architecture.
6. Keep answers concise, structured, and easy to read in a compact desktop assistant window.

${knowledgeBase}

${activeFileSection}

PAST CONVERSATION:
${pastChatContext}

USER INQUIRY:
${message}

Respond directly as the Launch Assistant with markdown formatting and source references:
`;

    const responseText = await generateContentWithResilience({
      prompt,
      temperature: 0.3,
      label: `Launch Assistant for "${project.name}"`,
    });

    // Extract source citations if present
    const sourceMatches = responseText.match(/\[(?:Source|File): [^\]]+\]/g) || [];
    const sources = Array.from(new Set(sourceMatches.map((s) => s.replace(/[\[\]]/g, ''))));

    res.json({
      response: responseText,
      sources,
      projectId: project.id,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Launch Assistant chat error:', err);
    res.status(500).json({ error: 'Assistant failed to respond', message: err.message });
  }
});

export default router;
