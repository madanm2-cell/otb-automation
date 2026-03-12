import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { generateTemplate } from '@/lib/templateGenerator';

type Params = { params: Promise<{ cycleId: string }> };

// POST /api/cycles/:cycleId/generate-template
export const POST = withAuth('create_cycle', async (req, auth, { params }: Params) => {
  const { cycleId } = await params;

  try {
    const result = await generateTemplate(cycleId);
    return NextResponse.json({
      message: `Template generated: ${result.rowCount} plan rows created`,
      rowCount: result.rowCount,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
});
