export type UserRole = 'USER' | 'ADMIN' | 'MASTER_ADMIN';
export type UserStatus = 'ACTIVE' | 'BLOCKED' | 'PENDING';
export type ExamType = 'NEET' | 'JEE_MAIN' | 'JEE_ADVANCED' | 'OTHER';
export type ProjectStatus =
  | 'UPLOADING'
  | 'UPLOADED'
  | 'ANALYSING'
  | 'EXTRACTING'
  | 'PROCESSING_IMAGES'
  | 'AI_PROCESSING'
  | 'VALIDATION'
  | 'NEEDS_REVIEW'
  | 'COMPLETED'
  | 'FAILED';

export type QuestionType =
  | 'single_correct'
  | 'multiple_correct'
  | 'assertion_reason'
  | 'numerical'
  | 'match_the_following'
  | 'true_false'
  | 'passage'
  | 'image_based'
  | 'other';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ImageType = 'diagram' | 'formula' | 'chemical_structure' | 'graph' | 'table' | 'option_diagram' | 'other';
export type CompressionLevel = 'Original' | 'Low' | 'Medium' | 'High' | 'Maximum';

export interface ImageProcessingSettings {
  extract_images: boolean;
  compress_images: boolean;
  compression_level: CompressionLevel;
  convert_to_svg: boolean;
  keep_original_images: boolean;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  projects_count: number;
  questions_count: number;
  storage_used_bytes: number;
  last_active_at: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  exam_type: ExamType;
  year: number;
  subject_focus: string | null;
  description: string | null;
  status: ProjectStatus;
  total_questions: number;
  total_pages: number;
  expected_questions: number;
  extracted_questions: number;
  needs_review_count: number;
  image_settings: ImageProcessingSettings;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  project_id: string;
  user_id: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  storage_path: string;
  page_count: number;
  extracted_text_size: number;
  created_at: string;
}

export interface DocumentPage {
  id: string;
  document_id: string;
  page_number: number;
  text_content: string | null;
  page_image_path: string | null;
  ocr_applied: boolean;
  width: number | null;
  height: number | null;
  created_at: string;
}

export interface QuestionOption {
  id: string;
  question_id: string;
  label: string; // 'A', 'B', 'C', 'D'
  text: string;
  order_index: number;
  images?: QuestionImage[];
  created_at: string;
}

export interface QuestionImage {
  id: string;
  question_id: string;
  option_id: string | null;
  storage_path_original: string;
  storage_path_optimized: string | null;
  image_type: ImageType;
  original_format: string;
  optimized_format: string;
  original_dimensions: { width: number; height: number };
  optimized_dimensions: { width: number; height: number };
  original_size_bytes: number;
  optimized_size_bytes: number;
  compression_percentage: number;
  is_svg: boolean;
  svg_content: string | null;
  order_index: number;
  source_page: number | null;
  bounding_box: { x: number; y: number; w: number; h: number } | null;
  created_at: string;
}

export interface Question {
  id: string;
  project_id: string;
  question_number: number;
  subject: string;
  chapter: string | null;
  question_text: string;
  raw_text: string | null;
  answer: string | null;
  question_type: QuestionType;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  confidence: number;
  confidence_breakdown: {
    text: number;
    options: number;
    images: number;
    question_number: number;
  };
  needs_review: boolean;
  review_reason: string | null;
  is_reviewed: boolean;
  source_pages: number[];
  options?: QuestionOption[];
  images?: QuestionImage[];
  created_at: string;
  updated_at: string;
}

export interface ProcessingJob {
  id: string;
  project_id: string;
  user_id: string;
  status: JobStatus;
  progress_percentage: number;
  current_step: string;
  total_steps: number;
  current_step_index: number;
  ai_model_used: string | null;
  total_questions_detected: number;
  questions_processed: number;
  images_extracted: number;
  images_optimized: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface ProcessingLog {
  id: string;
  job_id: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface ExportRecord {
  id: string;
  project_id: string;
  user_id: string;
  file_name: string;
  storage_path: string;
  file_size_bytes: number;
  format: string;
  question_count: number;
  images_count: number;
  download_count: number;
  created_at: string;
}

export interface AIModelSettings {
  id: string;
  is_active: boolean;
  encrypted_api_key?: string | null;
  api_key_masked: string;
  primary_model: string;
  vision_model: string;
  fallback_model: string;
  temperature: number;
  max_output_tokens: number;
  retry_attempts: number;
  request_timeout_ms: number;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIUsageLog {
  id: string;
  user_id?: string | null;
  project_id?: string | null;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  request_type: string;
  success: boolean;
  error_message?: string | null;
  latency_ms: number;
  created_at: string;
}

export interface SystemSettings {
  id: string;
  app_name: string;
  support_email: string;
  logo_url?: string | null;
  favicon_url?: string | null;
  branding: {
    primary_color: string;
    dark_mode: boolean;
    allow_public_signup: boolean;
  };
  updated_at: string;
}

export interface AuditLog {
  id: string;
  actor_id?: string | null;
  actor_email: string;
  action: string;
  target_type: string;
  target_id?: string | null;
  details: Record<string, any>;
  ip_address?: string | null;
  created_at: string;
}
