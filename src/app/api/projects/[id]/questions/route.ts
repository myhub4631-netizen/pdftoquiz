import { NextRequest, NextResponse } from 'next/server';
import { ProjectStore } from '@/lib/projects/store';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const subject = searchParams.get('subject');
    const needsReview = searchParams.get('needsReview');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '500', 10); // High limit to ensure Review page gets all extracted questions

    // Fetch all real questions via ProjectStore (merging DB & Memory store)
    let allQuestions = await ProjectStore.getQuestions(id);

    // Apply filters
    if (subject && subject !== 'All') {
      const subLower = subject.toLowerCase();
      allQuestions = allQuestions.filter((q) => (q.subject || '').toLowerCase().includes(subLower));
    }

    if (needsReview === 'true') {
      allQuestions = allQuestions.filter((q) => q.needs_review);
    }

    if (search) {
      const searchLower = search.toLowerCase().trim();
      allQuestions = allQuestions.filter((q) => {
        const matchText = (q.question_text || '').toLowerCase().includes(searchLower);
        const matchNum = q.question_number?.toString() === searchLower;
        const matchSub = (q.subject || '').toLowerCase().includes(searchLower);
        const matchChap = (q.chapter || '').toLowerCase().includes(searchLower);
        return matchText || matchNum || matchSub || matchChap;
      });
    }

    const total = allQuestions.length;
    const from = (page - 1) * limit;
    const paginatedQuestions = allQuestions.slice(from, from + limit);

    return NextResponse.json({
      success: true,
      questions: paginatedQuestions,
      total,
      page,
      limit,
    });
  } catch (err: any) {
    console.error('[GET /api/projects/[id]/questions] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Failed to fetch project questions',
        questions: [],
        total: 0,
        page: 1,
        limit: 50,
      },
      { status: 500 }
    );
  }
}
