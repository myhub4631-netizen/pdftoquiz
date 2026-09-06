-- =========================================================================
-- QUESTIONFORGE AI: SUPABASE MIGRATION (PostgreSQL Schema & Security)
-- =========================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum Types
CREATE TYPE user_role AS ENUM ('USER', 'ADMIN', 'MASTER_ADMIN');
CREATE TYPE user_status AS ENUM ('ACTIVE', 'BLOCKED', 'PENDING');
CREATE TYPE exam_type_enum AS ENUM ('NEET', 'JEE_MAIN', 'JEE_ADVANCED', 'OTHER');
CREATE TYPE project_status AS ENUM (
    'UPLOADING',
    'UPLOADED',
    'ANALYSING',
    'EXTRACTING',
    'PROCESSING_IMAGES',
    'AI_PROCESSING',
    'VALIDATION',
    'NEEDS_REVIEW',
    'COMPLETED',
    'FAILED'
);
CREATE TYPE question_type_enum AS ENUM (
    'single_correct',
    'multiple_correct',
    'assertion_reason',
    'numerical',
    'match_the_following',
    'true_false',
    'passage',
    'image_based',
    'other'
);
CREATE TYPE job_status_enum AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE image_type_enum AS ENUM ('diagram', 'formula', 'chemical_structure', 'graph', 'table', 'option_diagram', 'other');

-- -------------------------------------------------------------------------
-- 1. Profiles Table (Linked to auth.users)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role user_role DEFAULT 'USER' NOT NULL,
    status user_status DEFAULT 'ACTIVE' NOT NULL,
    projects_count INT DEFAULT 0 NOT NULL,
    questions_count INT DEFAULT 0 NOT NULL,
    storage_used_bytes BIGINT DEFAULT 0 NOT NULL,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- -------------------------------------------------------------------------
-- 2. Projects Table
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    exam_type exam_type_enum DEFAULT 'NEET' NOT NULL,
    year INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    subject_focus TEXT,
    description TEXT,
    status project_status DEFAULT 'UPLOADED' NOT NULL,
    total_questions INT DEFAULT 0 NOT NULL,
    total_pages INT DEFAULT 0 NOT NULL,
    expected_questions INT DEFAULT 180,
    extracted_questions INT DEFAULT 0 NOT NULL,
    needs_review_count INT DEFAULT 0 NOT NULL,
    image_settings JSONB DEFAULT '{
        "extract_images": true,
        "compress_images": true,
        "compression_level": "High",
        "convert_to_svg": false,
        "keep_original_images": true
    }'::jsonb NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- -------------------------------------------------------------------------
-- 3. Documents Table (PDF metadata & Storage path)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type TEXT DEFAULT 'application/pdf' NOT NULL,
    storage_path TEXT NOT NULL,
    page_count INT DEFAULT 0 NOT NULL,
    extracted_text_size BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- -------------------------------------------------------------------------
-- 4. Document Pages Table
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    page_number INT NOT NULL,
    text_content TEXT,
    page_image_path TEXT,
    ocr_applied BOOLEAN DEFAULT FALSE,
    width NUMERIC,
    height NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(document_id, page_number)
);

-- -------------------------------------------------------------------------
-- 5. Questions Table
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    question_number INT NOT NULL,
    subject TEXT DEFAULT 'Physics',
    chapter TEXT,
    question_text TEXT NOT NULL,
    raw_text TEXT,
    answer TEXT,
    question_type question_type_enum DEFAULT 'single_correct' NOT NULL,
    difficulty TEXT DEFAULT 'Medium',
    confidence NUMERIC(5, 2) DEFAULT 95.00,
    confidence_breakdown JSONB DEFAULT '{
        "text": 95,
        "options": 95,
        "images": 90,
        "question_number": 100
    }'::jsonb,
    needs_review BOOLEAN DEFAULT FALSE,
    review_reason TEXT,
    is_reviewed BOOLEAN DEFAULT FALSE,
    source_pages INT[] DEFAULT ARRAY[]::INT[],
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- -------------------------------------------------------------------------
-- 6. Question Options Table
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    label TEXT NOT NULL, -- 'A', 'B', 'C', 'D'
    text TEXT NOT NULL,
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- -------------------------------------------------------------------------
-- 7. Question Images Table
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    option_id UUID REFERENCES public.question_options(id) ON DELETE SET NULL, -- NULL means belongs to question body
    storage_path_original TEXT NOT NULL,
    storage_path_optimized TEXT,
    image_type image_type_enum DEFAULT 'diagram' NOT NULL,
    original_format TEXT DEFAULT 'png',
    optimized_format TEXT DEFAULT 'webp',
    original_dimensions JSONB DEFAULT '{"width": 0, "height": 0}'::jsonb,
    optimized_dimensions JSONB DEFAULT '{"width": 0, "height": 0}'::jsonb,
    original_size_bytes BIGINT DEFAULT 0,
    optimized_size_bytes BIGINT DEFAULT 0,
    compression_percentage NUMERIC(5,2) DEFAULT 0.00,
    is_svg BOOLEAN DEFAULT FALSE,
    svg_content TEXT,
    order_index INT DEFAULT 0 NOT NULL,
    source_page INT,
    bounding_box JSONB, -- { "x": 0, "y": 0, "w": 0, "h": 0 }
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- -------------------------------------------------------------------------
-- 8. Processing Jobs Table
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status job_status_enum DEFAULT 'pending' NOT NULL,
    progress_percentage NUMERIC(5, 2) DEFAULT 0.00,
    current_step TEXT DEFAULT 'Initiating processing',
    total_steps INT DEFAULT 7,
    current_step_index INT DEFAULT 1,
    ai_model_used TEXT,
    total_questions_detected INT DEFAULT 0,
    questions_processed INT DEFAULT 0,
    images_extracted INT DEFAULT 0,
    images_optimized INT DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- -------------------------------------------------------------------------
