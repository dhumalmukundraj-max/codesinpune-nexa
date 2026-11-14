-- ==============================================================================
-- Er.NEXA Round 3 Migration: Continuous GitHub Sync, Knowledge Graph, & Tasks
-- Run this script in the Supabase SQL Editor.
-- ==============================================================================

-- 1. GitHub Synchronization Configurations
CREATE TABLE IF NOT EXISTS public.github_sync_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL UNIQUE,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  repo_url TEXT NOT NULL,
  default_branch TEXT DEFAULT 'main',
  github_token TEXT,
  webhook_secret TEXT,
  webhook_id BIGINT,
  sync_interval TEXT DEFAULT 'disabled' CHECK (sync_interval IN ('disabled', '30m', '1h', '6h', '24h')),
  last_synced_at TIMESTAMPTZ,
  last_commit_sha TEXT,
  status TEXT DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'syncing', 'up_to_date', 'changes_detected', 'failed')),
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. GitHub Synchronization History
CREATE TABLE IF NOT EXISTS public.github_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'webhook', 'scheduled', 'initial')),
  commit_sha TEXT,
  commit_message TEXT,
  commit_author TEXT,
  commits_count INT DEFAULT 1,
  files_changed_count INT DEFAULT 0,
  changed_files JSONB DEFAULT '[]'::JSONB,
  status TEXT DEFAULT 'completed' CHECK (status IN ('started', 'completed', 'failed')),
  error_message TEXT,
  analysis_duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Webhook Events (For Idempotency & Deduplication)
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  repo_full_name TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  commit_sha TEXT,
  payload JSONB DEFAULT '{}'::JSONB,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Project Analysis Versions (Historical Snapshot on Sync)
CREATE TABLE IF NOT EXISTS public.project_analysis_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  version_number INT NOT NULL,
  commit_sha TEXT,
  summary JSONB NOT NULL DEFAULT '{}'::JSONB,
  flowchart_mermaid TEXT,
  block_diagram_mermaid TEXT,
  progress_metrics JSONB DEFAULT '{}'::JSONB,
  trigger_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Knowledge Graph Nodes
CREATE TABLE IF NOT EXISTS public.knowledge_graph_nodes (
  id TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  node_type TEXT NOT NULL CHECK (node_type IN (
    'project',
    'frontend_component',
    'backend_module',
    'source_file',
    'function_class',
    'api_endpoint',
    'database_table',
    'external_dependency',
    'ai_service',
    'architectural_decision'
  )),
  file_path TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  evidence_type TEXT DEFAULT 'verified_code' CHECK (evidence_type IN ('verified_code', 'ai_inferred', 'conceptual')),
  confidence NUMERIC(3, 2) DEFAULT 1.0,
  position_x NUMERIC(8, 2) DEFAULT 0,
  position_y NUMERIC(8, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, id)
);

-- 6. Knowledge Graph Edges
CREATE TABLE IF NOT EXISTS public.knowledge_graph_edges (
  id TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  source_node_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN (
    'imports',
    'exports',
    'calls',
    'depends_on',
    'connects_to',
    'reads_from',
    'writes_to',
    'uses_api',
    'implements',
    'belongs_to',
    'architectural_relationship'
  )),
  label TEXT,
  evidence TEXT,
  evidence_file TEXT,
  evidence_line INT,
  extraction_method TEXT DEFAULT 'static_analysis' CHECK (extraction_method IN ('static_analysis', 'ast_parser', 'ai_inferred')),
  confidence NUMERIC(3, 2) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, id)
);

-- 7. Project Tasks & Roadmap Recommendations
CREATE TABLE IF NOT EXISTS public.project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  phase_id TEXT DEFAULT 'phase-1',
  phase_name TEXT DEFAULT 'Phase 1: Critical Implementations',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reason TEXT,
  evidence TEXT,
  source_file_refs TEXT[] DEFAULT ARRAY[]::TEXT[],
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  priority_rationale TEXT,
  estimated_complexity TEXT DEFAULT 'medium' CHECK (estimated_complexity IN ('small', 'medium', 'large')),
  dependencies TEXT[] DEFAULT ARRAY[]::TEXT[],
  suggested_owner TEXT DEFAULT 'Owner not determined',
  assigned_owner TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('suggested', 'accepted', 'rejected', 'pending', 'in_progress', 'completed')),
  implementation_steps JSONB DEFAULT '[]'::JSONB,
  expected_outcome TEXT,
  gap_type TEXT CHECK (gap_type IN (
    'incomplete_functionality',
    'unfinished_task',
    'missing_error_handling',
    'missing_validation',
    'missing_tests',
    'documentation_gap',
    'technical_debt',
    'dependency_issue',
    'general_enhancement'
  )),
  evidence_verification TEXT DEFAULT 'verified_code' CHECK (evidence_verification IN ('verified_issue', 'ai_inferred_issue', 'unknown_evidence')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_github_sync_configs_project_id ON public.github_sync_configs(project_id);
CREATE INDEX IF NOT EXISTS idx_github_sync_history_project_id ON public.github_sync_history(project_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_delivery_id ON public.webhook_events(delivery_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_repo ON public.webhook_events(repo_full_name);
CREATE INDEX IF NOT EXISTS idx_project_analysis_versions_project_id ON public.project_analysis_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_graph_nodes_project_id ON public.knowledge_graph_nodes(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_graph_edges_project_id ON public.knowledge_graph_edges(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON public.project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON public.project_tasks(status);

-- Enable RLS
ALTER TABLE public.github_sync_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_sync_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_analysis_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_graph_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_graph_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

-- Helper RLS Policies for authenticated users
CREATE POLICY "Users can access sync configs for permitted projects"
  ON public.github_sync_configs FOR ALL
  TO authenticated
  USING (public.has_project_access(project_id, auth.uid()));

CREATE POLICY "Users can view sync history for permitted projects"
  ON public.github_sync_history FOR ALL
  TO authenticated
  USING (public.has_project_access(project_id, auth.uid()));

CREATE POLICY "Users can view analysis versions for permitted projects"
  ON public.project_analysis_versions FOR ALL
  TO authenticated
  USING (public.has_project_access(project_id, auth.uid()));

CREATE POLICY "Users can access knowledge graph nodes for permitted projects"
  ON public.knowledge_graph_nodes FOR ALL
  TO authenticated
  USING (public.has_project_access(project_id, auth.uid()));

CREATE POLICY "Users can access knowledge graph edges for permitted projects"
  ON public.knowledge_graph_edges FOR ALL
  TO authenticated
  USING (public.has_project_access(project_id, auth.uid()));

CREATE POLICY "Users can access tasks for permitted projects"
  ON public.project_tasks FOR ALL
  TO authenticated
  USING (public.has_project_access(project_id, auth.uid()));

