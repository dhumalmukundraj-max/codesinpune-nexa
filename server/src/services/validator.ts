import path from 'path';
import { AnalysisResult } from './geminiServiceTypes.js';
import { ProjectEvidenceCatalog } from './codeClassifier.js';

export function sanitizeMermaidDiagram(rawDiagram: string, diagramType: 'flowchart' | 'block'): string {
  if (!rawDiagram || typeof rawDiagram !== 'string') {
    return generateFallbackMermaid(diagramType);
  }

  let cleaned = rawDiagram.trim();

  // Strip markdown code fences
  cleaned = cleaned.replace(/^```(?:mermaid)?\s*/i, '').replace(/```$/i, '').trim();

  // Ensure valid diagram header
  const lines = cleaned.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  if (lines.length === 0) {
    return generateFallbackMermaid(diagramType);
  }

  const validHeaders = ['flowchart td', 'flowchart lr', 'graph td', 'graph lr', 'architecture-beta'];
  const firstLine = lines[0].toLowerCase();
  const hasValidHeader = validHeaders.some((h) => firstLine.startsWith(h));

  if (!hasValidHeader) {
    cleaned = `flowchart TD\n${cleaned}`;
  }

  // Quote unquoted node labels with special characters like parentheses or colons
  // e.g. A[User (Web)] -> A["User (Web)"]
  const processedLines = cleaned.split('\n').map((line) => {
    // If line is subgraph or end, keep as is
    if (/^\s*(?:subgraph|end|flowchart|graph|style|classDef)\b/i.test(line)) {
      return line;
    }

    // Replace unquoted brackets: id[Some Text (Extra)] -> id["Some Text (Extra)"]
    return line.replace(/([a-zA-Z0-9_-]+)\[([^"\]]+)\]/g, (_match, id, text) => {
      // If text already has quotes, keep it
      if (text.startsWith('"') && text.endsWith('"')) {
        return `${id}[${text}]`;
      }
      // Escape internal double quotes and wrap in quotes
      const safeText = text.replace(/"/g, "'").trim();
      return `${id}["${safeText}"]`;
    });
  });

  return processedLines.join('\n');
}

export function generateFallbackMermaid(diagramType: 'flowchart' | 'block', catalog?: ProjectEvidenceCatalog): string {
  if (diagramType === 'flowchart') {
    if (catalog && catalog.detectedRoutes.length > 0) {
      const routeLines = catalog.detectedRoutes.slice(0, 5).map((r, i) => {
        const id = `R${i + 1}`;
        return `    A["Client Request"] --> ${id}["${r.method} ${r.path}"]\n    ${id} --> S["Business Service Layer"]\n    S --> D["Database / Response"]`;
      }).join('\n');
      return `flowchart TD\n${routeLines}`;
    }
    return `flowchart TD\n  Client["User Interface"] --> Handler["Controller / API Router"]\n  Handler --> Logic["Core Business Services"]\n  Logic --> DataStore["Persistence & External Services"]`;
  } else {
    return `graph TD
  subgraph Frontend ["Client & Presentation Layer"]
    UI["Web UI Components"]
  end
  subgraph Backend ["Backend Core Engine"]
    API["API Routing & Controllers"]
    Services["Business Logic Services"]
  end
  subgraph Storage ["Persistence Layer"]
    DB[("Database / Supabase")]
  end
  UI --> API
  API --> Services
  Services --> DB`;
  }
}

export function validateAndNormalizeAnalysis(
  raw: any,
  catalog: ProjectEvidenceCatalog,
  projectName: string
): AnalysisResult {
  const summary = raw?.summary || {};
  const intro = summary.introduction || {};

  // 1. Normalize Introduction
  const normalizedIntro = {
    name: intro.name || projectName,
    tagline: intro.tagline || 'Reconstructed codebase intelligence.',
    description: intro.description || 'Comprehensive architectural reconstruction.',
    problemStatement: intro.problemStatement || intro.tagline || `Solve the core operational objectives of ${projectName}.`,
    isProblemStatementSolved: Boolean(intro.isProblemStatementSolved),
    primaryLanguages: Array.isArray(intro.primaryLanguages) && intro.primaryLanguages.length > 0
      ? intro.primaryLanguages
      : ['TypeScript'],
    frameworks: Array.isArray(intro.frameworks) ? intro.frameworks : [],
    architectureStyle: intro.architectureStyle || 'Modular Client-Server',
    verifiedFacts: Array.isArray(intro.verifiedFacts) ? intro.verifiedFacts : [],
    aiInferences: Array.isArray(intro.aiInferences) ? intro.aiInferences : [],
    unknowns: Array.isArray(intro.unknowns) ? intro.unknowns : [],
  };

  // Add catalog evidence to verified facts if empty
  if (normalizedIntro.verifiedFacts.length === 0) {
    normalizedIntro.verifiedFacts.push(
      `Identified ${catalog.classifiedFiles.length} source and configuration files.`,
      `Verified ${catalog.allTodos.length} TODO/FIXME markers in codebase.`
    );
  }

  // 2. Normalize Decisions
  const decisions = Array.isArray(summary.decisions)
    ? summary.decisions.map((d: any) => ({
        topic: d.topic || 'Architecture',
        decision: d.decision || 'Evidence-backed design decision',
        evidenceFile: d.evidenceFile || catalog.manifests[0]?.file || 'codebase',
        status: ['verified', 'inferred', 'unknown'].includes(d.status) ? d.status : 'inferred',
      }))
    : [];

  // 3. Normalize Technical Documentation
  const techDocs = summary.technicalDocumentation || {};
  const normalizedTechDocs = {
    setupInstructions: Array.isArray(techDocs.setupInstructions) && techDocs.setupInstructions.length > 0
      ? techDocs.setupInstructions
      : ['Review project package configuration', 'Configure environment variables from .env.example', 'Run build and test suites'],
    environmentVariables: Array.isArray(techDocs.environmentVariables)
      ? techDocs.environmentVariables.map((v: any) => ({
          key: v.key || 'UNKNOWN_VAR',
          description: v.description || 'Application environment variable',
          required: Boolean(v.required),
        }))
      : [],
    scripts: Array.isArray(techDocs.scripts)
      ? techDocs.scripts.map((s: any) => ({
          command: s.command || 'npm run build',
          purpose: s.purpose || 'Project execution script',
        }))
      : [],
    apiEndpoints: Array.isArray(techDocs.apiEndpoints) && techDocs.apiEndpoints.length > 0
      ? techDocs.apiEndpoints
      : catalog.detectedRoutes.slice(0, 8).map((r) => ({
          method: r.method,
          path: r.path,
          description: `Identified route handler in ${r.file}`,
        })),
  };

  // 4. Normalize Existing Functionalities
  const functionalities = Array.isArray(summary.existingFunctionalities)
    ? summary.existingFunctionalities.map((fn: any) => ({
        title: fn.title || 'Core Capability',
        description: fn.description || 'Reconstructed functionality from source code.',
        filesInvolved: Array.isArray(fn.filesInvolved) ? fn.filesInvolved : [],
        status: fn.status === 'partially_implemented' ? 'partially_implemented' : 'fully_implemented',
      }))
    : [];

  // 5. Normalize Unfinished Tasks (Merge AI identified with static catalog TODOs)
  const unfinishedTasks: Array<any> = Array.isArray(summary.unfinishedTasks) ? [...summary.unfinishedTasks] : [];

  // If AI missed explicit code TODOs, inject up to 5 verified ones from catalog
  catalog.allTodos.slice(0, 5).forEach((todo) => {
    const alreadyPresent = unfinishedTasks.some(
      (t) => t.location?.includes(todo.file) || t.description?.includes(todo.text)
    );
    if (!alreadyPresent && todo.text) {
      unfinishedTasks.push({
        title: `${todo.type}: ${todo.text.slice(0, 40)}`,
        description: todo.text,
        location: `${todo.file}#L${todo.line}`,
        type: todo.type,
        priority: todo.type === 'FIXME' ? 'high' : 'medium',
      });
    }
  });

  // Inject explicit stubs
  catalog.allStubs.slice(0, 3).forEach((stub) => {
    unfinishedTasks.push({
      title: `Stubbed Implementation in ${path.basename(stub.file)}`,
      description: stub.description,
      location: `${stub.file}#L${stub.line}`,
      type: 'STUB',
      priority: 'high',
    });
  });

  // 6. Dependencies
  const dependencies = Array.isArray(summary.dependencies)
    ? summary.dependencies.map((dep: any) => ({
        name: dep.name || 'dependency',
        version: dep.version || 'latest',
        category: ['core', 'ui', 'backend', 'dev', 'database', 'ai', 'other'].includes(dep.category)
          ? dep.category
          : 'core',
        purpose: dep.purpose || 'External module dependency',
      }))
    : catalog.uniqueImports.slice(0, 10).map((pkg) => ({
        name: pkg,
        version: 'latest',
        category: 'core',
        purpose: 'Detected imported package dependency',
      }));

  // 7. Discussions & Historical Records
  const discussions = summary.discussionsAndCommunications || {
    foundSources: catalog.docs.map((d) => d.file),
    notes: catalog.docs.length > 0 ? ['Documentation files present in repository.'] : ['No historical commit or RFC records found.'],
    hasHistoricalRecords: catalog.docs.length > 0,
  };

  // 8. Future Plans & Inconsistencies
  const futurePlans = Array.isArray(summary.futurePlansAndActions)
    ? summary.futurePlansAndActions
    : ['Complete pending stubs and TODO markers', 'Add unit and integration tests', 'Optimize deployment pipeline'];

  const missingOrContradictory = Array.isArray(summary.missingOrContradictoryInformation)
    ? [...summary.missingOrContradictoryInformation, ...catalog.inconsistencies]
    : [...catalog.inconsistencies];

  // Deduplicate missing info
  const uniqueMissing = Array.from(new Set(missingOrContradictory));

  // 9. Sanitize Mermaid Diagrams
  const flowchartMermaid = sanitizeMermaidDiagram(raw?.flowchartMermaid || raw?.flowchart_mermaid, 'flowchart');
  const blockDiagramMermaid = sanitizeMermaidDiagram(raw?.blockDiagramMermaid || raw?.block_diagram_mermaid, 'block');

  // 10. Normalize Roadmap
  const roadmapRaw = raw?.roadmap || {};
  const roadmap = {
    phases: Array.isArray(roadmapRaw.phases) && roadmapRaw.phases.length > 0
      ? roadmapRaw.phases.map((p: any, idx: number) => ({
          id: p.id || `phase-${idx + 1}`,
          name: p.name || `Phase ${idx + 1}: Implementation`,
          status: ['completed', 'in_progress', 'planned'].includes(p.status) ? p.status : 'planned',
          sequenceOrder: typeof p.sequenceOrder === 'number' ? p.sequenceOrder : idx + 1,
          tasks: Array.isArray(p.tasks)
            ? p.tasks.map((t: any) => ({
                title: t.title || 'Development task',
                description: t.description || 'Implementation details',
                status: ['completed', 'in_progress', 'pending'].includes(t.status) ? t.status : 'pending',
                dependencies: Array.isArray(t.dependencies) ? t.dependencies : [],
              }))
            : [],
        }))
      : [
          {
            id: 'phase-1',
            name: 'Phase 1: Architecture Core & APIs',
            status: functionalities.length > 0 ? 'completed' : 'in_progress',
            sequenceOrder: 1,
            tasks: [
              {
                title: 'Core Engine Initialization',
                description: 'Verify and stabilize main server routers and handlers',
                status: 'completed',
                dependencies: [],
              },
            ],
          },
          {
            id: 'phase-2',
            name: 'Phase 2: Complete Remaining Tasks & Stubs',
            status: 'in_progress',
            sequenceOrder: 2,
            tasks: unfinishedTasks.slice(0, 4).map((t) => ({
              title: t.title,
              description: t.description,
              status: 'pending',
              dependencies: ['Core Engine Initialization'],
            })),
          },
        ],
    recommendedSequence: Array.isArray(roadmapRaw.recommendedSequence) && roadmapRaw.recommendedSequence.length > 0
      ? roadmapRaw.recommendedSequence
      : ['1. Resolve unresolved TODO and STUB implementations', '2. Verify environment configuration', '3. Execute test suites and validate deployment'],
    immediateNextSteps: Array.isArray(roadmapRaw.immediateNextSteps) && roadmapRaw.immediateNextSteps.length > 0
      ? roadmapRaw.immediateNextSteps
      : ['Review flagged unfinished tasks in Tab 1', 'Validate system block diagram against actual cloud infrastructure'],
  };

  // 11. Core Problem Statement Completion Calculation
  // Grounding Rule: DO NOT calculate future implementations that users might add later.
  // Analyze the main problem statement: if solved completely by existing code, project completion is 100%.
  // Otherwise, calculate completion based on code snippets vs desired output.
  const fullyImplementedCount = functionalities.filter((f: any) => f.status === 'fully_implemented').length;
  const partialImplementedCount = functionalities.filter((f: any) => f.status === 'partially_implemented').length;

  // Filter out speculative future roadmap additions from unfinished tasks:
  // Only count actual code stubs, FIXMEs, or explicit missing core components required to solve the problem statement.
  const coreUnfinishedTasks = unfinishedTasks.filter((t: any) => {
    const titleLower = (t.title || '').toLowerCase();
    const isFutureWishlist = titleLower.includes('future') || titleLower.includes('optional') || titleLower.includes('enhancement') || titleLower.includes('phase 3');
    return !isFutureWishlist;
  });

  const pendingTasksCount = coreUnfinishedTasks.length;
  const totalTasksIdentified = Math.max(fullyImplementedCount + partialImplementedCount + pendingTasksCount, 1);

  let completionPercentage: number;
  let isProblemStatementSolved = false;

  // If there are no blocking unfinished tasks and we have implemented functionalities, problem statement is 100% solved!
  if (pendingTasksCount === 0 && (fullyImplementedCount > 0 || partialImplementedCount > 0)) {
    completionPercentage = 100;
    isProblemStatementSolved = true;
  } else if (fullyImplementedCount === 0 && partialImplementedCount === 0) {
    completionPercentage = 0;
    isProblemStatementSolved = false;
  } else {
    // Proportional calculation of problem statement requirements
    const rawPct = ((fullyImplementedCount + partialImplementedCount * 0.7) / totalTasksIdentified) * 100;
    completionPercentage = Math.min(Math.round(rawPct * 10) / 10, 100);
    isProblemStatementSolved = completionPercentage === 100;
  }

  const calculationBasis = isProblemStatementSolved
    ? `Main problem statement is completely solved by existing codebase implementations. Evaluated 100% complete based on verified working code (future roadmap ideas and optional extensions are strictly excluded).`
    : `Evaluated strictly against the core problem statement: ${fullyImplementedCount} core implementations verified built, ${partialImplementedCount} partial, and ${pendingTasksCount} remaining to fulfill desired output. Future implementations are excluded.`;

  const progressMetrics = {
    completionPercentage,
    totalTasksIdentified,
    completedTasksCount: fullyImplementedCount,
    partialTasksCount: partialImplementedCount,
    pendingTasksCount,
    calculationBasis,
    problemStatement: normalizedIntro.problemStatement,
    isProblemStatementSolved,
  };

  return {
    summary: {
      introduction: normalizedIntro,
      decisions,
      technicalDocumentation: normalizedTechDocs,
      existingFunctionalities: functionalities,
      unfinishedTasks,
      dependencies,
      discussionsAndCommunications: discussions,
      futurePlansAndActions: futurePlans,
      missingOrContradictoryInformation: uniqueMissing,
    },
    flowchartMermaid,
    blockDiagramMermaid,
    roadmap,
    progressMetrics,
  };
}