-- 9. Processing Logs Table
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.processing_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES public.processing_jobs(id) ON DELETE CASCADE,
    level TEXT DEFAULT 'INFO',
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- -------------------------------------------------------------------------
-- 10. Exports Table
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_size_bytes BIGINT DEFAULT 0,
    format TEXT DEFAULT 'XLSX' NOT NULL,
    question_count INT DEFAULT 0,
    images_count INT DEFAULT 0,
    download_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- -------------------------------------------------------------------------
-- 11. AI Model Settings Table (Master Admin Dynamic Config)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_model_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    encrypted_api_key TEXT, -- Encrypted with AES-256-GCM
    api_key_masked TEXT DEFAULT '••••••••••••••••',
    primary_model TEXT DEFAULT 'google/gemini-2.5-flash' NOT NULL,
    vision_model TEXT DEFAULT 'google/gemini-2.5-flash' NOT NULL,
    fallback_model TEXT DEFAULT 'meta-llama/llama-3.3-70b-instruct' NOT NULL,
    temperature NUMERIC(3, 2) DEFAULT 0.10 NOT NULL,
    max_output_tokens INT DEFAULT 8192 NOT NULL,
    retry_attempts INT DEFAULT 2 NOT NULL,
    request_timeout_ms INT DEFAULT 60000 NOT NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- -------------------------------------------------------------------------
-- 12. AI Usage Logs Table (Telemetry & Quota Monitoring)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    model TEXT NOT NULL,
    prompt_tokens INT DEFAULT 0,
    completion_tokens INT DEFAULT 0,
    total_tokens INT DEFAULT 0,
    estimated_cost_usd NUMERIC(10, 6) DEFAULT 0.000000,
    request_type TEXT DEFAULT 'question_extraction',
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    latency_ms INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- -------------------------------------------------------------------------
-- 13. System Settings Table (Branding & Global Controls)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_name TEXT DEFAULT 'QuestionForge AI' NOT NULL,
    support_email TEXT DEFAULT 'support@questionforge.ai' NOT NULL,
    logo_url TEXT,
    favicon_url TEXT,
    branding JSONB DEFAULT '{
        "primary_color": "#2563eb",
        "dark_mode": true,
        "allow_public_signup": true
    }'::jsonb NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- -------------------------------------------------------------------------
