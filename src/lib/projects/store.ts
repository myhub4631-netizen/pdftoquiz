import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

export interface ProjectRecord {
  id: string;
  user_id: string;
  name: string;
  exam_type: string;
  year: number;
  subject_focus?: string | null;
  description?: string | null;
  status: string;
  expected_questions: number;
  total_questions?: number;
  total_pages?: number;
  extracted_questions?: number;
  needs_review_count?: number;
  image_settings?: any;
  created_at: string;
  updated_at: string;
}

export interface DocumentRecord {
  id: string;
  project_id: string;
  user_id: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  storage_path: string;
  page_count: number;
  extracted_text_size?: number;
  created_at: string;
}

export interface QuestionOptionRecord {
  id: string;
  question_id: string;
  label: string;
  text: string;
  order_index: number;
}

export interface QuestionImageRecord {
  id: string;
  question_id: string;
  option_id: string | null;
  storage_path_original: string;
  storage_path_optimized: string | null;
  image_type: string;
  original_format: string;
  optimized_format: string;
  original_dimensions?: any;
  optimized_dimensions?: any;
  original_size_bytes?: number;
  optimized_size_bytes?: number;
  compression_percentage?: number;
  is_svg?: boolean;
  svg_content?: string | null;
  order_index: number;
  source_page?: number | null;
}

export interface QuestionRecord {
  id: string;
  project_id: string;
  question_number: number;
  subject: string;
  chapter: string | null;
  question_text: string;
  raw_text?: string | null;
  answer: string | null;
  question_type: string;
  difficulty: string;
  confidence: number;
  confidence_breakdown?: any;
  needs_review: boolean;
  review_reason: string | null;
  is_reviewed: boolean;
  source_pages: number[];
  options?: QuestionOptionRecord[];
  images?: QuestionImageRecord[];
  created_at: string;
  updated_at: string;
}

// In-Memory Global Store to ensure persistence across serverless invocations within node process
const globalProjectsStore = new Map<string, ProjectRecord>();
const globalDocumentsStore = new Map<string, DocumentRecord>();
const globalQuestionsStore = new Map<string, Map<string, QuestionRecord>>(); // projectId -> Map<questionId, QuestionRecord>

