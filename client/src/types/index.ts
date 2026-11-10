export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
}

export interface ProjectSummary {
  introduction: {
    name: string;
    tagline: string;
    description: string;
    primaryLanguages: string[];
    frameworks: string[];
    architectureStyle: string;
    verifiedFacts: string[];
    aiInferences: string[];
    unknowns: string[];
  };
  decisions: Array<{
    topic: string;
    decision: string;
    evidenceFile?: string;
    status: 'verified' | 'inferred' | 'unknown';
  }>;
  technicalDocumentation: {
    setupInstructions: string[];
    environmentVariables: Array<{ key: string; description: string; required: boolean }>;
    scripts: Array<{ command: string; purpose: string }>;
    apiEndpoints?: Array<{ method: string; path: string; description: string }>;
  };
  existingFunctionalities: Array<{
    title: string;
    description: string;
    filesInvolved: string[];
    status: 'fully_implemented' | 'partially_implemented';
  }>;
  unfinishedTasks: Array<{
    title: string;
    description: string;
    location?: string;
    type: 'TODO' | 'FIXME' | 'STUB' | 'MISSING_FEATURE';
    priority: 'high' | 'medium' | 'low';
  }>;
  dependencies: Array<{
    name: string;
    version?: string;
    category: 'core' | 'ui' | 'backend' | 'dev' | 'database' | 'ai' | 'other';
    purpose: string;
  }>;
  discussionsAndCommunications: {
    foundSources: string[];
    notes: string[];
    hasHistoricalRecords: boolean;
  };
  futurePlansAndActions: string[];
  missingOrContradictoryInformation: string[];
}

export interface RoadmapPhase {
  id: string;
  name: string;
  status: 'completed' | 'in_progress' | 'planned';
  sequenceOrder: number;
  tasks: Array<{
    title: string;
    description: string;
    status: 'completed' | 'in_progress' | 'pending';
    dependencies?: string[];
  }>;
}

export interface RoadmapModel {
  phases: RoadmapPhase[];
  recommendedSequence: string[];
  immediateNextSteps: string[];
}

export interface ProgressMetrics {
  completionPercentage: number;
  totalTasksIdentified: number;
  completedTasksCount: number;
  partialTasksCount: number;
  pendingTasksCount: number;
  calculationBasis: string;
  problemStatement?: string;
  isProblemStatementSolved?: boolean;
}

export interface AnalysisData {
  id?: string;
  project_id?: string;
  summary: ProjectSummary;
  flowchartMermaid?: string;
  flowchart_mermaid?: string;
  blockDiagramMermaid?: string;
  block_diagram_mermaid?: string;
  roadmap: RoadmapModel;
  progressMetrics?: ProgressMetrics;
  progress_metrics?: ProgressMetrics;
  file_tree?: any[];
  raw_stats?: any;
}

export interface ProjectItem {
  id: string;
  name: string;
  description?: string;
  has_password?: boolean;
  isLocked?: boolean;
  status: 'uploading' | 'analyzing' | 'ready' | 'failed';
  completion_percentage: number;
  languages?: Array<{ language: string; count: number; percentage: number }>;
  frameworks?: string[];
  source_type?: 'folder' | 'zip' | 'github' | 'desktop';
  repository_url?: string;
  userRole?: 'owner' | 'reviewer' | 'editor' | 'viewer';
  created_at: string;
  updated_at?: string;
}

export interface ProjectReview {
  id: string;
  project_id: string;
  reviewer_id?: string;
  status: 'draft' | 'under_review' | 'approved' | 'rejected';
  notes?: string;
  edited_summary?: ProjectSummary;
  approved_at?: string;
  created_at: string;
}

export interface ProjectPermission {
  id: string;
  project_id: string;
  user_id: string;
  user_email?: string;
  role: 'owner' | 'reviewer' | 'editor' | 'viewer';
  created_at: string;
}

