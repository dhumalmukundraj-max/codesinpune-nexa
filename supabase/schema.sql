-- ==============================================================================
-- Er.NEXA Database Schema & Row Level Security (RLS)
-- Run this script in the Supabase SQL Editor to set up all tables and policies.
-- ==============================================================================

-- 1. Profiles Table (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to create profile when auth.users signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  project_password_hash TEXT,
  has_password BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'ready' CHECK (status IN ('uploading', 'analyzing', 'ready', 'failed')),
  completion_percentage NUMERIC(5, 2) DEFAULT 0.0,
  languages JSONB DEFAULT '[]'::JSONB,
  frameworks TEXT[] DEFAULT ARRAY[]::TEXT[],
  source_type TEXT DEFAULT 'folder' CHECK (source_type IN ('folder', 'zip', 'github', 'desktop')),
  repository_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Project Analyses Table
CREATE TABLE IF NOT EXISTS public.project_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL UNIQUE,
  summary JSONB NOT NULL DEFAULT '{}'::JSONB,
  flowchart_mermaid TEXT,
  block_diagram_mermaid TEXT,
  roadmap JSONB NOT NULL DEFAULT '{"phases": []}'::JSONB,
  progress_metrics JSONB NOT NULL DEFAULT '{}'::JSONB,
  file_tree JSONB DEFAULT '[]'::JSONB,
  raw_stats JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Project Permissions Table (Role-based access: owner, reviewer, editor, viewer)
CREATE TABLE IF NOT EXISTS public.project_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_email TEXT,
  role TEXT NOT NULL CHECK (role IN ('owner', 'reviewer', 'editor', 'viewer')),
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

-- 5. Project Reviews & Approvals Table
CREATE TABLE IF NOT EXISTS public.project_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'approved', 'rejected')),
  notes TEXT,
  edited_summary JSONB,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Project Files Metadata Table
CREATE TABLE IF NOT EXISTS public.project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  language TEXT,
  is_entry_point BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_project_analyses_project_id ON public.project_analyses(project_id);
CREATE INDEX IF NOT EXISTS idx_project_permissions_user_id ON public.project_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_project_permissions_project_id ON public.project_permissions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_reviews_project_id ON public.project_reviews(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON public.project_files(project_id);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user has access to a project
CREATE OR REPLACE FUNCTION public.has_project_access(p_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.projects WHERE id = p_id AND user_id = p_user_id
    UNION
    SELECT 1 FROM public.project_permissions WHERE project_id = p_id AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user has edit/manage access
CREATE OR REPLACE FUNCTION public.can_edit_project(p_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.projects WHERE id = p_id AND user_id = p_user_id
    UNION
    SELECT 1 FROM public.project_permissions 
    WHERE project_id = p_id AND user_id = p_user_id AND role IN ('owner', 'editor')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Public profiles are readable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Projects Policies
CREATE POLICY "Users can view accessible projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.project_permissions WHERE project_id = projects.id AND user_id = auth.uid())
  );

CREATE POLICY "Users can create their own projects"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners and editors can update projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (public.can_edit_project(id, auth.uid()));

CREATE POLICY "Owners can delete their projects"
  ON public.projects FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Project Analyses Policies
CREATE POLICY "Users can view analyses of accessible projects"
  ON public.project_analyses FOR SELECT
  TO authenticated
  USING (public.has_project_access(project_id, auth.uid()));

CREATE POLICY "Owners and editors can insert analyses"
  ON public.project_analyses FOR INSERT
  TO authenticated
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));

CREATE POLICY "Owners and editors can update analyses"
  ON public.project_analyses FOR UPDATE
  TO authenticated
  USING (public.can_edit_project(project_id, auth.uid()));

CREATE POLICY "Owners can delete analyses"
  ON public.project_analyses FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_analyses.project_id AND user_id = auth.uid()));

-- Project Permissions Policies
CREATE POLICY "Users can view permissions of accessible projects"
  ON public.project_permissions FOR SELECT
  TO authenticated
  USING (public.has_project_access(project_id, auth.uid()));

CREATE POLICY "Project owners can manage permissions"
  ON public.project_permissions FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_permissions.project_id AND user_id = auth.uid()));

-- Project Reviews Policies
CREATE POLICY "Users can view reviews of accessible projects"
  ON public.project_reviews FOR SELECT
  TO authenticated
  USING (public.has_project_access(project_id, auth.uid()));

CREATE POLICY "Reviewers and owners can create/update reviews"
  ON public.project_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_reviews.project_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.project_permissions WHERE project_id = project_reviews.project_id AND user_id = auth.uid() AND role IN ('owner', 'reviewer'))
  );

CREATE POLICY "Reviewers and owners can update their reviews"
  ON public.project_reviews FOR UPDATE
  TO authenticated
  USING (
    reviewer_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_reviews.project_id AND user_id = auth.uid())
  );

-- Project Files Policies
CREATE POLICY "Users can view project files of accessible projects"
  ON public.project_files FOR SELECT
  TO authenticated
  USING (public.has_project_access(project_id, auth.uid()));

CREATE POLICY "Owners and editors can manage project files"
  ON public.project_files FOR ALL
  TO authenticated
  USING (public.can_edit_project(project_id, auth.uid()));