export class ProjectStore {
  /**
   * Saves a project record to Supabase database and local store.
   */
  static async saveProject(project: ProjectRecord): Promise<ProjectRecord> {
    const supabase = createAdminClient();

    // 1. Always save in memory store for instant retrieval
    globalProjectsStore.set(project.id, project);

    // 2. Persist to Supabase database
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          id: project.id,
          user_id: project.user_id,
          name: project.name,
          exam_type: project.exam_type as any,
          year: project.year,
          subject_focus: project.subject_focus || null,
          description: project.description || null,
          status: project.status as any,
          expected_questions: project.expected_questions,
          image_settings: project.image_settings || {},
          created_at: project.created_at,
          updated_at: project.updated_at,
        })
        .select()
        .single();

      if (data && !error) {
        globalProjectsStore.set(data.id, data as any);
        return data as any;
      }
    } catch (dbErr) {
      console.warn('[ProjectStore] Supabase DB insert notice:', dbErr);
    }

    return project;
  }

  /**
   * Retrieves a project by ID from Supabase or local store.
   */
  static async getProject(id: string): Promise<ProjectRecord | null> {
    const supabase = createAdminClient();

    // 1. Try fetching from Supabase database first
    try {
      const { data: project } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (project) {
        globalProjectsStore.set(project.id, project as any);
        return project as any;
      }
    } catch {
      // Fall through to memory store
    }

    // 2. Check local store
    if (globalProjectsStore.has(id)) {
      return globalProjectsStore.get(id)!;
    }

    return null;
  }

  /**
   * Updates project fields in Supabase database and local store.
   */
  static async updateProject(id: string, updates: Partial<ProjectRecord>): Promise<ProjectRecord | null> {
    const existing = await this.getProject(id);
    if (!existing) return null;

    const updated: ProjectRecord = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    globalProjectsStore.set(id, updated);

    const supabase = createAdminClient();
    try {
      await supabase.from('projects').update(updates as any).eq('id', id);
    } catch {
      // Continue with local store update
    }

    return updated;
  }

  /**
   * Saves a document record for a project.
   */
  static async saveDocument(doc: DocumentRecord): Promise<DocumentRecord> {
    globalDocumentsStore.set(doc.project_id, doc);

    const supabase = createAdminClient();
    try {
      const { data } = await supabase.from('documents').upsert(doc as any).select().single();
      if (data) {
        globalDocumentsStore.set(doc.project_id, data as any);
        return data as any;
      }
    } catch {
      // Continue with local store
    }

    return doc;
  }

  /**
   * Gets a document record for a project.
   */
  static async getDocument(projectId: string): Promise<DocumentRecord | null> {
    const supabase = createAdminClient();

    try {
      const { data: doc } = await supabase
        .from('documents')
        .select('*')
        .eq('project_id', projectId)
        .limit(1)
        .maybeSingle();

      if (doc) {
        globalDocumentsStore.set(projectId, doc as any);
        return doc as any;
      }
    } catch {
      // Fall through
    }

    if (globalDocumentsStore.has(projectId)) {
      return globalDocumentsStore.get(projectId)!;
    }

    return null;
  }

  /**
   * Lists all projects from Supabase and local store.
   */
  static async listProjects(): Promise<ProjectRecord[]> {
    const supabase = createAdminClient();
    const map = new Map<string, ProjectRecord>();

    // Add local memory projects
    for (const [id, p] of globalProjectsStore.entries()) {
      map.set(id, p);
    }

    // Add Supabase DB projects
    try {
      const { data: dbProjects } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbProjects) {
        for (const p of dbProjects) {
          map.set(p.id, p as any);
        }
      }
    } catch {
      // Continue with memory list
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  /**
   * Saves a question record along with its options and images.
   */
  static async saveQuestion(question: QuestionRecord): Promise<QuestionRecord> {
    // 1. Save in memory store
    if (!globalQuestionsStore.has(question.project_id)) {
      globalQuestionsStore.set(question.project_id, new Map());
    }
    const projectQs = globalQuestionsStore.get(question.project_id)!;
    projectQs.set(question.id, question);

    // 2. Persist to Supabase
    const supabase = createAdminClient();
    try {
      const { data: savedQ } = await supabase
        .from('questions')
        .upsert(
          {
            id: question.id,
            project_id: question.project_id,
            question_number: question.question_number,
            subject: question.subject,
            chapter: question.chapter || null,
            question_text: question.question_text,
            raw_text: question.raw_text || null,
            answer: question.answer || null,
            question_type: question.question_type as any,
            difficulty: question.difficulty as any,
            confidence: question.confidence,
            confidence_breakdown: question.confidence_breakdown || {},
            needs_review: question.needs_review,
            review_reason: question.review_reason || null,
            is_reviewed: question.is_reviewed,
            source_pages: question.source_pages,
            created_at: question.created_at,
            updated_at: question.updated_at,
          },
          { onConflict: 'project_id,question_number' }
        )
        .select()
        .single();

      if (savedQ) {
        // Save options
        if (question.options && question.options.length > 0) {
          for (const opt of question.options) {
            try {
              await supabase.from('question_options').upsert({
                id: opt.id,
                question_id: savedQ.id,
                label: opt.label,
                text: opt.text,
                order_index: opt.order_index,
              });
            } catch {
              // Continue
            }
          }
        }

        // Save images
        if (question.images && question.images.length > 0) {
          for (const img of question.images) {
            try {
              await supabase.from('question_images').upsert({
                id: img.id,
                question_id: savedQ.id,
                option_id: img.option_id || null,
                storage_path_original: img.storage_path_original,
                storage_path_optimized: img.storage_path_optimized || null,
                image_type: img.image_type as any,
                original_format: img.original_format,
                optimized_format: img.optimized_format,
                order_index: img.order_index,
                source_page: img.source_page || null,
              });
            } catch {
              // Continue
            }
          }
        }
      }
    } catch (dbErr) {
      console.warn('[ProjectStore] Supabase question save notice:', dbErr);
    }

    return question;
  }

  /**
   * Retrieves all questions for a project, merged from Supabase DB and local memory store.
   */
  static async getQuestions(projectId: string): Promise<QuestionRecord[]> {
    const qMap = new Map<string, QuestionRecord>();

    // 1. Get from memory store
    if (globalQuestionsStore.has(projectId)) {
      const memoryQs = globalQuestionsStore.get(projectId)!;
      for (const [_, q] of memoryQs.entries()) {
        qMap.set(q.id, q);
      }
    }

    // 2. Fetch from Supabase DB
    const supabase = createAdminClient();
    try {
      const { data: dbQuestions } = await supabase
        .from('questions')
        .select('*, options:question_options(*), images:question_images(*)')
        .eq('project_id', projectId)
        .order('question_number', { ascending: true });

      if (dbQuestions && dbQuestions.length > 0) {
        for (const dbQ of dbQuestions) {
          const formatted: QuestionRecord = {
            id: dbQ.id,
            project_id: dbQ.project_id,
            question_number: dbQ.question_number,
            subject: dbQ.subject || 'General',
            chapter: dbQ.chapter || null,
            question_text: dbQ.question_text || '',
            raw_text: dbQ.raw_text || null,
            answer: dbQ.answer || null,
            question_type: dbQ.question_type || 'single_correct',
            difficulty: dbQ.difficulty || 'Medium',
            confidence: dbQ.confidence || 90,
            confidence_breakdown: dbQ.confidence_breakdown || {},
            needs_review: Boolean(dbQ.needs_review),
            review_reason: dbQ.review_reason || null,
            is_reviewed: Boolean(dbQ.is_reviewed),
            source_pages: dbQ.source_pages || [],
            options: (dbQ.options || []).map((opt: any) => ({
              id: opt.id,
              question_id: opt.question_id,
              label: opt.label || opt.option_label || 'A',
              text: opt.text || opt.option_text || '',
              order_index: opt.order_index || 0,
            })),
            images: dbQ.images || [],
            created_at: dbQ.created_at || new Date().toISOString(),
            updated_at: dbQ.updated_at || new Date().toISOString(),
          };
          qMap.set(dbQ.id, formatted);
        }
      }
    } catch (dbErr) {
      console.warn('[ProjectStore] Supabase getQuestions notice:', dbErr);
    }

    const result = Array.from(qMap.values()).sort((a, b) => a.question_number - b.question_number);
    return result;
  }

  /**
   * Deletes questions associated with a specific page before reprocessing.
   */
  static async deletePageQuestions(projectId: string, pageNumber: number): Promise<void> {
    if (globalQuestionsStore.has(projectId)) {
      const memoryQs = globalQuestionsStore.get(projectId)!;
      for (const [id, q] of memoryQs.entries()) {
        if (q.source_pages && q.source_pages.includes(pageNumber)) {
          memoryQs.delete(id);
        }
      }
    }

    const supabase = createAdminClient();
    try {
      const { data: oldQs } = await supabase
        .from('questions')
        .select('id')
        .eq('project_id', projectId)
        .contains('source_pages', [pageNumber]);

      if (oldQs && oldQs.length > 0) {
        const oldIds = oldQs.map((q) => q.id);
        await supabase.from('questions').delete().in('id', oldIds);
      }
    } catch {
      // Continue
    }
  }

  /**
   * Updates an existing question in memory and database.
   */
  static async updateQuestion(
    projectId: string,
    questionId: string,
    updates: Partial<QuestionRecord>
  ): Promise<QuestionRecord | null> {
    const questions = await this.getQuestions(projectId);
    const existing = questions.find((q) => q.id === questionId);
    if (!existing) return null;

    const updated: QuestionRecord = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (globalQuestionsStore.has(projectId)) {
      globalQuestionsStore.get(projectId)!.set(questionId, updated);
    }

    const supabase = createAdminClient();
    try {
      await supabase
        .from('questions')
        .update({
          question_number: updated.question_number,
          subject: updated.subject,
          chapter: updated.chapter || null,
          question_text: updated.question_text,
          answer: updated.answer || null,
          question_type: updated.question_type as any,
          difficulty: updated.difficulty as any,
          needs_review: updated.needs_review,
          is_reviewed: updated.is_reviewed,
          review_reason: updated.review_reason || null,
          updated_at: updated.updated_at,
        })
        .eq('id', questionId);
    } catch {
      // Continue with memory store update
    }

    return updated;
  }
}

