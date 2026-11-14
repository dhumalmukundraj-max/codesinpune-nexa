import { GoogleGenerativeAI } from '@google/generative-ai';
import { config, isConfigured } from '../config/index.js';
import { AnalysisResult } from './geminiServiceTypes.js';

export interface ChangedFilePayload {
  path: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  content?: string;
  previousPath?: string;
  patch?: string;
}

export async function runIncrementalAnalysis(
  projectName: string,
  currentAnalysis: AnalysisResult,
  changedFiles: ChangedFilePayload[],
  commitMessage: string,
  commitSha: string
): Promise<AnalysisResult> {
  // If Gemini is not configured, apply safe code-rule heuristics
  if (!isConfigured.gemini) {
    return applyFallbackIncrementalRules(currentAnalysis, changedFiles);
  }

  try {
    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: config.geminiModel || 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const changedFilesSummary = changedFiles.map((f) => {
      const truncatedContent = f.content ? f.content.slice(0, 4000) : '';
      return `File: ${f.path} [Status: ${f.status}]${f.patch ? `\nDiff:\n${f.patch.slice(0, 1500)}` : ''}${truncatedContent ? `\nContent snippet:\n${truncatedContent}` : ''}`;
    }).join('\n\n---\n\n');

    const prompt = `
You are Er.NEXA — AI-Powered Incremental Knowledge Reconstruction Engine.
A project named "${projectName}" received a new Git commit:
Commit SHA: ${commitSha}
Commit Message: "${commitMessage}"

Number of changed files: ${changedFiles.length}
Changed files details:
${changedFilesSummary.slice(0, 30000)}

Current Project Knowledge Summary:
${JSON.stringify({
  introduction: currentAnalysis.summary.introduction,
  existingFunctionalities: currentAnalysis.summary.existingFunctionalities,
  unfinishedTasks: currentAnalysis.summary.unfinishedTasks,
  decisions: currentAnalysis.summary.decisions,
  dependencies: currentAnalysis.summary.dependencies,
  completionPercentage: currentAnalysis.progressMetrics.completionPercentage,
  problemStatement: currentAnalysis.progressMetrics.problemStatement,
}, null, 2)}

TASK:
Perform an INCREMENTAL update to the project knowledge model:
1. Analyze the changed files. Identify what new capabilities or bug fixes were implemented.
2. Invalidate or update any knowledge associated with removed or renamed files.
3. If an existing unfinished task or stub has now been resolved in this commit, remove it from unfinishedTasks or mark it completed.
4. If new TODOs, FIXMEs, or stubs were introduced, add them to unfinishedTasks.
5. If new dependencies were added/removed (e.g. in package.json/requirements.txt), update the dependencies list.
6. Re-evaluate the core problem statement completion percentage strictly based on core functionality working, NOT on future roadmap wishlists.
7. Return a complete, valid JSON matching the exact schema below with the updated data. Preserve unaffected decisions and facts.

OUTPUT SCHEMA (Strict JSON):
{
  "summary": {
    "introduction": {
      "name": "string",
      "tagline": "string",
      "description": "string",
      "primaryLanguages": ["string"],
      "frameworks": ["string"],
      "architectureStyle": "string",
      "verifiedFacts": ["string"],
      "aiInferences": ["string"],
      "unknowns": ["string"]
    },
    "decisions": [
      {
        "topic": "string",
        "decision": "string",
        "evidenceFile": "string",
        "status": "verified" | "inferred" | "unknown"
      }
    ],
    "technicalDocumentation": {
      "setupInstructions": ["string"],
      "environmentVariables": [{ "key": "string", "description": "string", "required": true }],
      "scripts": [{ "command": "string", "purpose": "string" }],
      "apiEndpoints": [{ "method": "string", "path": "string", "description": "string" }]
    },
    "existingFunctionalities": [
      {
        "title": "string",
        "description": "string",
        "filesInvolved": ["string"],
        "status": "fully_implemented" | "partially_implemented"
      }
    ],
    "unfinishedTasks": [
      {
        "title": "string",
        "description": "string",
        "location": "string",
        "type": "TODO" | "FIXME" | "STUB" | "MISSING_FEATURE",
        "priority": "high" | "medium" | "low"
      }
    ],
    "dependencies": [
      {
        "name": "string",
        "version": "string",
        "category": "core" | "ui" | "backend" | "dev" | "database" | "ai" | "other",
        "purpose": "string"
      }
    ],
    "discussionsAndCommunications": {
      "foundSources": ["string"],
      "notes": ["string"],
      "hasHistoricalRecords": true
    },
    "futurePlansAndActions": ["string"],
    "missingOrContradictoryInformation": ["string"]
  },
  "flowchartMermaid": "string (valid Mermaid graph TD flowchart reflecting latest workflow)",
  "blockDiagramMermaid": "string (valid Mermaid block-beta or graph TD system architecture diagram)",
  "roadmap": {
    "phases": [
      {
        "id": "string",
        "name": "string",
        "status": "completed" | "in_progress" | "planned",
        "sequenceOrder": 1,
        "tasks": [
          {
            "title": "string",
            "description": "string",
            "status": "completed" | "in_progress" | "pending",
            "dependencies": ["string"]
          }
        ]
      }
    ],
    "recommendedSequence": ["string"],
    "immediateNextSteps": ["string"]
  },
  "progressMetrics": {
    "completionPercentage": number (0-100),
    "totalTasksIdentified": number,
    "completedTasksCount": number,
    "partialTasksCount": number,
    "pendingTasksCount": number,
    "calculationBasis": "string",
    "problemStatement": "string",
    "isProblemStatementSolved": boolean
  }
}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text);

    // Validate structure
    if (!parsed.summary || !parsed.progressMetrics) {
      throw new Error('Gemini output missing core summary or progressMetrics');
    }

    // Keep flowchart and block diagram if Gemini returned empty
    parsed.flowchartMermaid = parsed.flowchartMermaid || currentAnalysis.flowchartMermaid;
    parsed.blockDiagramMermaid = parsed.blockDiagramMermaid || currentAnalysis.blockDiagramMermaid;

    return parsed as AnalysisResult;
  } catch (err) {
    console.warn('[Er.NEXA] Incremental Gemini analysis failed, applying safe deterministic fallback:', err);
    return applyFallbackIncrementalRules(currentAnalysis, changedFiles);
  }
}

function applyFallbackIncrementalRules(
  current: AnalysisResult,
  changedFiles: ChangedFilePayload[]
): AnalysisResult {
  const updated = JSON.parse(JSON.stringify(current)) as AnalysisResult;
  const removedPaths = new Set(
    changedFiles.filter((f) => f.status === 'removed').map((f) => f.path.toLowerCase())
  );
  const addedFiles = changedFiles.filter((f) => f.status === 'added');

  // Filter out removed file references from unfinished tasks
  updated.summary.unfinishedTasks = (updated.summary.unfinishedTasks || []).filter(
    (t) => !t.location || !removedPaths.has(t.location.toLowerCase())
  );

  // If new files added, register functionality entries
  addedFiles.forEach((f) => {
    const fileName = f.path.split('/').pop() || f.path;
    updated.summary.existingFunctionalities.push({
      title: `Added ${fileName}`,
      description: `Newly implemented source file ${f.path}`,
      filesInvolved: [f.path],
      status: 'fully_implemented',
    });
  });

  return updated;
}

