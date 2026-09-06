import { NextRequest, NextResponse } from 'next/server';
import { OpenRouterProvider } from '@/lib/ai/openrouter';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { apiKey, model } = body;

    const provider = new OpenRouterProvider();
    const result = await provider.testConnection(apiKey, model);

    return NextResponse.json({
      success: result.success,
      message: result.message,
      model: result.model,
      latency_ms: result.latency_ms,
      details: result.details,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      message: 'The API key or connection could not be validated.',
      latency_ms: 0,
    });
  }
}
