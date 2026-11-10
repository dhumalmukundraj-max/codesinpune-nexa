import { geminiClient, isConfigured, ProjectFileEntry, AnalysisResult } from './geminiServiceTypes.js';
import { catalogProjectEvidence, ProjectEvidenceCatalog, CodeEvidence } from './codeClassifier.js';
import { validateAndNormalizeAnalysis } from './validator.js';
import { config } from '../config/index.js';
import { generateContentWithResilience, cleanJsonResponseText } from './geminiResilience.js';

interface BatchFinding {
  functionalities: Array<{ title: string; description: string; filesInvolved: string[]; status: 'fully_implemented' | 'partially_implemented' }>;
  unfinished: Array<{ title: string; description: string; location: string; type: 'TODO' | 'FIXME' | 'STUB' | 'MISSING_FEATURE'; priority: 'high' | 'medium' | 'low' }>;
  decisions: Array<{ topic: string; decision: string; evidenceFile: string; status: 'verified' | 'inferred' }>;
  inconsistencies: string[];
}

export async function runBatchedProjectIntelligence(
  projectName: string,
  files: ProjectFileEntry[],
  folderStructure: string
): Promise<AnalysisResult> {
  if (!isConfigured.gemini || !geminiClient) {
    throw new Error('Google Gemini API is not configured. Please supply a valid GEMINI_API_KEY in the .env file.');
  }

  // 1. Static classification and cataloging
  const catalog: ProjectEvidenceCatalog = catalogProjectEvidence(files);

  // 2. Batching Strategy for Large Projects
  let intermediateFindings: BatchFinding[] = [];

  if (files.length > 25) {
    // Large project: Split into 2 thematic batches before final synthesis
    const backendBatch = files.filter((f) => {
      const p = f.path.toLowerCase();
      return p.includes('server') || p.includes('backend') || p.includes('api') || p.includes('route') || p.includes('model') || p.includes('service');
    }).slice(0, 20);

    const frontendBatch = files.filter((f) => {
      const p = f.path.toLowerCase();
      return p.includes('client') || p.includes('frontend') || p.includes('ui') || p.includes('component') || p.includes('page');
    }).slice(0, 20);

    if (backendBatch.length > 0) {
      const backendFinding = await analyzeBatchWithGemini('Backend & Architecture Core', backendBatch);
      if (backendFinding) intermediateFindings.push(backendFinding);
    }

    if (frontendBatch.length > 0) {
      const frontendFinding = await analyzeBatchWithGemini('Frontend & User Interaction', frontendBatch);
      if (frontendFinding) intermediateFindings.push(frontendFinding);
    }
  }

  // 4. Stage 3: Global Knowledge Synthesis
  // Prepare prioritized key files (manifests, entry points, routers, models, README)
  const prioritizedFiles = selectPrioritizedFiles(files, catalog, 35);

  const filesPayload = prioritizedFiles.map((f) => {
    const lines = f.content.split('\n');
    const truncated = lines.slice(0, 220).join('\n');
    return `### FILE: ${f.path} (${f.language})\n\`\`\`\n${truncated}\n\`\`\``;
  }).join('\n\n');

  const staticEvidenceSummary = `
STATIC CODE EVIDENCE CATALOG:
- Classified Files: ${catalog.classifiedFiles.length}
- Detected API Routes: ${catalog.detectedRoutes.map((r) => `${r.method} ${r.path} (${r.file})`).join(', ') || 'None'}
- Verified TODO/FIXME markers: ${catalog.allTodos.map((t) => `${t.type} at ${t.file}:${t.line}: ${t.text}`).slice(0, 15).join(' | ') || 'None'}
- Verified Code Stubs: ${catalog.allStubs.map((s) => `${s.file}:${s.line} (${s.description})`).slice(0, 8).join(' | ') || 'None'}
- Discovered Dependencies: ${catalog.uniqueImports.join(', ') || 'None'}
- Static Inconsistencies: ${catalog.inconsistencies.join(' | ') || 'None'}
`;

  const intermediateFindingsText = intermediateFindings.length > 0
    ? `INTERMEDIATE BATCH FINDINGS:\n${JSON.stringify(intermediateFindings, null, 2)}`
    : '';

  const synthesisPrompt = `
You are the Er.NEXA Project Intelligence Reconstruction Engine.
Reconstruct the complete, ground-truth software knowledge model for the project "${projectName}".

IMPORTANT GROUNDING RULES:
1. NEVER INVENT OR HALLUCINATE DETAILS. Every claim must stem directly from code evidence, manifests, or comments.
2. DISTINGUISH EXPLICITLY:
   - "verifiedFacts": Observable facts directly present in code/files.
   - "aiInferences": Logical engineering deductions based on structural patterns and dependencies.
   - "unknowns": Missing components, undocumented behavior, or ambiguous code.
3. DECISIONS WITH EVIDENCE: Provide concrete file evidence for each technical decision (e.g. database choice, framework choice, auth pattern). Status must be "verified" or "inferred".
4. GENERATE SYNTACTICALLY VALID MERMAID DIAGRAMS:
   - "flowchartMermaid": Runtime workflow flowchart. Header must be "flowchart TD". Quote any node labels containing parentheses or spaces (e.g. A["User (Browser)"] --> B["API Gateway"]).
   - "blockDiagramMermaid": Architecture block diagram with subgraphs (e.g. subgraph Frontend, subgraph Backend, subgraph Database). Only include components verified by code evidence!
5. CORE PROBLEM STATEMENT & COMPLETION CALCULATION:
   - Identify the project's PRIMARY PROBLEM STATEMENT and desired operational output (what is this software built to solve?).
   - Group the functionalities strictly into:
     * "existingFunctionalities": Features and modules currently built and working in the codebase that solve the problem statement.
     * "unfinishedTasks": Core requirements directly needed to solve the problem statement that are currently missing, broken, or stubbed in the code.
   - CRITICAL GROUNDING RULE: DO NOT calculate or penalize future implementations, speculative roadmap wishlists, or optional additions that users might add later.
   - If the main problem statement is completely solved by the existing code (all core components are implemented, routers and handlers work, desired output is produced with no blocking stubs), the project completion MUST BE 100%.
   - Otherwise, calculate completion strictly based on (Built Core Features) / (Built Core Features + Remaining Core Tasks) * 100%.

DIRECTORY STRUCTURE:
${folderStructure}

${staticEvidenceSummary}

${intermediateFindingsText}

KEY CODE SAMPLES:
${filesPayload}

OUTPUT FORMAT:
Return a STRICT JSON object conforming to this exact schema:

{
  "summary": {
    "introduction": {
      "name": "${projectName}",
      "tagline": "Concise 1-sentence technical tagline",
      "description": "Comprehensive objective overview of what this project does and its architectural design.",
      "problemStatement": "Clear 1-2 sentence statement of the core problem this project solves and its desired output.",
      "isProblemStatementSolved": true | false,
      "primaryLanguages": ["TypeScript", "Python", ...],
      "frameworks": ["React", "Express", ...],
      "architectureStyle": "e.g. Modular Client-Server / REST API / Monorepo",
      "verifiedFacts": ["Fact 1 backed by code", "Fact 2 backed by code"],
      "aiInferences": ["Deduction 1 from libraries", "Deduction 2 from patterns"],
      "unknowns": ["Unknown implementation area 1", "Missing file 2"]
    },
    "decisions": [
      {
        "topic": "Area/Topic (e.g. Authentication, State Management, Database)",
        "decision": "Explicit technical decision made",
        "evidenceFile": "path/to/evidence/file",
        "status": "verified | inferred"
      }
    ],
    "technicalDocumentation": {
      "setupInstructions": ["Step 1", "Step 2", "Step 3"],
      "environmentVariables": [
        { "key": "VAR_NAME", "description": "What it controls", "required": true }
      ],
      "scripts": [
        { "command": "npm run dev", "purpose": "Starts development server" }
      ],
      "apiEndpoints": [
        { "method": "GET", "path": "/api/...", "description": "Handler description" }
      ]
    },
    "existingFunctionalities": [
      {
        "title": "Feature title",
        "description": "What is implemented and verified",
        "filesInvolved": ["file1.ts", "file2.ts"],
        "status": "fully_implemented | partially_implemented"
      }
    ],
    "unfinishedTasks": [
      {
        "title": "Task title",
        "description": "Details of what is missing or unfinished",
        "location": "file.ts#L10",
        "type": "TODO | FIXME | STUB | MISSING_FEATURE",
        "priority": "high | medium | low"
      }
    ],
    "dependencies": [
      {
        "name": "package-name",
        "version": "^1.0.0",
        "category": "core | ui | backend | dev | database | ai | other",
        "purpose": "Why this package is used"
      }
    ],
    "discussionsAndCommunications": {
      "foundSources": ["README.md", "Comments in server.ts"],
      "notes": ["Factual observations from commit or doc files"],
      "hasHistoricalRecords": false
    },
    "futurePlansAndActions": [
      "Immediate action 1",
      "Next engineering milestone 2"
    ],
    "missingOrContradictoryInformation": [
      "Any discrepancy or missing component detected"
    ]
  },
  "flowchartMermaid": "flowchart TD\\n  A[\\"User Action\\"] --> B[\\"Route Handler\\"]\\n  B --> C[\\"Service Logic\\"]",
  "blockDiagramMermaid": "graph TD\\n  subgraph Client [\\"Frontend Layer\\"]\\n    A[\\"UI Component\\"]\\n  end\\n  subgraph Server [\\"Backend Engine\\"]\\n    B[\\"Express API\\"]\\n  end\\n  A --> B",
  "roadmap": {
    "phases": [
      {
        "id": "phase-1",
        "name": "Phase 1: Foundation & APIs",
        "status": "completed | in_progress | planned",
        "sequenceOrder": 1,
        "tasks": [
          {
            "title": "Task name",
            "description": "Task description",
            "status": "completed | in_progress | pending",
            "dependencies": []
          }
        ]
      }
    ],
    "recommendedSequence": ["Step 1: ...", "Step 2: ..."],
    "immediateNextSteps": ["Next step 1", "Next step 2"]
  }
}
`;

  try {
    const text = await generateContentWithResilience({
      prompt: synthesisPrompt,
      responseMimeType: 'application/json',
      temperature: 0.2,
      label: `Global Knowledge Synthesis for "${projectName}"`,
    });
    const cleaned = cleanJsonResponseText(text);
    const rawParsed = JSON.parse(cleaned);

    // 5. Normalization, Validation & Deterministic Completion Calculation
    const normalized = validateAndNormalizeAnalysis(rawParsed, catalog, projectName);
    return normalized;
  } catch (err: any) {
    console.error('[Gemini Synthesis Error]:', err);
    throw new Error(`Project Intelligence Engine failed: ${err.message || 'Gemini error'}`);
  }
}

