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
   * Generates or refreshes structured roadmap tasks based on actual detected gaps
   */
  static async generateTasksFromGaps(
    projectId: string,
    projectName: string,
    analysis: AnalysisResult,
    rawFiles?: Array<{ path: string; content?: string }>
  ): Promise<ProjectTaskRecord[]> {
    const existingTasks = await taskStorage.getTasks(projectId);
    const existingById = new Map<string, ProjectTaskRecord>();
    existingTasks.forEach((t) => existingById.set(t.id, t));

    // 1. Gather detected gaps from analysis
    const unfinished = analysis.summary?.unfinishedTasks || [];
    const partialFns = (analysis.summary?.existingFunctionalities || []).filter(
      (f) => f.status === 'partially_implemented'
    );
    const missingInfo = analysis.summary?.missingOrContradictoryInformation || [];
    const envVars = analysis.summary?.technicalDocumentation?.environmentVariables || [];

    // 2. Discover available team members / authors for suggested owners
    const syncHistory = await syncStorage.getHistory(projectId, 10);
    const gitAuthors = Array.from(
      new Set(syncHistory.map((h) => h.commit_author).filter(Boolean))
    ) as string[];

    let generatedTasks: ProjectTaskRecord[] = [];

    // 3. AI-Powered Structured Task Generation with Gemini
    if (isConfigured.gemini) {
      try {
        const genAI = new GoogleGenerativeAI(config.geminiApiKey);
        const model = genAI.getGenerativeModel({
          model: config.geminiModel || 'gemini-2.5-flash',
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });

        const prompt = `
You are Er.NEXA — Intelligent Project Roadmap & Gap Resolution Architect.
You are inspecting the real codebase analysis for project "${projectName}".

Detected Gaps & Unfinished Work from Code:
- Unfinished Tasks / Stubs: ${JSON.stringify(unfinished, null, 2)}
- Partially Implemented Functionalities: ${JSON.stringify(partialFns, null, 2)}
- Missing or Contradictory Information: ${JSON.stringify(missingInfo, null, 2)}
- Environment Variables: ${JSON.stringify(envVars, null, 2)}
- Known Git Authors in Project: ${JSON.stringify(gitAuthors, null, 2)}

TASK:
Analyze these real project gaps and generate structured, actionable engineering tasks.
For each task:
- Clearly explain the reason for the recommendation based on actual code evidence.
- Assign an objective priority (critical, high, medium, low) and provide a technical rationale.
- Assign a gapType (incomplete_functionality, unfinished_task, missing_error_handling, missing_validation, missing_tests, documentation_gap, technical_debt, dependency_issue, general_enhancement).
- Distinguish evidenceVerification: "verified_issue" (if backed by a concrete file/line or TODO), "ai_inferred_issue" (if derived from architectural best practices), or "unknown_evidence".
- Assign suggestedOwner: Choose from known authors ${JSON.stringify(gitAuthors)} only if file ownership or commit history clearly suggests it. Otherwise set suggestedOwner to "Owner not determined". Do NOT invent fake people.
- Organize tasks into 4 logical phases:
  * phase-1: "Phase 1: Critical Implementations & Core Fixes"
  * phase-2: "Phase 2: Feature Completion & Integration"
  * phase-3: "Phase 3: Reliability, Error Handling & Tests"
  * phase-4: "Phase 4: Optimization, Documentation & Handover"

OUTPUT SCHEMA (Strict JSON array of task objects):
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
    "implementation_steps": ["string"],
    "expected_outcome": "string",
    "gap_type": "incomplete_functionality" | "unfinished_task" | "missing_error_handling" | "missing_validation" | "missing_tests" | "documentation_gap" | "technical_debt" | "dependency_issue" | "general_enhancement",
    "evidence_verification": "verified_issue" | "ai_inferred_issue" | "unknown_evidence"
  }
]
`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const parsed = JSON.parse(text);

        if (Array.isArray(parsed) && parsed.length > 0) {
          generatedTasks = parsed.map((item: any, idx: number) => ({
            id: item.id || `task-${projectId.slice(0, 8)}-${idx + 1}`,
            project_id: projectId,
            phase_id: item.phase_id || 'phase-1',
            phase_name: item.phase_name || 'Phase 1: Critical Implementations',
            title: item.title,
            description: item.description,
            reason: item.reason || 'Detected gap in project code analysis.',
            evidence: item.evidence || '',
            source_file_refs: item.source_file_refs || [],
            priority: (item.priority as TaskPriority) || 'medium',
            priority_rationale: item.priority_rationale || 'Prioritized based on impact on core problem statement.',
            estimated_complexity: item.estimated_complexity || 'medium',
            dependencies: item.dependencies || [],
            suggested_owner: item.suggested_owner || (gitAuthors[0] ? gitAuthors[0] : 'Owner not determined'),
            status: 'pending',
            implementation_steps: item.implementation_steps || [],
            expected_outcome: item.expected_outcome || '',
            gap_type: (item.gap_type as GapType) || 'incomplete_functionality',
            evidence_verification: item.evidence_verification || 'verified_issue',
          }));
        }
      } catch (err) {
        console.warn('[Er.NEXA RoadmapEngine] AI task synthesis error, falling back to deterministic gap extractor:', err);
      }
    }

    // 4. Deterministic fallback if Gemini is offline or returned empty
    if (generatedTasks.length === 0) {
      generatedTasks = this.buildDeterministicTasks(projectId, analysis, gitAuthors);
    }

    // 5. Merge with existing user changes (e.g. user-accepted or completed tasks are NOT overwritten)
    const finalTasks: ProjectTaskRecord[] = [];
    const seenTitles = new Set<string>();

    // First preserve all tasks user has interacted with (accepted, in_progress, completed, rejected)
    existingTasks.forEach((existing) => {
      seenTitles.add(existing.title.toLowerCase());
      finalTasks.push(existing);
    });

    // Add newly generated tasks that don't duplicate existing ones
    generatedTasks.forEach((gen) => {
      if (!seenTitles.has(gen.title.toLowerCase())) {
        seenTitles.add(gen.title.toLowerCase());
        finalTasks.push(gen);
      }
    });

    return taskStorage.saveTasks(projectId, finalTasks);
  }

  /**
   * Deterministic gap extractor when Gemini is not configured or in fallback
   */
  private static buildDeterministicTasks(
    projectId: string,
    analysis: AnalysisResult,
    gitAuthors: string[]
  ): ProjectTaskRecord[] {
    const tasks: ProjectTaskRecord[] = [];
    const unfinished = analysis.summary?.unfinishedTasks || [];
    const partialFns = (analysis.summary?.existingFunctionalities || []).filter(
      (f) => f.status === 'partially_implemented'
    );
    const defaultOwner = gitAuthors[0] || 'Owner not determined';

    // Phase 1: Unfinished tasks & stubs
    unfinished.forEach((t, idx) => {
      tasks.push({
        id: `task-det-unf-${idx + 1}`,
        project_id: projectId,
        phase_id: 'phase-1',
        phase_name: 'Phase 1: Critical Implementations & Core Fixes',
        title: `Resolve ${t.type}: ${t.title}`,
        description: t.description,
        reason: `Flagged as unfinished ${t.type} during codebase analysis at ${t.location || 'source code'}.`,
        evidence: t.location || 'Detected in project analysis',
        source_file_refs: t.location ? [t.location] : [],
        priority: t.priority === 'high' ? 'critical' : t.priority === 'medium' ? 'high' : 'medium',
        priority_rationale: 'Unfinished stubs and TODOs block full mathematical completion.',
        estimated_complexity: t.priority === 'high' ? 'large' : 'medium',
        dependencies: [],
        suggested_owner: defaultOwner,
        status: 'pending',
        implementation_steps: [
          `Inspect ${t.location || 'target file'}`,
          'Implement full logic replacing temporary stub or TODO',
          'Add unit tests to verify implementation',
        ],
        expected_outcome: `Working implementation of ${t.title}`,
        gap_type: 'unfinished_task',
        evidence_verification: 'verified_issue',
      });
    });

    // Phase 2: Partially implemented functionalities
    partialFns.forEach((f, idx) => {
      tasks.push({
        id: `task-det-part-${idx + 1}`,
        project_id: projectId,
        phase_id: 'phase-2',
        phase_name: 'Phase 2: Feature Completion & Integration',
        title: `Complete Implementation: ${f.title}`,
        description: f.description,
        reason: `Functionality "${f.title}" is partially implemented across files: ${f.filesInvolved?.join(', ')}.`,
        evidence: f.filesInvolved?.join(', ') || '',
        source_file_refs: f.filesInvolved || [],
        priority: 'high',
        priority_rationale: 'Core feature functionality is currently only partial.',
        estimated_complexity: 'medium',
        dependencies: [],
        suggested_owner: defaultOwner,
        status: 'pending',
        implementation_steps: [
          'Verify missing edge cases in connected files',
          'Ensure error handling and validation are present',
        ],
        expected_outcome: `Feature ${f.title} reaches 100% full implementation status.`,
        gap_type: 'incomplete_functionality',
        evidence_verification: 'verified_issue',
      });
    });

    // Phase 3: Error handling & quality
    tasks.push({
      id: `task-det-err-1`,
      project_id: projectId,
      phase_id: 'phase-3',
      phase_name: 'Phase 3: Reliability, Error Handling & Tests',
      title: 'Harden API Error Handling and Validation',
      description: 'Audit backend routes and client mutations to ensure all network errors, bad payloads, and timeouts are safely caught and reported.',
      reason: 'Robust production architectures require centralized error boundaries and schema validation.',
      evidence: 'Project architectural inspection',
      source_file_refs: [],
      priority: 'medium',
      priority_rationale: 'Prevents silent failures and ensures clear error feedback.',
      estimated_complexity: 'medium',
      dependencies: [],
      suggested_owner: defaultOwner,
      status: 'pending',
      implementation_steps: [
        'Review endpoints for try/catch blocks',
        'Add request validation checks',
      ],
      expected_outcome: 'Zero unhandled exceptions during API execution.',
      gap_type: 'missing_error_handling',
      evidence_verification: 'ai_inferred_issue',
    });

    // Phase 4: Documentation
    tasks.push({
      id: `task-det-doc-1`,
      project_id: projectId,
      phase_id: 'phase-4',
      phase_name: 'Phase 4: Optimization, Documentation & Handover',
      title: 'Complete Environment & Handover Documentation',
      description: 'Document all required environment variables and setup instructions for new engineers.',
      reason: 'Ensures incoming engineers can onboard and run the application without ambiguity.',
      evidence: 'Technical documentation checklist',
      source_file_refs: ['README.md', '.env.example'],
      priority: 'low',
      priority_rationale: 'Necessary for human handover sign-off and deployment stability.',
      estimated_complexity: 'small',
      dependencies: [],
      suggested_owner: defaultOwner,
      status: 'pending',
      implementation_steps: [
        'Document all keys in .env.example',
        'Verify step-by-step setup instructions',
      ],
      expected_outcome: 'Comprehensive developer handover documentation.',
      gap_type: 'documentation_gap',
      evidence_verification: 'verified_issue',
    });

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
      { id: 'phase-1', name: 'Phase 1: Critical Implementations & Core Fixes' },
      { id: 'phase-2', name: 'Phase 2: Feature Completion & Integration' },
      { id: 'phase-3', name: 'Phase 3: Reliability, Error Handling & Tests' },
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

