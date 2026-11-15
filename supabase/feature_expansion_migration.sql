-- ==============================================================================
-- Er.NEXA — Feature Expansion Migration (Profiles, Messenger, Source & Security)
-- Run this script in the Supabase SQL Editor.
-- ==============================================================================

-- 1. Extend Profiles Table for Instagram-style User Profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS public_id TEXT;

-- Create unique case-insensitive index on username
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower
  ON public.profiles (LOWER(username))
  WHERE username IS NOT NULL;

-- Create unique index on public_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_public_id
  ON public.profiles (public_id)
  WHERE public_id IS NOT NULL;

-- 2. Extend Projects Table for Source Visibility & Encryption Metadata
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS original_filename TEXT,
  ADD COLUMN IF NOT EXISTS original_folder_name TEXT,
  ADD COLUMN IF NOT EXISTS original_local_path TEXT,
  ADD COLUMN IF NOT EXISTS analysis_method TEXT DEFAULT 'folder',
  ADD COLUMN IF NOT EXISTS source_connection_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS encryption_salt TEXT,
  ADD COLUMN IF NOT EXISTS key_version INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS encryption_updated_at TIMESTAMPTZ;

-- 3. Inbuilt Real-Time Messenger Tables

-- A. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  is_group BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- B. Conversation Participants Table
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- C. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT DEFAULT '',
  attachments JSONB DEFAULT '[]'::JSONB,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'mixed')),
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure existing messages table has attachments and message_type columns
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.messages ALTER COLUMN content DROP NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::JSONB;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Indexes for fast Messenger queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON public.conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conv ON public.conversation_participants(conversation_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Conversations RLS: Participants can read and participate
DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
CREATE POLICY "Participants can view conversations" ON public.conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversations.id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
CREATE POLICY "Authenticated users can create conversations" ON public.conversations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Conversation Participants RLS
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
CREATE POLICY "Users can view participants of their conversations" ON public.conversation_participants
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp2
      WHERE cp2.conversation_id = conversation_participants.conversation_id AND cp2.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can add participants to conversations" ON public.conversation_participants;
CREATE POLICY "Users can add participants to conversations" ON public.conversation_participants
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Messages RLS: Only conversation participants can view and send messages
DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
CREATE POLICY "Participants can view messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
CREATE POLICY "Participants can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
    )
  );

-- Enable Supabase Realtime for messages and conversations
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- 4. Supabase Storage Setup for Messenger Attachments (Images & Documents)
INSERT INTO storage.buckets (id, name, public)
VALUES ('messenger-attachments', 'messenger-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Authenticated users can upload to messenger-attachments
DROP POLICY IF EXISTS "Authenticated users can upload messenger attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload messenger attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'messenger-attachments');

-- Storage RLS: Authenticated users can read messenger attachments
DROP POLICY IF EXISTS "Authenticated users can read messenger attachments" ON storage.objects;
CREATE POLICY "Authenticated users can read messenger attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'messenger-attachments');
