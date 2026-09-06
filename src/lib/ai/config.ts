import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { AIModelSettings } from '@/types/database';

const ENCRYPTION_KEY = process.env.ENCRYPTION_SECRET 
  ? crypto.createHash('sha256').update(process.env.ENCRYPTION_SECRET).digest() 
  : crypto.createHash('sha256').update('questionforge-default-secret-salt-2026').digest();
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypts a sensitive string (like OpenRouter API key) using AES-256-GCM.
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an encrypted string.
 */
export function decryptSecret(encryptedPayload: string): string {
  if (!encryptedPayload || !encryptedPayload.includes(':')) return '';
  try {
    const [ivHex, authTagHex, encryptedText] = encryptedPayload.split(':');
    if (!ivHex || !authTagHex || !encryptedText) return '';
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Failed to decrypt secret:', err);
    return '';
  }
}

/**
 * Masks an API key for safe UI display (e.g. sk-or-v1-••••••••••••9X2K).
 */
export function maskApiKey(key: string): string {
  if (!key) return '••••••••••••••••';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '••••••••••••••••';
  const prefix = trimmed.slice(0, Math.min(8, trimmed.length - 4));
  const suffix = trimmed.slice(-4);
  return `${prefix}${'•'.repeat(Math.max(12, trimmed.length - prefix.length - suffix.length))}${suffix}`;
}

export interface ActiveAIConfig {
  apiKey: string;
  apiKeyMasked: string;
  primaryModel: string;
  visionModel: string;
  fallbackModel: string;
  temperature: number;
  maxOutputTokens: number;
  retryAttempts: number;
  requestTimeoutMs: number;
}

/**
 * Loads the active AI configuration from DB or falls back to environment variables.
 */
export async function getActiveAIConfig(): Promise<ActiveAIConfig> {
  const envApiKey = process.env.OPENROUTER_API_KEY || '';
  const defaultPrimary = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
  const defaultVision = process.env.OPENROUTER_VISION_MODEL || 'google/gemini-2.5-flash';
  const defaultFallback = process.env.OPENROUTER_FALLBACK_MODEL || 'meta-llama/llama-3.3-70b-instruct';

  try {
    const supabase = createAdminClient();
    const { data: dbSettings, error } = await supabase
      .from('ai_model_settings')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dbSettings && !error) {
      let resolvedKey = envApiKey;
      if (dbSettings.encrypted_api_key) {
        const decrypted = decryptSecret(dbSettings.encrypted_api_key);
        if (decrypted) resolvedKey = decrypted;
      }

      return {
        apiKey: resolvedKey,
        apiKeyMasked: dbSettings.api_key_masked || maskApiKey(resolvedKey),
        primaryModel: dbSettings.primary_model || defaultPrimary,
        visionModel: dbSettings.vision_model || defaultVision,
        fallbackModel: dbSettings.fallback_model || defaultFallback,
        temperature: Number(dbSettings.temperature) || 0.1,
        maxOutputTokens: Number(dbSettings.max_output_tokens) || 8192,
        retryAttempts: Number(dbSettings.retry_attempts) ?? 2,
        requestTimeoutMs: Number(dbSettings.request_timeout_ms) || 60000,
      };
    }
  } catch (err) {
    console.error('Error fetching DB AI config, using env defaults:', err);
  }

  return {
    apiKey: envApiKey,
    apiKeyMasked: maskApiKey(envApiKey),
    primaryModel: defaultPrimary,
    visionModel: defaultVision,
    fallbackModel: defaultFallback,
    temperature: 0.1,
    maxOutputTokens: 8192,
    retryAttempts: 2,
    requestTimeoutMs: 60000,
  };
}

export async function getAIModelSettings() {
  const activeConfig = await getActiveAIConfig();
  return {
    api_key_plain: activeConfig.apiKey,
    api_key_masked: activeConfig.apiKeyMasked,
    primary_model: activeConfig.primaryModel,
    vision_model: activeConfig.visionModel,
    fallback_model: activeConfig.fallbackModel,
    temperature: activeConfig.temperature,
    max_tokens: activeConfig.maxOutputTokens,
    retry_attempts: activeConfig.retryAttempts,
    request_timeout_sec: Math.round(activeConfig.requestTimeoutMs / 1000),
  };
}

export async function saveAIModelSettings(settings: {
  api_key_plain?: string;
  primary_model?: string;
  vision_model?: string;
  fallback_model?: string;
  temperature?: number;
  max_tokens?: number;
  retry_attempts?: number;
  request_timeout_sec?: number;
}) {
  const supabase = createAdminClient();
  const encrypted = settings.api_key_plain ? encryptSecret(settings.api_key_plain) : undefined;
  const masked = settings.api_key_plain ? maskApiKey(settings.api_key_plain) : undefined;

  const rowData: Record<string, any> = {
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  if (encrypted) rowData.encrypted_api_key = encrypted;
  if (masked) rowData.api_key_masked = masked;
  if (settings.primary_model) rowData.primary_model = settings.primary_model;
  if (settings.vision_model) rowData.vision_model = settings.vision_model;
  if (settings.fallback_model) rowData.fallback_model = settings.fallback_model;
  if (typeof settings.temperature === 'number') rowData.temperature = settings.temperature;
  if (typeof settings.max_tokens === 'number') rowData.max_output_tokens = settings.max_tokens;
  if (typeof settings.retry_attempts === 'number') rowData.retry_attempts = settings.retry_attempts;
  if (typeof settings.request_timeout_sec === 'number') rowData.request_timeout_ms = settings.request_timeout_sec * 1000;

  await supabase.from('ai_model_settings').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
  
  const { data, error } = await supabase
    .from('ai_model_settings')
    .insert([rowData])
    .select()
    .single();

  return {
    api_key_plain: settings.api_key_plain,
    api_key_masked: masked || maskApiKey(settings.api_key_plain || ''),
    primary_model: settings.primary_model || 'google/gemini-2.5-flash',
    vision_model: settings.vision_model || 'google/gemini-2.5-flash',
    fallback_model: settings.fallback_model || 'openai/gpt-4o-mini',
    temperature: settings.temperature ?? 0.1,
    max_tokens: settings.max_tokens ?? 8192,
    retry_attempts: settings.retry_attempts ?? 2,
    request_timeout_sec: settings.request_timeout_sec ?? 60,
  };
}

export async function testOpenRouterConnection(apiKey: string, model: string = 'google/gemini-2.5-flash') {
  const startTime = Date.now();
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://questionforge.ai',
        'X-Title': 'QuestionForge AI Verification',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Ping: Reply with {"status":"ok"}' }],
        max_tokens: 16,
      }),
    });

    const latencyMs = Date.now() - startTime;
    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        error: `OpenRouter returned HTTP ${response.status}: ${errText}`,
        latency_ms: latencyMs,
      };
    }

    const data = await response.json();
    return {
      success: true,
      message: `OpenRouter connection verified successfully! Model ${model} is responsive.`,
      details: {
        model,
        latency_ms: `${latencyMs}ms`,
        usage: data.usage,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Connection error: ${err.message}`,
      latency_ms: Date.now() - startTime,
    };
  }
}
