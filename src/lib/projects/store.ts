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

// In-Memory Global Store to ensure persistence across serverless invocations within node process
const globalProjectsStore = new Map<string, ProjectRecord>();
const globalDocumentsStore = new Map<string, DocumentRecord>();

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
}