-- 14. Audit Logs Table (Admin Security Tracking)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_email TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- -------------------------------------------------------------------------
-- Database Indexes for Extreme Query Performance
-- -------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_questions_project_id ON public.questions(project_id);
CREATE INDEX IF NOT EXISTS idx_questions_number ON public.questions(project_id, question_number);
CREATE INDEX IF NOT EXISTS idx_questions_subject ON public.questions(subject);
CREATE INDEX IF NOT EXISTS idx_questions_needs_review ON public.questions(project_id, needs_review);
CREATE INDEX IF NOT EXISTS idx_question_options_qid ON public.question_options(question_id);
CREATE INDEX IF NOT EXISTS idx_question_images_qid ON public.question_images(question_id);
CREATE INDEX IF NOT EXISTS idx_question_images_optid ON public.question_images(option_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_project_id ON public.processing_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_user_id ON public.processing_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON public.processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_exports_project_id ON public.exports(project_id);
CREATE INDEX IF NOT EXISTS idx_exports_user_id ON public.exports(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON public.ai_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at);

-- -------------------------------------------------------------------------
-- Automatic Profile Trigger on Auth Signup
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    derived_role public.user_role := 'USER';
    raw_role text;
BEGIN
    -- Extract role string safely from raw_user_meta_data if present
    IF NEW.raw_user_meta_data IS NOT NULL THEN
        raw_role := UPPER(TRIM(NEW.raw_user_meta_data->>'role'));
        IF raw_role = 'ADMIN' THEN
            derived_role := 'ADMIN';
        ELSIF raw_role = 'MASTER_ADMIN' THEN
            derived_role := 'MASTER_ADMIN';
        END IF;
    END IF;

    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        avatar_url,
        role,
        status,
        projects_count,
        questions_count,
        storage_used_bytes,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, ''), '@', 1), 'User'),
        NEW.raw_user_meta_data->>'avatar_url',
        derived_role,
        'ACTIVE'::public.user_status,
        0,
        0,
        0,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
        updated_at = NOW();

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user trigger notice for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -------------------------------------------------------------------------
-- Row Level Security (RLS) Policies
-- -------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_model_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('ADMIN', 'MASTER_ADMIN')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'MASTER_ADMIN'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id OR public.is_admin());
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id OR public.is_master_admin());
CREATE POLICY "Master admins have full profile access" ON public.profiles
    FOR ALL USING (public.is_master_admin());

-- Projects Policies
CREATE POLICY "Users can manage own projects" ON public.projects
    FOR ALL USING (auth.uid() = user_id OR public.is_admin());

-- Documents Policies
CREATE POLICY "Users can manage own documents" ON public.documents
    FOR ALL USING (auth.uid() = user_id OR public.is_admin());

-- Document Pages Policies
CREATE POLICY "Users can manage own document pages" ON public.document_pages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.documents d
            WHERE d.id = document_id AND (d.user_id = auth.uid() OR public.is_admin())
        )
    );

-- Questions Policies
CREATE POLICY "Users can manage own questions" ON public.questions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_id AND (p.user_id = auth.uid() OR public.is_admin())
        )
    );

-- Question Options Policies
CREATE POLICY "Users can manage own question options" ON public.question_options
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.questions q
            JOIN public.projects p ON p.id = q.project_id
            WHERE q.id = question_id AND (p.user_id = auth.uid() OR public.is_admin())
        )
    );

-- Question Images Policies
CREATE POLICY "Users can manage own question images" ON public.question_images
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.questions q
            JOIN public.projects p ON p.id = q.project_id
            WHERE q.id = question_id AND (p.user_id = auth.uid() OR public.is_admin())
        )
    );

-- Processing Jobs Policies
CREATE POLICY "Users can view and manage own processing jobs" ON public.processing_jobs
    FOR ALL USING (auth.uid() = user_id OR public.is_admin());

-- Processing Logs Policies
CREATE POLICY "Users can view own processing logs" ON public.processing_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.processing_jobs pj
            WHERE pj.id = job_id AND (pj.user_id = auth.uid() OR public.is_admin())
        )
    );

-- Exports Policies
CREATE POLICY "Users can manage own exports" ON public.exports
    FOR ALL USING (auth.uid() = user_id OR public.is_admin());

-- AI Settings Policies (Master Admin Only)
CREATE POLICY "Master Admins can manage AI settings" ON public.ai_model_settings
    FOR ALL USING (public.is_master_admin());

-- AI Usage Logs Policies
CREATE POLICY "Users can view own usage logs" ON public.ai_usage_logs
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Admin can insert usage logs" ON public.ai_usage_logs
    FOR INSERT WITH CHECK (true);

-- System Settings Policies
CREATE POLICY "Anyone can view system settings" ON public.system_settings
    FOR SELECT USING (true);
CREATE POLICY "Master Admins can update system settings" ON public.system_settings
    FOR ALL USING (public.is_master_admin());

-- Audit Logs Policies
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
    FOR SELECT USING (public.is_admin());
CREATE POLICY "System can insert audit logs" ON public.audit_logs
    FOR INSERT WITH CHECK (true);

-- -------------------------------------------------------------------------
-- Default Initial Seed Configuration
-- -------------------------------------------------------------------------
INSERT INTO public.system_settings (app_name, support_email)
VALUES ('QuestionForge AI', 'support@questionforge.ai')
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_model_settings (
    is_active,
    primary_model,
    vision_model,
    fallback_model,
    temperature,
    max_output_tokens,
    retry_attempts
)
VALUES (
    TRUE,
    'google/gemini-2.5-flash',
    'google/gemini-2.5-flash',
    'meta-llama/llama-3.3-70b-instruct',
    0.10,
    8192,
    2
)
ON CONFLICT DO NOTHING;
