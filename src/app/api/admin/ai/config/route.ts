import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getActiveAIConfig, encryptSecret, maskApiKey } from '@/lib/ai/config';

export async function GET() {
  try {
    const config = await getActiveAIConfig();
    const supabase = createAdminClient();

    // Fetch AI usage metrics for today and this month
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data: todayLogs } = await supabase
      .from('ai_usage_logs')
      .select('prompt_tokens, completion_tokens, total_tokens, success, request_type')
      .gte('created_at', startOfToday);

    const { data: monthLogs } = await supabase
      .from('ai_usage_logs')
      .select('prompt_tokens, completion_tokens, total_tokens, success, request_type')
      .gte('created_at', startOfMonth);

    const todayRequests = todayLogs?.length || 0;
    const monthRequests = monthLogs?.length || 0;
    const successfulRequests = monthLogs?.filter((l) => l.success).length || 0;
    const failedRequests = monthRequests - successfulRequests;
    const estimatedTokens = (monthLogs || []).reduce((acc, l) => acc + (l.total_tokens || 0), 0);
    const questionsProcessed = monthLogs?.filter((l) => l.request_type === 'question_extraction').length || 0;
    const imagesAnalyzed = monthLogs?.filter((l) => l.request_type === 'image_analysis').length || 0;

    return NextResponse.json({
      success: true,
      config: {
        apiKeyMasked: config.apiKeyMasked,
        hasKeyConfigured: Boolean(config.apiKey),
        primaryModel: config.primaryModel,
        visionModel: config.visionModel,
        fallbackModel: config.fallbackModel,
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens,
        retryAttempts: config.retryAttempts,
        requestTimeoutMs: config.requestTimeoutMs,
      },
      usage: {
        requestsToday: todayRequests,
        requestsThisMonth: monthRequests,
        successfulRequests,
        failedRequests,
        questionsProcessed,
        imagesAnalyzed,
        estimatedTokens,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = createAdminClient();

    const {
      apiKey,
      primaryModel = 'google/gemini-2.5-flash',
      visionModel = 'google/gemini-2.5-flash',
      fallbackModel = 'meta-llama/llama-3.3-70b-instruct',
      temperature = 0.10,
      maxOutputTokens = 8192,
      retryAttempts = 2,
      requestTimeoutMs = 60000,
    } = body;

    let encryptedKey: string | undefined = undefined;
    let maskedKey: string | undefined = undefined;

    if (apiKey && apiKey.trim().length > 0) {
      encryptedKey = encryptSecret(apiKey.trim());
      maskedKey = maskApiKey(apiKey.trim());
    }

    const payload: Record<string, any> = {
      is_active: true,
      primary_model: primaryModel,
      vision_model: visionModel,
      fallback_model: fallbackModel,
      temperature: Number(temperature),
      max_output_tokens: Number(maxOutputTokens),
      retry_attempts: Number(retryAttempts),
      request_timeout_ms: Number(requestTimeoutMs),
      updated_at: new Date().toISOString(),
    };

    if (encryptedKey && maskedKey) {
      payload.encrypted_api_key = encryptedKey;
      payload.api_key_masked = maskedKey;
    }

    // Check if existing setting row exists
    const { data: existing } = await supabase
      .from('ai_model_settings')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabase.from('ai_model_settings').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('ai_model_settings').insert(payload);
    }

    // Record Audit Log (NEVER include actual API key)
    await supabase.from('audit_logs').insert({
      actor_email: 'master.admin@questionforge.ai',
      action: 'OpenRouter AI Configuration Updated',
      target_type: 'ai_model_settings',
      details: {
        apiKeyUpdated: Boolean(apiKey),
        primaryModel,
        visionModel,
        fallbackModel,
        temperature,
        maxOutputTokens,
        retryAttempts,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'AI settings updated successfully',
      apiKeyMasked: maskedKey || '••••••••••••••••',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
