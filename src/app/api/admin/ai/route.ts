import { NextRequest, NextResponse } from 'next/server';
import { getAIModelSettings, saveAIModelSettings, maskApiKey, testOpenRouterConnection } from '@/lib/ai/config';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const settings = await getAIModelSettings();
    const supabase = createAdminClient();

    // Check usage stats for today and this month
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: todayCalls } = await supabase
      .from('ai_usage_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    const { data: usageAgg } = await supabase
      .from('ai_usage_logs')
      .select('prompt_tokens, completion_tokens, total_tokens, success');

    const totalRequests = usageAgg?.length || 0;
    const totalTokens = usageAgg?.reduce((acc, log) => acc + (log.total_tokens || 0), 0) || 0;
    const successfulRequests = usageAgg?.filter((log) => log.success).length || 0;
    const successRate = totalRequests > 0 ? ((successfulRequests / totalRequests) * 100).toFixed(1) : '100.0';

    return NextResponse.json({
      success: true,
      settings: {
        ...settings,
        api_key_masked: settings.api_key_masked || maskApiKey(settings.api_key_plain || ''),
        is_configured: Boolean(settings.api_key_plain),
      },
      telemetry: {
        today_calls: todayCalls || 0,
        total_requests: totalRequests,
        total_tokens: totalTokens,
        success_rate: `${successRate}%`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, apiKey, model } = body;

    if (action === 'test_connection') {
      const currentSettings = await getAIModelSettings();
      const keyToTest = apiKey || currentSettings.api_key_plain;
      const modelToTest = model || currentSettings.primary_model;

      if (!keyToTest) {
        return NextResponse.json({
          success: false,
          error: 'No OpenRouter API key found. Please provide a key to test.',
        }, { status: 400 });
      }

      const result = await testOpenRouterConnection(keyToTest, modelToTest);
      return NextResponse.json(result);
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      api_key,
      primary_model,
      vision_model,
      fallback_model,
      temperature,
      max_tokens,
      retry_attempts,
      request_timeout_sec,
    } = body;

    const currentSettings = await getAIModelSettings();
    const newApiKey = api_key && api_key.trim() !== '' ? api_key.trim() : currentSettings.api_key_plain;

    const saved = await saveAIModelSettings({
      api_key_plain: newApiKey,
      primary_model: primary_model || currentSettings.primary_model,
      vision_model: vision_model || currentSettings.vision_model,
      fallback_model: fallback_model || currentSettings.fallback_model,
      temperature: typeof temperature === 'number' ? temperature : currentSettings.temperature,
      max_tokens: typeof max_tokens === 'number' ? max_tokens : currentSettings.max_tokens,
      retry_attempts: typeof retry_attempts === 'number' ? retry_attempts : currentSettings.retry_attempts,
      request_timeout_sec: typeof request_timeout_sec === 'number' ? request_timeout_sec : currentSettings.request_timeout_sec,
    });

    // Record audit log
    const supabase = createAdminClient();
    await supabase.from('audit_logs').insert({
      actor: 'MASTER_ADMIN',
      action: 'UPDATE_AI_SETTINGS',
      target: 'ai_model_settings',
      details: {
        primary_model: saved.primary_model,
        vision_model: saved.vision_model,
        fallback_model: saved.fallback_model,
        api_key_updated: Boolean(api_key),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'AI Model & OpenRouter settings updated securely.',
      settings: {
        ...saved,
        api_key_masked: saved.api_key_masked,
        is_configured: Boolean(saved.api_key_plain),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
