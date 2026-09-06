import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { data: users, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, users: users || [] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, role, status } = body;
    const supabase = createAdminClient();

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (role) updateData.role = role;
    if (status) updateData.status = status;

    const { data: user, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('audit_logs').insert({
      actor: 'MASTER_ADMIN',
      action: 'UPDATE_USER_ROLE_STATUS',
      target: userId,
      details: updateData,
    });

    return NextResponse.json({ success: true, user });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
