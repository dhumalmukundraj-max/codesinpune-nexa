import { GoogleGenerativeAI } from '@google/generative-ai';
import { config, isConfigured } from '../config/index.js';
import { AnalysisResult } from './geminiServiceTypes.js';
import { 
  ProjectTaskRecord, 
  TaskPriority, 
  GapType, 
  RoadmapPhaseSummary, 
  taskStorage 
} from './storage/taskStorage.js';
import { syncStorage } from './storage/syncStorage.js';

export class RoadmapEngine {
  /**
   * Generates or refreshes structured, deeply project-grounded roadmap tasks based on
   * actual codebase analysis, distinguishing built functionality from genuine gaps.
   */
  static async generateTasksFromGaps(
    projectId: string,
    projectName: string,
    analysis: AnalysisResult,
    _rawFiles?: Array<{ path: string; content?: string }>
  ): Promise<ProjectTaskRecord[]> {
    const existingTasks = await taskStorage.getTasks(projectId);
    const existingById = new Map<string, ProjectTaskRecord>();
    existingTasks.forEach((t) => existingById.set(t.id, t));

    // 1. Extract rich project context from actual analysis
    const summary = analysis.summary || ({} as any);
    const intro = summary.introduction || {};
    const problemStatement = intro.problemStatement || 'Core software operational objectives';
    const isSolved = intro.isProblemStatementSolved ?? false;
    const existingFns = summary.existingFunctionalities || [];
    const fullyImplementedFns = existingFns.filter((f: any) => f.status === 'fully_implemented');
    const partialFns = existingFns.filter((f: any) => f.status === 'partially_implemented');
    const unfinished = summary.unfinishedTasks || [];
    const missingInfo = summary.missingOrContradictoryInformation || [];
    const envVars = summary.technicalDocumentation?.environmentVariables || [];
    const apiEndpoints = summary.technicalDocumentation?.apiEndpoints || [];
    const techStack = [...(intro.primaryLanguages || []), ...(intro.frameworks || [])].join(', ') || 'Full-Stack';
    const architecture = intro.architectureStyle || 'Modular Client-Server';

    // 2. Discover available Git authors for realistic ownership assignment
    const syncHistory = await syncStorage.getHistory(projectId, 15);
    const gitAuthors = Array.from(
      new Set(syncHistory.map((h) => h.commit_author).filter(Boolean))
    ) as string[];

    let generatedTasks: ProjectTaskRecord[] = [];

    // 3. AI-Powered Deep Ground-Truth Task & Roadmap Generation with Gemini
    if (isConfigured.gemini) {
      try {
        const genAI = new GoogleGenerativeAI(config.geminiApiKey);
        const model = genAI.getGenerativeModel({
          model: config.geminiModel || 'gemini-2.5-flash',
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.15,
          },
        });

        const prompt = `
You are Er.NEXA — Principal Software Architect & AI Engineering Roadmap Director.
You are generating a realistic, technically accurate development roadmap and task breakdown for project: "${projectName}".

CRITICAL PROJECT CONTEXT FROM REAL CODEBASE:
- Core Problem Statement: "${problemStatement}"
- Is Problem Statement Solved by Existing Code: ${isSolved}
- Architecture & Stack: ${architecture} (${techStack})
- FULLY IMPLEMENTED FEATURES (Already built in code — DO NOT recreate or mark incomplete!):
${JSON.stringify(fullyImplementedFns.map((f: any) => ({ title: f.title, files: f.filesInvolved })), null, 2)}
- PARTIALLY IMPLEMENTED MODULES (Need completion):
${JSON.stringify(partialFns, null, 2)}
- DETECTED STUBS / TODOS / UNFINISHED CODE:
${JSON.stringify(unfinished, null, 2)}
- API Endpoints Detected: ${JSON.stringify(apiEndpoints.slice(0, 15), null, 2)}
- Required Environment Variables: ${JSON.stringify(envVars.slice(0, 10), null, 2)}
- Architectural Discrepancies: ${JSON.stringify(missingInfo, null, 2)}
- Real Project Authors / Contributors: ${JSON.stringify(gitAuthors, null, 2)}

STRICT ENGINEERING RULES FOR TASK GENERATION:
1. GROUNDED IN REALITY: Every task must address a genuine technical requirement of "${projectName}". Do NOT generate generic filler like "Refactor code" or "Add more tests" without naming the exact component, file, or endpoint.
2. DO NOT RE-IMPLEMENT: Features listed under FULLY IMPLEMENTED are completed. Only generate tasks for partially implemented features, unfinished stubs, missing integrations, security hardening, or production scalability.
3. LOGICAL DEVELOPMENT PHASES: Organize tasks into 4 project-specific phases reflecting real software development milestones:
   * phase-1: Critical Stabilizations, Core Stubs & Unfinished Handlers (immediate blockers)
   * phase-2: Feature Completion & Cross-Module Integrations
   * phase-3: Error Boundaries, Validation, Security & Reliability
   * phase-4: Performance Optimization, Documentation & Handover Readiness
4. REQUIRED FIELDS FOR EVERY TASK:
   - "title": Specific, descriptive engineering title (e.g. "Implement JWT Token Revocation in Auth Router", not "Fix auth").
   - "description": Comprehensive technical explanation of the exact code changes needed.
   - "expected_outcome": Clear, testable acceptance criteria when the task is done.
   - "priority": "critical" | "high" | "medium" | "low" (with technical rationale).
   - "status": "pending" (or "completed" if it corresponds to an already verified requirement).
   - "gap_type": "incomplete_functionality" | "unfinished_task" | "missing_error_handling" | "missing_validation" | "missing_tests" | "documentation_gap" | "technical_debt" | "dependency_issue" | "general_enhancement".
   - "estimated_complexity": "small" | "medium" | "large".
   - "dependencies": Array of prerequisite task titles or IDs.
   - "suggested_owner": From known authors ${JSON.stringify(gitAuthors)} if file ownership applies, else "Owner not determined". NEVER invent fake names.
   - "implementation_steps": 3 to 5 concrete, actionable development steps.
   - "source_file_refs": Array of relevant files/paths from the project.
   - "evidence_verification": "verified_issue" (if tied to code line/stub) or "ai_inferred_issue" (if architectural best practice).

OUTPUT FORMAT:
Return a STRICT JSON array of task objects matching this schema:
[
  {
    "id": "task-uuid-or-slug",
    "phase_id": "phase-1" | "phase-2" | "phase-3" | "phase-4",
    "phase_name": "string",
    "title": "string",
    "description": "string",
    "reason": "string",
    "evidence": "string",
    "source_file_refs": ["string"],
    "priority": "critical" | "high" | "medium" | "low",
    "priority_rationale": "string",
    "estimated_complexity": "small" | "medium" | "large",
    "dependencies": ["string"],
    "suggested_owner": "string",
    "status": "pending",
    "implementation_steps": ["step 1", "step 2", "step 3"],
    "expected_outcome": "string",
    "gap_type": "incomplete_functionality" | "unfinished_task" | "missing_error_handling" | "missing_validation" | "missing_tests" | "documentation_gap" | "technical_debt" | "dependency_issue" | "general_enhancement",
    "evidence_verification": "verified_issue" | "ai_inferred_issue"
  }
]
`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);

        if (Array.isArray(parsed) && parsed.length > 0) {
          generatedTasks = parsed.map((item: any, idx: number) => ({
            id: item.id || `task-${projectId.slice(0, 8)}-${idx + 1}`,
            project_id: projectId,
            phase_id: item.phase_id || 'phase-1',
            phase_name: item.phase_name || this.getDefaultPhaseName(item.phase_id),
            title: String(item.title || `Task ${idx + 1}`).trim(),
            description: String(item.description || item.title || '').trim(),
            reason: String(item.reason || 'Codebase gap identified during architectural analysis.').trim(),
            evidence: String(item.evidence || '').trim(),
            source_file_refs: Array.isArray(item.source_file_refs) ? item.source_file_refs : [],
            priority: (item.priority as TaskPriority) || 'medium',
            priority_rationale: String(item.priority_rationale || 'Prioritized based on impact on core application functionality.').trim(),
            estimated_complexity: item.estimated_complexity || 'medium',
            dependencies: Array.isArray(item.dependencies) ? item.dependencies : [],
            suggested_owner: item.suggested_owner || (gitAuthors[0] ? gitAuthors[0] : 'Owner not determined'),
            status: item.status === 'completed' ? 'completed' : 'pending',
            implementation_steps: Array.isArray(item.implementation_steps) && item.implementation_steps.length > 0
              ? item.implementation_steps
              : ['Inspect target module code', 'Implement missing technical logic', 'Verify functionality with tests'],
            expected_outcome: String(item.expected_outcome || `Verified implementation of ${item.title}`).trim(),
            gap_type: (item.gap_type as GapType) || 'incomplete_functionality',
            evidence_verification: item.evidence_verification || 'verified_issue',
          }));
        }
      } catch (err: any) {
        console.warn('[Er.NEXA RoadmapEngine] Gemini task synthesis notice:', err.message);
      }
    }

    // 4. Upgraded Dynamic Deterministic Fallback if Gemini is unavailable
    if (generatedTasks.length === 0) {
      generatedTasks = this.buildDynamicTasksFromAnalysis(projectId, projectName, analysis, gitAuthors);
    }

    // 5. Deduplicate and merge with existing user-edited tasks
    // User changes (accepted, in_progress, completed, rejected, edited titles) are permanently preserved!
    const finalTasks: ProjectTaskRecord[] = [];
    const seenTitles = new Set<string>();

    // First: preserve all user tasks
    existingTasks.forEach((existing) => {
      seenTitles.add(existing.title.toLowerCase().trim());
      finalTasks.push(existing);
    });

    // Second: add newly generated tasks that don't duplicate existing ones
    generatedTasks.forEach((gen) => {
      const normalizedTitle = gen.title.toLowerCase().trim();
      if (!seenTitles.has(normalizedTitle)) {
        seenTitles.add(normalizedTitle);
        finalTasks.push(gen);
      }
    });

    return taskStorage.saveTasks(projectId, finalTasks);
  }

  /**
   * Returns standardized phase names
   */
  private static getDefaultPhaseName(phaseId?: string): string {
    switch (phaseId) {
      case 'phase-1':
        return 'Phase 1: Critical Stabilizations & Core Stubs';
      case 'phase-2':
        return 'Phase 2: Feature Completion & Integration';
      case 'phase-3':
        return 'Phase 3: Error Boundaries, Validation & Security';
      case 'phase-4':
        return 'Phase 4: Optimization, Documentation & Handover';
      default:
        return 'Phase 1: Critical Stabilizations';
    }
  }

  /**
   * Dynamically builds tasks from real analysis data when Gemini is offline
   */
  private static buildDynamicTasksFromAnalysis(
    projectId: string,
    projectName: string,
    analysis: AnalysisResult,
    gitAuthors: string[]
  ): ProjectTaskRecord[] {
    const tasks: ProjectTaskRecord[] = [];
    const summary = analysis.summary || ({} as any);
    const unfinished = summary.unfinishedTasks || [];
    const partialFns = (summary.existingFunctionalities || []).filter(
      (f: any) => f.status === 'partially_implemented'
    );
    const envVars = summary.technicalDocumentation?.environmentVariables || [];
    const defaultOwner = gitAuthors[0] || 'Owner not determined';

    let taskCounter = 1;

    // 1. Tasks from Unfinished Code Stubs & TODOs
    unfinished.forEach((t: any) => {
      tasks.push({
        id: `task-${projectId.slice(0, 8)}-${taskCounter++}`,
        project_id: projectId,
        phase_id: 'phase-1',
        phase_name: 'Phase 1: Critical Stabilizations & Core Stubs',
        title: `Resolve ${t.type || 'Stub'}: ${t.title}`,
        description: t.description || `Address unfinished code marker found at ${t.location || 'codebase'}.`,
        reason: `Concrete ${t.type || 'stub'} identified at ${t.location || 'source code'}.`,
        evidence: t.location || 'Detected during AST and code parsing.',
        source_file_refs: t.location ? [t.location.split('#')[0]] : [],
        priority: t.priority === 'high' ? 'critical' : t.priority === 'medium' ? 'high' : 'medium',
        priority_rationale: 'Unfinished stubs block full deterministic system completion.',
        estimated_complexity: t.priority === 'high' ? 'large' : 'medium',
        dependencies: [],
        suggested_owner: defaultOwner,
        status: 'pending',
        implementation_steps: [
          `Inspect ${t.location || 'target file'} and review connected logic`,
          'Replace stubbed implementation with production-ready algorithm',
          'Write unit tests verifying input edge cases and error handling',
        ],
        expected_outcome: `Fully implemented, functional module replacing ${t.title}.`,
        gap_type: 'unfinished_task',
        evidence_verification: 'verified_issue',
      });
    });

    // 2. Tasks from Partially Implemented Functionalities
    partialFns.forEach((f: any) => {
      tasks.push({
        id: `task-${projectId.slice(0, 8)}-${taskCounter++}`,
        project_id: projectId,
        phase_id: 'phase-2',
        phase_name: 'Phase 2: Feature Completion & Integration',
        title: `Complete Implementation: ${f.title}`,
        description: f.description || `Ensure all sub-components of ${f.title} are fully integrated.`,
        reason: `Functionality "${f.title}" is partially implemented across: ${(f.filesInvolved || []).join(', ')}.`,
        evidence: (f.filesInvolved || []).join(', ') || 'Partial module evidence',
        source_file_refs: f.filesInvolved || [],
        priority: 'high',
        priority_rationale: 'Core architectural functionality is currently incomplete.',
        estimated_complexity: 'medium',
        dependencies: [],
        suggested_owner: defaultOwner,
        status: 'pending',
        implementation_steps: [
          'Audit data flow across involved files',
          'Implement missing edge-case handlers and response formatting',
          'Conduct end-to-end integration test',
        ],
        expected_outcome: `Feature "${f.title}" reaches 100% complete and verified status.`,
        gap_type: 'incomplete_functionality',
        evidence_verification: 'verified_issue',
      });
    });

    // 3. Phase 3: Reliability & Validation Task
    tasks.push({
      id: `task-${projectId.slice(0, 8)}-${taskCounter++}`,
      project_id: projectId,
      phase_id: 'phase-3',
      phase_name: 'Phase 3: Error Boundaries, Validation & Security',
      title: `Harden Input Validation & Error Boundaries in ${projectName}`,
      description: 'Audit entry point routes, database queries, and client form mutations to ensure all unhandled rejections, malformed schemas, and timeout errors are safely reported.',
      reason: 'Production software requires defensive input sanitation and robust HTTP status handling.',
      evidence: 'Architectural reliability inspection',
      source_file_refs: [],
      priority: 'medium',
      priority_rationale: 'Prevents silent application crashes and unhandled exceptions.',
      estimated_complexity: 'medium',
      dependencies: [],
      suggested_owner: defaultOwner,
      status: 'pending',
      implementation_steps: [
        'Review API route controllers for structured try/catch blocks',
        'Add schema validation for incoming payloads',
        'Verify client displays friendly error notifications instead of blank screens',
      ],
      expected_outcome: 'Zero unhandled exceptions and robust error boundaries across application.',
      gap_type: 'missing_error_handling',
      evidence_verification: 'ai_inferred_issue',
    });

    // 4. Phase 4: Documentation & Environment Config
    if (envVars.length > 0) {
      tasks.push({
        id: `task-${projectId.slice(0, 8)}-${taskCounter++}`,
        project_id: projectId,
        phase_id: 'phase-4',
        phase_name: 'Phase 4: Optimization, Documentation & Handover',
        title: `Validate Environment Configuration & Secrets Checklist`,
        description: `Ensure all required environment variables (${envVars.map((e: any) => e.key).slice(0, 5).join(', ')}) are documented with example templates.`,
        reason: 'Required environment variables must be documented for reproducible deployments.',
        evidence: `${envVars.length} environment variables identified in project`,
        source_file_refs: ['.env.example', 'README.md'],
        priority: 'low',
        priority_rationale: 'Essential for reproducible developer onboarding and deployment handover.',
        estimated_complexity: 'small',
        dependencies: [],
        suggested_owner: defaultOwner,
        status: 'pending',
        implementation_steps: [
          'Verify .env.example contains all required environment keys',
          'Document configuration values in developer setup guide',
        ],
        expected_outcome: 'Complete developer onboarding and deployment configuration documentation.',
        gap_type: 'documentation_gap',
        evidence_verification: 'verified_issue',
      });
    }

    return tasks;
  }

  /**
   * Refreshes tasks upon a Git sync event
   */
  static async refreshTasksOnSync(
    projectId: string,
    projectName: string,
    analysis: AnalysisResult
  ): Promise<ProjectTaskRecord[]> {
    return this.generateTasksFromGaps(projectId, projectName, analysis);
  }

  /**
   * Summarizes tasks by Phase for Roadmap presentation
   */
  static groupTasksByPhase(tasks: ProjectTaskRecord[]): RoadmapPhaseSummary[] {
    const phasesMap = new Map<string, RoadmapPhaseSummary>();

    const defaultPhases: Array<{ id: string; name: string }> = [
      { id: 'phase-1', name: 'Phase 1: Critical Stabilizations & Core Stubs' },
      { id: 'phase-2', name: 'Phase 2: Feature Completion & Integration' },
      { id: 'phase-3', name: 'Phase 3: Error Boundaries, Validation & Security' },
      { id: 'phase-4', name: 'Phase 4: Optimization, Documentation & Handover' },
    ];

    defaultPhases.forEach((p) => {
      phasesMap.set(p.id, {
        id: p.id,
        name: p.name,
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        pendingTasks: 0,
        tasks: [],
      });
    });

    tasks.forEach((task) => {
      let phase = phasesMap.get(task.phase_id);
      if (!phase) {
        phase = {
          id: task.phase_id,
          name: task.phase_name || task.phase_id,
          totalTasks: 0,
          completedTasks: 0,
          inProgressTasks: 0,
          pendingTasks: 0,
          tasks: [],
        };
        phasesMap.set(task.phase_id, phase);
      }

      phase.totalTasks++;
      if (task.status === 'completed') phase.completedTasks++;
      else if (task.status === 'in_progress') phase.inProgressTasks++;
      else phase.pendingTasks++;

      phase.tasks.push(task);
    });

    return Array.from(phasesMap.values());
  }
}
