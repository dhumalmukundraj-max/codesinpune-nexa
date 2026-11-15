export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  display_name?: string;
  username?: string;
  bio?: string;
  public_id?: string;
  avatar_url?: string;
  role?: string;
  created_at?: string;
  updated_at?: string;
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
  original_filename?: string;
  original_folder_name?: string;
  original_local_path?: string;
  analysis_method?: 'zip_upload' | 'folder_upload' | 'local_path' | 'github_repo' | string;
  source_connection_status?: string;
  encryption_salt?: string;
  key_version?: number;
  encryption_updated_at?: string;
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

// ==========================================
// ROUND 3: Continuous Sync, Knowledge Graph & Roadmap
// ==========================================

export interface GitHubSyncConfig {
  id?: string;
  project_id: string;
  repo_owner: string;
  repo_name: string;
  repo_url: string;
  default_branch: string;
  github_token?: string;
  has_token?: boolean;
  webhook_secret?: string;
  sync_interval: 'disabled' | '30m' | '1h' | '6h' | '24h';
  last_synced_at?: string;
  last_commit_sha?: string;
  status: 'connected' | 'disconnected' | 'syncing' | 'error';
  error_message?: string;
  created_at?: string;
  updated_at?: string;
}

export interface GitHubSyncHistoryItem {
  id: string;
  project_id: string;
  trigger_type: 'manual' | 'webhook' | 'scheduled' | 'initial';
  commit_sha?: string;
  commit_message?: string;
  commit_author?: string;
  commits_count: number;
  files_changed_count: number;
  changed_files: Array<{
    filename: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed';
    additions?: number;
    deletions?: number;
  }>;
  status: 'completed' | 'failed' | 'in_progress';
  error_message?: string;
  created_at: string;
}

export type KnowledgeNodeType =
  | 'project'
  | 'frontend_component'
  | 'backend_module'
  | 'source_file'
  | 'function_class'
  | 'api_endpoint'
  | 'database_table'
  | 'external_dependency'
  | 'ai_service'
  | 'architectural_decision';

export type KnowledgeRelationshipType =
  | 'imports'
  | 'exports'
  | 'calls'
  | 'depends_on'
  | 'connects_to'
  | 'reads_from'
  | 'writes_to'
  | 'uses_api'
  | 'implements'
  | 'belongs_to'
  | 'architectural_relationship';

export interface KnowledgeGraphNode {
  id: string;
  project_id: string;
  label: string;
  node_type: KnowledgeNodeType;
  file_path?: string;
  line_number?: number;
  description?: string;
  evidence_type?: 'verified_code' | 'ai_inferred' | 'architectural_spec';
  confidence?: number;
  metadata?: Record<string, any>;
  position?: { x: number; y: number };
  [key: string]: any;
}

export interface KnowledgeGraphEdge {
  id: string;
  project_id: string;
  source_node_id: string;
  target_node_id: string;
  relationship_type: KnowledgeRelationshipType;
  label?: string;
  evidence?: string;
  evidence_file?: string;
  evidence_line?: number;
  extraction_method?: 'static_analysis' | 'ai_inference' | 'architectural_flow';
  confidence?: number;
}

export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  metadata?: {
    nodeCounts?: Record<string, number>;
    totalNodes?: number;
    totalEdges?: number;
  };
}

export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  description: string;
  reason: string;
  gap_type:
    | 'incomplete_functionality'
    | 'unfinished_task'
    | 'missing_validation'
    | 'missing_test'
    | 'documentation_gap'
    | 'technical_debt';
  phase: 'Phase 1: Critical Stabilization' | 'Phase 2: Core Enhancement' | 'Phase 3: Integration & Quality' | 'Phase 4: Optimization & Scale';
  priority: 'critical' | 'high' | 'medium' | 'low';
  priority_reason?: string;
  complexity: 'low' | 'medium' | 'high';
  dependencies: string[];
  suggested_owner: string;
  owner_reasoning?: string;
  implementation_steps: string[];
  expected_outcome: string;
  source_file_references: string[];
  supporting_evidence?: string;
  evidence_type: 'verified_code' | 'ai_inferred';
  status: 'suggested' | 'pending' | 'in_progress' | 'completed' | 'rejected';
  created_at?: string;
  updated_at?: string;
}

export interface RoadmapPhaseGroup {
  name: string;
  tasks: ProjectTask[];
  completedCount: number;
  totalCount: number;
  progressPercentage: number;
}

// ==========================================
// Inbuilt Real-Time Messenger Types
// ==========================================

export interface MessageAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  category: 'image' | 'document';
  url: string;
  storage_path?: string;
  thumbnail_url?: string;
}

export interface ConversationItem {
  id: string;
  otherParticipant: UserProfile;
  lastMessage?: {
    content: string;
    sender_id: string;
    created_at: string;
    message_type?: 'text' | 'image' | 'document' | 'mixed';
    attachments_count?: number;
  };
  unreadCount: number;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name?: string;
  sender_avatar?: string;
  content: string;
  created_at: string;
  message_type?: 'text' | 'image' | 'document' | 'mixed';
  attachments?: MessageAttachment[];
  metadata?: Record<string, any>;
  isUploading?: boolean;
}



