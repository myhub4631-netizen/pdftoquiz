import { QuestionType } from '@/types/database';

export interface ExtractedOptionResult {
  label: string;
  text: string;
  image_references?: string[];
}

export interface ExtractedQuestionResult {
  question_number: number;
  subject: string;
  chapter: string | null;
  question_text: string;
  options: ExtractedOptionResult[];
  answer: string | null;
  question_type: QuestionType;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  confidence: number;
  confidence_breakdown?: {
    text: number;
    options: number;
    images: number;
    question_number: number;
  };
  needs_review: boolean;
  review_reason: string | null;
  source_pages: number[];
  image_references?: string[];
}

export interface AIProviderConnectionTestResult {
  success: boolean;
  message: string;
  model: string;
  latency_ms: number;
  details?: Record<string, any>;
}

export interface AIProvider {
  testConnection(customApiKey?: string, customModel?: string): Promise<AIProviderConnectionTestResult>;
  extractQuestionsFromChunk(
    textChunk: string,
    pageNumber: number,
    examType: string,
    imageHints?: string[]
  ): Promise<ExtractedQuestionResult[]>;
  analyzeQuestionImage(
    imageBase64: string,
    contextText?: string
  ): Promise<{
    image_type: 'diagram' | 'formula' | 'chemical_structure' | 'graph' | 'table' | 'option_diagram' | 'other';
    suggested_association: 'question' | 'A' | 'B' | 'C' | 'D';
    description: string;
    is_suitable_for_svg: boolean;
  }>;
}