async function analyzeBatchWithGemini(
  batchName: string,
  batchFiles: ProjectFileEntry[]
): Promise<BatchFinding | null> {
  const codeContent = batchFiles.map((f) => {
    return `### FILE: ${f.path}\n\`\`\`\n${f.content.slice(0, 1800)}\n\`\`\``;
  }).join('\n\n');

  const batchPrompt = `
Analyze this specific code batch (${batchName}) for the codebase knowledge reconstruction engine.
Extract strictly factual observations:
1. Implemented functionality with exact files involved.
2. Unfinished tasks, stubs, TODOs, or empty handlers.
3. Technical decisions evident with file evidence.
4. Any missing components or inconsistencies.

Return a STRICT JSON object conforming to:
{
  "functionalities": [
    { "title": "Feature Title", "description": "Details", "filesInvolved": ["file.ts"], "status": "fully_implemented | partially_implemented" }
  ],
  "unfinished": [
    { "title": "Task title", "description": "Details", "location": "file.ts#L10", "type": "TODO | FIXME | STUB | MISSING_FEATURE", "priority": "high | medium | low" }
  ],
  "decisions": [
    { "topic": "Topic", "decision": "Decision", "evidenceFile": "file.ts", "status": "verified | inferred" }
  ],
  "inconsistencies": ["Inconsistency 1"]
}

FILES:
${codeContent}
`;

  try {
    const text = await generateContentWithResilience({
      prompt: batchPrompt,
      responseMimeType: 'application/json',
      temperature: 0.2,
      label: `Batch Analysis (${batchName})`,
    });
    return JSON.parse(cleanJsonResponseText(text));
  } catch (err) {
    console.warn(`[Batch Analysis Warning for ${batchName}]:`, err);
    return null;
  }
}

