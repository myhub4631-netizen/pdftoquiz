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

import fs from 'fs';
import path from 'path';

// In-Memory Global Store to ensure persistence across serverless invocations within node process
const globalProjectsStore = new Map<string, ProjectRecord>();
const globalDocumentsStore = new Map<string, DocumentRecord>();
const globalQuestionsStore = new Map<string, Map<string, QuestionRecord>>(); // projectId -> Map<questionId, QuestionRecord>
const globalPdfStore = new Map<string, Buffer>();

export class ProjectStore {
  /**
   * Saves raw PDF buffer to memory and disk cache.
   */
  static savePdfBuffer(projectId: string, buffer: Buffer): void {
    globalPdfStore.set(projectId, buffer);
    try {
      const tmpPath = path.join('/tmp', `pdf_${projectId}.pdf`);
      fs.writeFileSync(tmpPath, buffer);
    } catch {
      // Continue
    }
  }

  /**
   * Appends a chunk to the PDF buffer for chunked upload.
   */
  static appendPdfChunk(projectId: string, chunkBuffer: Buffer): void {
    const existing = this.getPdfBuffer(projectId) || Buffer.alloc(0);
    const combined = Buffer.concat([existing, chunkBuffer]);
    this.savePdfBuffer(projectId, combined);
  }

  /**
   * Retrieves raw PDF buffer from memory or disk cache.
   */
  static getPdfBuffer(projectId: string): Buffer | null {
    if (globalPdfStore.has(projectId)) {
      return globalPdfStore.get(projectId)!;
    }
    try {
      const tmpPath = path.join('/tmp', `pdf_${projectId}.pdf`);
      if (fs.existsSync(tmpPath)) {
        const buf = fs.readFileSync(tmpPath);
        globalPdfStore.set(projectId, buf);
        return buf;
      }
    } catch {
      // Fall through
    }
    return null;
  }

  /**
   * Persists project store state to disk cache.
   */
  private static flushDiskCache(projectId: string): void {
    try {
      const data = {
        project: globalProjectsStore.get(projectId) || null,
        document: globalDocumentsStore.get(projectId) || null,
        questions: Array.from(globalQuestionsStore.get(projectId)?.values() || []),
      };
      const tmpPath = path.join('/tmp', `store_${projectId}.json`);
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
    } catch {
      // Continue
    }
  }

  /**
   * Reads project store state from disk cache.
   */
  private static loadDiskCache(projectId: string): void {
    try {
      const tmpPath = path.join('/tmp', `store_${projectId}.json`);
      if (fs.existsSync(tmpPath)) {
        const text = fs.readFileSync(tmpPath, 'utf-8');
        const parsed = JSON.parse(text);

        if (parsed.project) {
          globalProjectsStore.set(projectId, parsed.project);
        }
        if (parsed.document) {
          globalDocumentsStore.set(projectId, parsed.document);
        }
        if (Array.isArray(parsed.questions)) {
          if (!globalQuestionsStore.has(projectId)) {
            globalQuestionsStore.set(projectId, new Map());
          }
          const qMap = globalQuestionsStore.get(projectId)!;
          for (const q of parsed.questions) {
            qMap.set(q.id, q);
          }
        }
      }
    } catch {
      // Continue
    }
  }
  /**
   * Saves a project record to Supabase database and local store.
   */
  static async saveProject(project: ProjectRecord, customClient?: any): Promise<ProjectRecord> {
    const supabase = customClient || createAdminClient();

    // Persist to Supabase database
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

    if (error) {
      console.error('[ProjectStore] Supabase DB insert error:', error.message, error.code, error.details, error.hint);
      const extra = [error.details, error.hint].filter(Boolean).join(' - ');
      throw new Error(`Database project creation failed: ${error.message}${extra ? ` (${extra})` : ''}`);
    }

    if (data) {
      globalProjectsStore.set(data.id, data as any);
      this.flushDiskCache(data.id);
      return data as any;
    }

    return project;
  }

