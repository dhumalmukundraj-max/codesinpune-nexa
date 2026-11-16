-- ==============================================================================
-- Er.NEXA — Knowledge Handover Centre Migration
-- Comprehensive tables for AI-Reconstructed Knowledge Handovers, Evidence
-- Traceability, Human Review & Approval, Version History, Role-Based Sharing,
-- Incoming Member Acknowledgements, and Real-Time Notifications.
-- ==============================================================================

-- 1. Main Project Handovers Table
CREATE TABLE IF NOT EXISTS public.project_handovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  outgoing_member_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  incoming_member_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
    status IN (
      'DRAFT',
      'GENERATING',
      'UNDER_REVIEW',
      'REVISION_REQUIRED',
      'APPROVED',
      'SHARED',
      'ACKNOWLEDGED',
      'ARCHIVED'
    )
  ),
  content JSONB NOT NULL DEFAULT '{}'::JSONB,
  original_ai_content JSONB,
  current_version INT NOT NULL DEFAULT 1,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  shared_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast Handover queries
CREATE INDEX IF NOT EXISTS idx_handovers_project_id ON public.project_handovers(project_id);
CREATE INDEX IF NOT EXISTS idx_handovers_creator_id ON public.project_handovers(creator_id);
CREATE INDEX IF NOT EXISTS idx_handovers_outgoing_id ON public.project_handovers(outgoing_member_id);
CREATE INDEX IF NOT EXISTS idx_handovers_incoming_id ON public.project_handovers(incoming_member_id);
CREATE INDEX IF NOT EXISTS idx_handovers_reviewer_id ON public.project_handovers(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_handovers_status ON public.project_handovers(status);

-- 2. Traceable Handover Claims & Evidence Table
CREATE TABLE IF NOT EXISTS public.handover_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id UUID REFERENCES public.project_handovers(id) ON DELETE CASCADE NOT NULL,
  section_key TEXT NOT NULL,
  claim_text TEXT NOT NULL,
  category TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'AI INFERENCE' CHECK (
    verification_status IN (
      'VERIFIED FACT',
      'AI INFERENCE',
      'UNKNOWN',
      'CONFLICTING INFORMATION'
    )
  ),
  confidence_score NUMERIC(3, 2) DEFAULT 0.85,
  source_type TEXT DEFAULT 'code_file',
  source_identifier TEXT,
  file_path TEXT,
  line_reference TEXT,
  supporting_excerpt TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claims_handover_id ON public.handover_claims(handover_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON public.handover_claims(verification_status);

-- 3. Handover Version History Table
CREATE TABLE IF NOT EXISTS public.handover_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id UUID REFERENCES public.project_handovers(id) ON DELETE CASCADE NOT NULL,
  version_number INT NOT NULL,
  snapshot JSONB NOT NULL,
  editor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  change_summary TEXT,
  status_at_version TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(handover_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_versions_handover_id ON public.handover_versions(handover_id, version_number DESC);

-- 4. Handover Comments & Clarifications Table
CREATE TABLE IF NOT EXISTS public.handover_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id UUID REFERENCES public.project_handovers(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  section_key TEXT,
  claim_id UUID REFERENCES public.handover_claims(id) ON DELETE SET NULL,
  comment_type TEXT DEFAULT 'general' CHECK (
    comment_type IN ('general', 'review_note', 'clarification_request', 'correction')
  ),
  content TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_handover_id ON public.handover_comments(handover_id);

-- 5. Handover Acknowledgements Table
CREATE TABLE IF NOT EXISTS public.handover_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id UUID REFERENCES public.project_handovers(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  version_number INT NOT NULL,
  checklist_state JSONB DEFAULT '{}'::JSONB,
  comments TEXT,
  missing_information_reported TEXT,
  status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (
    status IN ('CONFIRMED', 'NEEDS_CLARIFICATION')
  ),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ack_handover_id ON public.handover_acknowledgements(handover_id);

-- 6. Handover Real-Time Notifications Table
CREATE TABLE IF NOT EXISTS public.handover_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id UUID REFERENCES public.project_handovers(id) ON DELETE CASCADE NOT NULL,
  recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (
    type IN (
      'assigned',
      'submitted_for_review',
      'revision_requested',
      'approved',
      'shared',
      'acknowledged',
      'comment_added'
    )
  ),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_handover_notif_recipient ON public.handover_notifications(recipient_id, is_read, created_at DESC);

-- ==============================================================================
-- 7. Helper Security Functions (SECURITY DEFINER to avoid policy recursion)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_handover_participant(h_id UUID, usr_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_handovers h
    WHERE h.id = h_id AND (
      h.creator_id = usr_id OR
      h.outgoing_member_id = usr_id OR
      h.incoming_member_id = usr_id OR
      h.reviewer_id = usr_id OR
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = h.project_id AND p.user_id = usr_id
      ) OR
      EXISTS (
        SELECT 1 FROM public.project_permissions pp
        WHERE pp.project_id = h.project_id AND pp.user_id = usr_id
      )
    )
  );
$$;

-- ==============================================================================
-- 8. Row Level Security (RLS) Setup
-- ==============================================================================

ALTER TABLE public.project_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handover_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handover_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handover_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handover_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handover_notifications ENABLE ROW LEVEL SECURITY;

-- Policies for project_handovers
DROP POLICY IF EXISTS "Participants can view handovers" ON public.project_handovers;
CREATE POLICY "Participants can view handovers" ON public.project_handovers
  FOR SELECT USING (public.is_handover_participant(id, auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can create handovers" ON public.project_handovers;
CREATE POLICY "Authenticated users can create handovers" ON public.project_handovers
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authorized participants can update handovers" ON public.project_handovers;
CREATE POLICY "Authorized participants can update handovers" ON public.project_handovers
  FOR UPDATE USING (public.is_handover_participant(id, auth.uid()));

DROP POLICY IF EXISTS "Creator or project owner can delete handovers" ON public.project_handovers;
CREATE POLICY "Creator or project owner can delete handovers" ON public.project_handovers
  FOR DELETE USING (
    creator_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_handovers.project_id AND p.user_id = auth.uid()
    )
  );

-- Policies for handover_claims
DROP POLICY IF EXISTS "Participants can view handover claims" ON public.handover_claims;
CREATE POLICY "Participants can view handover claims" ON public.handover_claims
  FOR SELECT USING (public.is_handover_participant(handover_id, auth.uid()));

DROP POLICY IF EXISTS "Participants can insert handover claims" ON public.handover_claims;
CREATE POLICY "Participants can insert handover claims" ON public.handover_claims
  FOR INSERT WITH CHECK (public.is_handover_participant(handover_id, auth.uid()));

DROP POLICY IF EXISTS "Reviewers and owners can update claims" ON public.handover_claims;
CREATE POLICY "Reviewers and owners can update claims" ON public.handover_claims
  FOR UPDATE USING (public.is_handover_participant(handover_id, auth.uid()));

-- Policies for handover_versions
DROP POLICY IF EXISTS "Participants can view handover versions" ON public.handover_versions;
CREATE POLICY "Participants can view handover versions" ON public.handover_versions
  FOR SELECT USING (public.is_handover_participant(handover_id, auth.uid()));

DROP POLICY IF EXISTS "Participants can insert handover versions" ON public.handover_versions;
CREATE POLICY "Participants can insert handover versions" ON public.handover_versions
  FOR INSERT WITH CHECK (public.is_handover_participant(handover_id, auth.uid()));

-- Policies for handover_comments
DROP POLICY IF EXISTS "Participants can view handover comments" ON public.handover_comments;
CREATE POLICY "Participants can view handover comments" ON public.handover_comments
  FOR SELECT USING (public.is_handover_participant(handover_id, auth.uid()));

DROP POLICY IF EXISTS "Participants can add handover comments" ON public.handover_comments;
CREATE POLICY "Participants can add handover comments" ON public.handover_comments
  FOR INSERT WITH CHECK (auth.uid() = author_id AND public.is_handover_participant(handover_id, auth.uid()));

DROP POLICY IF EXISTS "Authors can update their own comments" ON public.handover_comments;
CREATE POLICY "Authors can update their own comments" ON public.handover_comments
  FOR UPDATE USING (auth.uid() = author_id);

-- Policies for handover_acknowledgements
DROP POLICY IF EXISTS "Participants can view acknowledgements" ON public.handover_acknowledgements;
CREATE POLICY "Participants can view acknowledgements" ON public.handover_acknowledgements
  FOR SELECT USING (public.is_handover_participant(handover_id, auth.uid()));

DROP POLICY IF EXISTS "Incoming members can submit acknowledgement" ON public.handover_acknowledgements;
CREATE POLICY "Incoming members can submit acknowledgement" ON public.handover_acknowledgements
  FOR INSERT WITH CHECK (auth.uid() = member_id AND public.is_handover_participant(handover_id, auth.uid()));

-- Policies for handover_notifications
DROP POLICY IF EXISTS "Users can view their own handover notifications" ON public.handover_notifications;
CREATE POLICY "Users can view their own handover notifications" ON public.handover_notifications
  FOR SELECT USING (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.handover_notifications;
CREATE POLICY "Users can update their own notifications" ON public.handover_notifications
  FOR UPDATE USING (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Authenticated users can trigger notifications" ON public.handover_notifications;
CREATE POLICY "Authenticated users can trigger notifications" ON public.handover_notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ==============================================================================
-- 9. Realtime Publication
-- ==============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_handovers;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.handover_comments;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.handover_notifications;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
