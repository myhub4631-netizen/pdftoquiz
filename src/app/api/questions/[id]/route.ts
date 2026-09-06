import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const supabase = createAdminClient();

    const {
      question_number,
      subject,
      chapter,
      question_text,
      answer,
      question_type,
      difficulty,
      needs_review,
      is_reviewed,
      review_reason,
      options,
    } = body;

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (question_number !== undefined) updatePayload.question_number = Number(question_number);
    if (subject !== undefined) updatePayload.subject = subject;
    if (chapter !== undefined) updatePayload.chapter = chapter;
    if (question_text !== undefined) updatePayload.question_text = question_text;
    if (answer !== undefined) updatePayload.answer = answer;
    if (question_type !== undefined) updatePayload.question_type = question_type;
    if (difficulty !== undefined) updatePayload.difficulty = difficulty;
    if (needs_review !== undefined) updatePayload.needs_review = Boolean(needs_review);
    if (is_reviewed !== undefined) updatePayload.is_reviewed = Boolean(is_reviewed);
    if (review_reason !== undefined) updatePayload.review_reason = review_reason;

    const { data: updatedQuestion, error: qErr } = await supabase
      .from('questions')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (qErr) throw qErr;

    // Update options if provided
    if (Array.isArray(options)) {
      for (const opt of options) {
        if (opt.id) {
          await supabase
            .from('question_options')
            .update({ text: opt.text, label: opt.label })
            .eq('id', opt.id);
        } else {
          await supabase.from('question_options').insert({
            question_id: id,
            label: opt.label,
            text: opt.text,
            order_index: opt.order_index || 0,
          });
        }
      }
    }

    return NextResponse.json({ success: true, question: updatedQuestion });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Question deleted' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