  /**
   * Retrieves a project by ID from Supabase projects table (authoritative source of truth).
   */
  static async getProject(id: string, customClient?: any): Promise<ProjectRecord | null> {
    const supabase = customClient || createAdminClient();

    // 1. Fetch from Supabase projects table (Authoritative Source of Truth)
    try {
      const { data: project, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (project && !error) {
        globalProjectsStore.set(project.id, project as any);
        this.flushDiskCache(project.id);
        return project as any;
      }
    } catch {
      // Database query failed or unauthenticated
    }

    // 2. Check local memory store for previously verified database record in current process
    if (globalProjectsStore.has(id)) {
      return globalProjectsStore.get(id)!;
    }

    // Explicitly return null if project does not exist in authoritative database
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
    this.flushDiskCache(id);

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
  static async saveDocument(doc: DocumentRecord, customClient?: any): Promise<DocumentRecord> {
    globalDocumentsStore.set(doc.project_id, doc);
    this.flushDiskCache(doc.project_id);

    const supabase = customClient || createAdminClient();
    try {
      const { data } = await supabase.from('documents').upsert(doc as any).select().single();
      if (data) {
        globalDocumentsStore.set(doc.project_id, data as any);
        this.flushDiskCache(doc.project_id);
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
    this.loadDiskCache(projectId);
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
        this.flushDiskCache(projectId);
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
    // 1. Save in memory store & disk cache
    if (!globalQuestionsStore.has(question.project_id)) {
      globalQuestionsStore.set(question.project_id, new Map());
    }
    const projectQs = globalQuestionsStore.get(question.project_id)!;

    // Check if question with same question_number already exists for this project
    let existingKey: string | null = null;
    for (const [id, existingQ] of projectQs.entries()) {
      if (existingQ.question_number === question.question_number) {
        existingKey = id;
        break;
      }
    }

    let targetQuestion = question;

    if (existingKey) {
      const existing = projectQs.get(existingKey)!;
      const combinedPages = Array.from(new Set([...(existing.source_pages || []), ...(question.source_pages || [])])).sort((a, b) => a - b);

      const optMap = new Map<string, QuestionOptionRecord>();
      (existing.options || []).forEach((o) => optMap.set(o.label.toUpperCase(), o));
      (question.options || []).forEach((o) => {
        const lbl = o.label.toUpperCase();
        if (!optMap.has(lbl) || (o.text && o.text.length > (optMap.get(lbl)?.text?.length || 0))) {
          optMap.set(lbl, o);
        }
      });

      const imgMap = new Map<string, QuestionImageRecord>();
      (existing.images || []).forEach((i) => imgMap.set(i.id, i));
      (question.images || []).forEach((i) => imgMap.set(i.id, i));

      const bestText = question.question_text.length >= existing.question_text.length ? question.question_text : existing.question_text;

      targetQuestion = {
        ...existing,
        ...question,
        id: existing.id,
        question_text: bestText,
        source_pages: combinedPages,
        options: Array.from(optMap.values()).sort((a, b) => a.order_index - b.order_index),
        images: Array.from(imgMap.values()),
        updated_at: new Date().toISOString(),
      };

      projectQs.set(existing.id, targetQuestion);
    } else {
      projectQs.set(question.id, question);
    }

    this.flushDiskCache(question.project_id);

    // 2. Persist to Supabase
    const supabase = createAdminClient();
    try {
      const { data: savedQ } = await supabase
        .from('questions')
        .upsert(
          {
            id: targetQuestion.id,
            project_id: targetQuestion.project_id,
            question_number: targetQuestion.question_number,
            subject: targetQuestion.subject,
            chapter: targetQuestion.chapter || null,
            question_text: targetQuestion.question_text,
            raw_text: targetQuestion.raw_text || null,
            answer: targetQuestion.answer || null,
            question_type: targetQuestion.question_type as any,
            difficulty: targetQuestion.difficulty as any,
            confidence: targetQuestion.confidence,
            confidence_breakdown: targetQuestion.confidence_breakdown || {},
            needs_review: targetQuestion.needs_review,
            review_reason: targetQuestion.review_reason || null,
            is_reviewed: targetQuestion.is_reviewed,
            source_pages: targetQuestion.source_pages,
            created_at: targetQuestion.created_at,
            updated_at: targetQuestion.updated_at,
          },
          { onConflict: 'project_id,question_number' }
        )
        .select()
        .single();

      if (savedQ) {
        if (targetQuestion.options && targetQuestion.options.length > 0) {
          for (const opt of targetQuestion.options) {
            try {
              await supabase.from('question_options').upsert({
                id: opt.id,
                question_id: savedQ.id,
                label: opt.label,
                text: opt.text,
                order_index: opt.order_index,
              });
            } catch {}
          }
        }

        if (targetQuestion.images && targetQuestion.images.length > 0) {
          for (const img of targetQuestion.images) {
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
            } catch {}
          }
        }
      }
    } catch (dbErr) {
      console.warn('[ProjectStore] Supabase question save notice:', dbErr);
    }

    return targetQuestion;
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

