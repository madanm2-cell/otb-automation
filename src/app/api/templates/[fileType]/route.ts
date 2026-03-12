import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { ALL_FILE_TYPES, FILE_TYPE_LABELS, FileType } from '@/types/otb';
import { FILE_SCHEMAS } from '@/lib/uploadValidator';

type Params = { params: Promise<{ fileType: string }> };

const SAMPLE_DATA: Record<FileType, Record<string, unknown>[]> = {
  opening_stock: [
    { sub_brand: 'bewakoof', sub_category: 'T-Shirts', gender: 'Male', channel: 'myntra_sor', quantity: 15420 },
    { sub_brand: 'bewakoof air', sub_category: 'Jeans', gender: 'Female', channel: 'amazon_cocoblu', quantity: 8200 },
  ],
  cogs: [
    { sub_brand: 'bewakoof', sub_category: 'T-Shirts', cogs: 350 },
    { sub_brand: 'bewakoof air', sub_category: 'Jeans', cogs: 520 },
  ],
  asp: [
    { sub_brand: 'bewakoof', sub_category: 'T-Shirts', channel: 'myntra_sor', asp: 849.50 },
    { sub_brand: 'bewakoof air', sub_category: 'Jeans', channel: 'amazon_cocoblu', asp: 1299 },
  ],
  standard_doh: [
    { sub_brand: 'bewakoof', sub_category: 'T-Shirts', doh: 45 },
    { sub_brand: 'bewakoof air', sub_category: 'Jeans', doh: 60 },
  ],
  ly_sales: [
    { sub_brand: 'bewakoof', sub_category: 'T-Shirts', gender: 'Male', channel: 'myntra_sor', month: '2025-01-01', nsq: 1000 },
    { sub_brand: 'bewakoof', sub_category: 'T-Shirts', gender: 'Male', channel: 'myntra_sor', month: '2025-02-01', nsq: 950 },
  ],
  recent_sales: [
    { sub_brand: 'bewakoof', sub_category: 'T-Shirts', gender: 'Male', channel: 'myntra_sor', month: '2025-10-01', nsq: 1100 },
    { sub_brand: 'bewakoof air', sub_category: 'Jeans', gender: 'Female', channel: 'flipkart_sor', month: '2025-11-01', nsq: 800 },
  ],
  return_pct: [
    { sub_brand: 'bewakoof', sub_category: 'T-Shirts', channel: 'myntra_sor', return_pct: 25.5 },
    { sub_brand: 'bewakoof air', sub_category: 'Jeans', channel: 'amazon_cocoblu', return_pct: 18.0 },
  ],
  tax_pct: [
    { sub_brand: 'bewakoof', sub_category: 'T-Shirts', channel: 'myntra_sor', tax_pct: 12 },
    { sub_brand: 'bewakoof air', sub_category: 'Jeans', channel: 'amazon_cocoblu', tax_pct: 12 },
  ],
  sellex_pct: [
    { sub_brand: 'bewakoof', sub_category: 'T-Shirts', channel: 'myntra_sor', sellex_pct: 8 },
    { sub_brand: 'bewakoof air', sub_category: 'Jeans', channel: 'amazon_cocoblu', sellex_pct: 10 },
  ],
  soft_forecast: [
    { sub_brand: 'bewakoof', sub_category: 'T-Shirts', gender: 'Male', nsq: 1100 },
    { sub_brand: 'bewakoof air', sub_category: 'Jeans', gender: 'Female', nsq: 750 },
  ],
};

// GET /api/templates/:fileType — download sample CSV
export const GET = withAuth(null, async (req: NextRequest, auth, { params }: Params) => {
  const { fileType } = await params;

  if (!ALL_FILE_TYPES.includes(fileType as FileType)) {
    return NextResponse.json({ error: `Invalid file type: ${fileType}` }, { status: 400 });
  }

  const ft = fileType as FileType;
  const schema = FILE_SCHEMAS[ft];
  const sampleRows = SAMPLE_DATA[ft];
  const headers = schema.requiredColumns;

  const csvLines = [
    headers.join(','),
    ...sampleRows.map(row => headers.map(h => row[h] ?? '').join(',')),
  ];

  const csv = csvLines.join('\n');
  const label = FILE_TYPE_LABELS[ft].replace(/[^a-zA-Z0-9]/g, '_');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${label}_template.csv"`,
    },
  });
});