function selectPrioritizedFiles(
  files: ProjectFileEntry[],
  catalog: ProjectEvidenceCatalog,
  limit: number
): ProjectFileEntry[] {
  const selected: ProjectFileEntry[] = [];
  const selectedPaths = new Set<string>();

  function addFile(entry?: CodeEvidence) {
    if (!entry) return;
    if (!selectedPaths.has(entry.file)) {
      const match = files.find((f) => f.path === entry.file);
      if (match) {
        selected.push(match);
        selectedPaths.add(entry.file);
      }
    }
  }

  // 1. All manifests & configs
  catalog.manifests.forEach(addFile);

  // 2. All entry points
  catalog.entryPoints.forEach(addFile);

  // 3. Documentation
  catalog.docs.slice(0, 3).forEach(addFile);

  // 4. Routers & APIs
  catalog.routers.slice(0, 8).forEach(addFile);

  // 5. Data models
  catalog.models.slice(0, 6).forEach(addFile);

  // 6. Services
  catalog.services.slice(0, 6).forEach(addFile);

  // 7. UI components
  catalog.uiComponents.slice(0, 5).forEach(addFile);

  // Fill up to limit with remaining smallest files
  if (selected.length < limit) {
    for (const f of files) {
      if (!selectedPaths.has(f.path)) {
        selected.push(f);
        selectedPaths.add(f.path);
        if (selected.length >= limit) break;
      }
    }
  }

  return selected;
}
