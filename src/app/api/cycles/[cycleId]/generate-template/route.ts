import { NextRequest, NextResponse } from 'next/server';
import { generateTemplate } from '@/lib/templateGenerator';

type Params = { params: Promise<{ cycleId: string }> };

// POST /api/cycles/:cycleId/generate-template
export async function POST(_req: NextRequest, { params }: Params) {
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
}
