-- ==============================================================================
-- Migración: Módulo de Temas, Fuentes, Proyectos y Almacenamiento
-- ==============================================================================

-- 1. Tabla de Temas (topics)
CREATE TABLE IF NOT EXISTS public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  main_note TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS en topics
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "topics_select_policy" ON public.topics;
CREATE POLICY "topics_select_policy" ON public.topics
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "topics_insert_policy" ON public.topics;
CREATE POLICY "topics_insert_policy" ON public.topics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "topics_update_policy" ON public.topics;
CREATE POLICY "topics_update_policy" ON public.topics
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "topics_delete_policy" ON public.topics;
CREATE POLICY "topics_delete_policy" ON public.topics
  FOR DELETE USING (auth.uid() = user_id);

-- 2. Tabla de Fuentes (sources)
CREATE TABLE IF NOT EXISTS public.sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('Nota', 'Archivo', 'Enlace')),
  content TEXT DEFAULT '',
  file_url TEXT DEFAULT '',
  file_path TEXT DEFAULT '',
  file_size BIGINT DEFAULT 0,
  file_type TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'processing', 'pending')),
  is_in_context BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS en sources
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sources_select_policy" ON public.sources;
CREATE POLICY "sources_select_policy" ON public.sources
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sources_insert_policy" ON public.sources;
CREATE POLICY "sources_insert_policy" ON public.sources
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "sources_update_policy" ON public.sources;
CREATE POLICY "sources_update_policy" ON public.sources
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "sources_delete_policy" ON public.sources;
CREATE POLICY "sources_delete_policy" ON public.sources
  FOR DELETE USING (auth.uid() = user_id);

-- 3. Tabla de Proyectos (projects)
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select_policy" ON public.projects;
CREATE POLICY "projects_select_policy" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "projects_insert_policy" ON public.projects;
CREATE POLICY "projects_insert_policy" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "projects_update_policy" ON public.projects;
CREATE POLICY "projects_update_policy" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "projects_delete_policy" ON public.projects;
CREATE POLICY "projects_delete_policy" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

-- 4. Tabla de Hitos / Tareas del Proyecto (project_milestones) para cálculo real de progreso
CREATE TABLE IF NOT EXISTS public.project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "milestones_select_policy" ON public.project_milestones;
CREATE POLICY "milestones_select_policy" ON public.project_milestones
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "milestones_insert_policy" ON public.project_milestones;
CREATE POLICY "milestones_insert_policy" ON public.project_milestones
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "milestones_update_policy" ON public.project_milestones;
CREATE POLICY "milestones_update_policy" ON public.project_milestones
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "milestones_delete_policy" ON public.project_milestones;
CREATE POLICY "milestones_delete_policy" ON public.project_milestones
  FOR DELETE USING (auth.uid() = user_id);

-- 5. Tabla Relacional de Temas y Proyectos (topic_projects)
CREATE TABLE IF NOT EXISTS public.topic_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_topic_project UNIQUE (topic_id, project_id)
);

ALTER TABLE public.topic_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "topic_projects_select_policy" ON public.topic_projects;
CREATE POLICY "topic_projects_select_policy" ON public.topic_projects
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "topic_projects_insert_policy" ON public.topic_projects;
CREATE POLICY "topic_projects_insert_policy" ON public.topic_projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "topic_projects_delete_policy" ON public.topic_projects;
CREATE POLICY "topic_projects_delete_policy" ON public.topic_projects
  FOR DELETE USING (auth.uid() = user_id);

-- 6. Bucket de Almacenamiento para Archivos de Temas (topic-files)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'topic-files',
  'topic-files',
  true,
  5242880, -- 5 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown'
  ];

-- Políticas de Storage para el bucket topic-files
DROP POLICY IF EXISTS "topic_files_select_policy" ON storage.objects;
CREATE POLICY "topic_files_select_policy" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'topic-files');

DROP POLICY IF EXISTS "topic_files_insert_policy" ON storage.objects;
CREATE POLICY "topic_files_insert_policy" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'topic-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "topic_files_update_policy" ON storage.objects;
CREATE POLICY "topic_files_update_policy" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'topic-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "topic_files_delete_policy" ON storage.objects;
CREATE POLICY "topic_files_delete_policy" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'topic-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
