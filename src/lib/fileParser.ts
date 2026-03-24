import ExcelJS from 'exceljs';
import { parse } from 'csv-parse/sync';

export async function parseUploadedFile(
  buffer: Buffer,
  fileName: string
): Promise<Record<string, unknown>[]> {
  const ext = fileName.toLowerCase().split('.').pop();

  if (ext === 'csv') {
    return parseCsv(buffer);
  } else if (ext === 'xlsx' || ext === 'xls') {
    return parseXlsx(buffer);
  } else {
    throw new Error(`Unsupported file type: .${ext}. Use .csv or .xlsx`);
  }
}

function parseCsv(buffer: Buffer): Record<string, unknown>[] {
  const content = buffer.toString('utf-8');
  const records = parse(content, {
    columns: (header: string[]) => header.map((h: string) => h.trim().toLowerCase()),
    skip_empty_lines: true,
    trim: true,
  });
  return records as Record<string, unknown>[];
}

async function parseXlsx(buffer: Buffer): Promise<Record<string, unknown>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount === 0) {
    return [];
  }

  // First row is headers
  const headers: string[] = [];
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? '').trim().toLowerCase();
  });

  const rows: Record<string, unknown>[] = [];
  for (let i = 2; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);
    const record: Record<string, unknown> = {};
    let hasData = false;

    headers.forEach((header, idx) => {
      if (header) {
        const cell = row.getCell(idx + 1);
        let val = cell.value;
        // Normalize Date objects to YYYY-MM-DD strings
        if (val instanceof Date) {
          const y = val.getFullYear();
          const m = String(val.getMonth() + 1).padStart(2, '0');
          const d = String(val.getDate()).padStart(2, '0');
          val = `${y}-${m}-${d}`;
        }
        record[header] = val;
        if (val != null && val !== '') hasData = true;
      }
    });

    if (hasData) rows.push(record);
  }

  return rows;
}
