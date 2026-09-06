import { getActiveAIConfig, ActiveAIConfig } from './config';
import { AIProvider, AIProviderConnectionTestResult, ExtractedQuestionResult } from './provider';
import { createAdminClient } from '@/lib/supabase/admin';

export class OpenRouterProvider implements AIProvider {
  private customConfig?: Partial<ActiveAIConfig>;

  constructor(customConfig?: Partial<ActiveAIConfig>) {
    this.customConfig = customConfig;
  }

  private async getConfig(): Promise<ActiveAIConfig> {
    const active = await getActiveAIConfig();
    return {
      ...active,
      ...this.customConfig,
    };
  }

  /**
   * Tests connection to OpenRouter with the given or active credentials.
   */
  async testConnection(customApiKey?: string, customModel?: string): Promise<AIProviderConnectionTestResult> {
    const config = await this.getConfig();
    const apiKey = customApiKey || config.apiKey;
    const model = customModel || config.primaryModel;

    if (!apiKey) {
      return {
        success: false,
        message: 'No OpenRouter API key provided or configured.',
        model,
        latency_ms: 0,
      };
    }

    const start = Date.now();
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://questionforge.ai',
          'X-Title': 'QuestionForge AI Connection Test',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: 'You are a test assistant. Respond strictly with JSON: {"status": "ok"}',
            },
            {
              role: 'user',
              content: 'Ping test',
            },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 50,
          temperature: 0,
        }),
      });

      const latency = Date.now() - start;

      if (!response.ok) {
        let errDetail = `HTTP ${response.status} ${response.statusText}`;
        try {
          const errJson = await response.json();
          if (errJson?.error?.message) {
            errDetail = errJson.error.message;
          }
        } catch {
          // ignore parsing error
        }

        return {
          success: false,
          message: `OpenRouter error: ${errDetail}`,
          model,
          latency_ms: latency,
        };
      }

      const resData = await response.json();
      return {
        success: true,
        message: 'OpenRouter connection successful. Model is active and responsive.',
        model: resData.model || model,
        latency_ms: latency,
        details: {
          usage: resData.usage,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Network error connecting to OpenRouter.',
        model,
        latency_ms: Date.now() - start,
      };
    }
  }

  /**
   * Internal helper to make OpenRouter API requests with retry & fallback model.
   */
  private async executeWithFallback(
    messages: Array<{ role: string; content: any }>,
    options: {
      useVision?: boolean;
      responseFormatJson?: boolean;
      projectId?: string;
      userId?: string;
      requestType?: string;
    } = {}
  ): Promise<{ content: string; modelUsed: string; usage: any }> {
    const config = await this.getConfig();
    const primaryModel = options.useVision ? config.visionModel : config.primaryModel;
    const fallbackModel = config.fallbackModel;
    const modelsToTry = [primaryModel, fallbackModel].filter(Boolean);
    const retryCount = config.retryAttempts || 2;

    let lastError: any = null;

    for (const model of modelsToTry) {
      for (let attempt = 0; attempt <= retryCount; attempt++) {
        const start = Date.now();
        try {
          const payload: any = {
            model: model,
            messages: messages,
            temperature: config.temperature,
            max_tokens: config.maxOutputTokens,
          };

          if (options.responseFormatJson) {
            payload.response_format = { type: 'json_object' };
          }

          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${config.apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://questionforge.ai',
              'X-Title': 'QuestionForge AI Engine',
            },
            body: JSON.stringify(payload),
          });

          const latency = Date.now() - start;

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`OpenRouter HTTP ${response.status}: ${errText}`);
          }

          const data = await response.json();
          const replyContent = data.choices?.[0]?.message?.content || '';

          // Record telemetry asynchronously
          this.logUsageTelemetry({
            userId: options.userId,
            projectId: options.projectId,
            model: model,
            promptTokens: data.usage?.prompt_tokens || 0,
            completionTokens: data.usage?.completion_tokens || 0,
            totalTokens: data.usage?.total_tokens || 0,
            requestType: options.requestType || 'extraction',
            success: true,
            latencyMs: latency,
          }).catch(console.error);

          return {
            content: replyContent,
            modelUsed: model,
            usage: data.usage,
          };
        } catch (err: any) {
          lastError = err;
          console.warn(`Attempt ${attempt + 1} failed for model ${model}:`, err?.message);
          if (attempt < retryCount) {
            // Exponential backoff
            await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
          }
        }
      }
    }

    throw new Error(`All AI models failed after retries. Last error: ${lastError?.message || 'Unknown'}`);
  }

  /**
   * Records usage metrics to ai_usage_logs for Master Admin tracking without exposing prompts.
   */
  private async logUsageTelemetry(params: {
    userId?: string;
    projectId?: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    requestType: string;
    success: boolean;
    error_message?: string;
    latencyMs: number;
  }) {
    try {
      const supabase = createAdminClient();
      await supabase.from('ai_usage_logs').insert({
        user_id: params.userId || null,
        project_id: params.projectId || null,
        model: params.model,
        prompt_tokens: params.promptTokens,
        completion_tokens: params.completionTokens,
        total_tokens: params.totalTokens,
        request_type: params.requestType,
        success: params.success,
        error_message: params.error_message || null,
        latency_ms: params.latencyMs,
      });
    } catch {
      // Ignore logging failure to avoid breaking pipeline
    }
  }

  /**
   * Extracts and structures NEET/JEE questions from raw text chunk.
   */
  async extractQuestionsFromChunk(
    textChunk: string,
    pageNumber: number,
    examType: string = 'NEET',
    imageHints: string[] = []
  ): Promise<ExtractedQuestionResult[]> {
    const systemPrompt = `You are QuestionForge AI, a specialized parser for Indian competitive exams (${examType}: Physics, Chemistry, Biology, Mathematics).
Your job is to convert raw extracted PDF question-paper text into structured JSON.

CRITICAL EXTRACTION RULES:
1. A SINGLE PDF PAGE ALMOST ALWAYS CONTAINS MULTIPLE QUESTIONS (e.g., 5, 8, 12, or 15 questions per page). YOU MUST EXTRACT EVERY SINGLE QUESTION PRESENT ON THIS PAGE! DO NOT STOP AFTER THE FIRST QUESTION!
2. PRESERVE ACTUAL QUESTION NUMBERS as printed in the PDF (e.g. if the page has Question 45, Question 46, Question 47, set "question_number": 45, 46, 47). DO NOT RESET QUESTION NUMBERS TO 1 ON EVERY PAGE!
3. NEVER hallucinate or invent question text, options, answers, formulas, or numbers.
4. Preserve exact mathematical equations, subscripts (e.g. H2O, v1), superscripts (e.g. m/s^2, 10^5), Greek symbols (alpha, beta, theta, lambda), fractions, and units.
5. Identify question type accurately: "single_correct", "multiple_correct", "assertion_reason", "numerical", "match_the_following", "true_false", "passage", "image_based", or "other".
6. Determine Subject (Physics, Chemistry, Biology, Mathematics) and Chapter if evident.
7. Structure options (A)/(B)/(C)/(D) or 1/2/3/4 into the "options" array.
8. If a question is ambiguous, partially cut off, or missing options, set "needs_review": true and explain in "review_reason".
9. Score confidence (0 to 100) based on extraction clarity.

Return JSON in this exact structure:
{
  "questions": [
    {
      "question_number": 45,
      "subject": "Physics",
      "chapter": "Kinematics",
      "question_text": "First question on page statement...",
      "options": [
        { "label": "A", "text": "10 m/s" },
        { "label": "B", "text": "20 m/s" },
        { "label": "C", "text": "30 m/s" },
        { "label": "D", "text": "40 m/s" }
      ],
      "answer": null,
      "question_type": "single_correct",
      "difficulty": "Medium",
      "confidence": 96,
      "confidence_breakdown": { "text": 98, "options": 95, "images": 90, "question_number": 100 },
      "needs_review": false,
      "review_reason": null,
      "source_pages": [${pageNumber}]
    },
    {
      "question_number": 46,
      "subject": "Physics",
      "chapter": "Work, Energy & Power",
      "question_text": "Second question on page statement...",
      "options": [
        { "label": "A", "text": "100 J" },
        { "label": "B", "text": "200 J" },
        { "label": "C", "text": "300 J" },
        { "label": "D", "text": "400 J" }
      ],
      "answer": null,
      "question_type": "single_correct",
      "difficulty": "Easy",
      "confidence": 98,
      "confidence_breakdown": { "text": 99, "options": 98, "images": 95, "question_number": 100 },
      "needs_review": false,
      "review_reason": null,
      "source_pages": [${pageNumber}]
    }
  ]
}`;

    const userPrompt = `Exam Type: ${examType}
Source Page: ${pageNumber}
Available Image IDs detected on page: ${JSON.stringify(imageHints)}

RAW TEXT CONTENT TO PARSE:
-------------------------
${textChunk}
-------------------------

Parse and extract every question from this text into the JSON format.`;

    const result = await this.executeWithFallback(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { responseFormatJson: true, requestType: 'question_extraction' }
    );

    try {
      const parsed = JSON.parse(result.content);
      if (Array.isArray(parsed.questions)) {
        return parsed.questions.map((q: any) => ({
          ...q,
          confidence: Number(q.confidence) || 85,
          source_pages: q.source_pages || [pageNumber],
          options: Array.isArray(q.options) ? q.options : [],
          needs_review: Boolean(q.needs_review),
        }));
      }
      return [];
    } catch (parseErr) {
      console.error('Failed to parse AI JSON response:', parseErr, result.content);
      return [];
    }
  }

  /**
   * Analyzes an extracted image and determines its association (question body vs option A/B/C/D).
   */
  async analyzeQuestionImage(
    imageBase64: string,
    contextText: string = ''
  ): Promise<{
    image_type: 'diagram' | 'formula' | 'chemical_structure' | 'graph' | 'table' | 'option_diagram' | 'other';
    suggested_association: 'question' | 'A' | 'B' | 'C' | 'D';
    description: string;
    is_suitable_for_svg: boolean;
  }> {
    const systemPrompt = `You are a scientific image classifier for NEET/JEE exam papers.
Analyze this diagram/image in relation to the surrounding question text.
Determine:
1. "image_type": one of ("diagram", "formula", "chemical_structure", "graph", "table", "option_diagram", "other")
2. "suggested_association": "question" (if it is the main question diagram) or "A", "B", "C", "D" (if it belongs to an individual option)
3. "description": short 1-sentence summary of what the diagram shows
4. "is_suitable_for_svg": true if it is clean black-and-white line art/circuit/structure suitable for vectorization, false if it has gradients, complex shading or scanned noise.

Return JSON:
{
  "image_type": "diagram",
  "suggested_association": "question",
  "description": "Ray optics concave lens diagram",
  "is_suitable_for_svg": true
}`;

    const userContent = [
      {
        type: 'text',
        text: `Context surrounding this image:\n"${contextText}"\n\nClassify this image:`,
      },
      {
        type: 'image_url',
        image_url: {
          url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`,
        },
      },
    ];

    try {
      const result = await this.executeWithFallback(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        { useVision: true, responseFormatJson: true, requestType: 'image_analysis' }
      );

      const parsed = JSON.parse(result.content);
      return {
        image_type: parsed.image_type || 'diagram',
        suggested_association: parsed.suggested_association || 'question',
        description: parsed.description || 'Question diagram',
        is_suitable_for_svg: Boolean(parsed.is_suitable_for_svg),
      };
    } catch (err) {
      console.warn('Image analysis fallback:', err);
      return {
        image_type: 'diagram',
        suggested_association: 'question',
        description: 'Extracted question diagram',
        is_suitable_for_svg: false,
      };
    }
  }
}
