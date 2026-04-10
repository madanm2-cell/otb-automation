import type { FileType, ValidationError } from '@/types/otb';

export interface FileSchema {
  fileType: FileType;
  requiredColumns: string[];
  dimensionColumns: string[];  // columns that form the unique key
  numericColumns: string[];    // columns that must be numeric >= 0
  percentColumns: string[];    // columns that must be 0-100
  aspColumn?: string;          // column that must be > 0 (V-004)
}

export const FILE_SCHEMAS: Record<FileType, FileSchema> = {
  opening_stock: {
    fileType: 'opening_stock',
    requiredColumns: ['sub_brand', 'sub_category', 'gender', 'channel', 'quantity'],
    dimensionColumns: ['sub_brand', 'sub_category', 'gender', 'channel'],
    numericColumns: ['quantity'],
    percentColumns: [],
  },
  ly_sales: {
    fileType: 'ly_sales',
    requiredColumns: ['sub_brand', 'sub_category', 'gender', 'channel', 'month', 'nsq'],
    dimensionColumns: ['sub_brand', 'sub_category', 'gender', 'channel', 'month'],
    numericColumns: ['nsq'],
    percentColumns: [],
  },
  recent_sales: {
    fileType: 'recent_sales',
    requiredColumns: ['sub_brand', 'sub_category', 'gender', 'channel', 'month', 'nsq'],
    dimensionColumns: ['sub_brand', 'sub_category', 'gender', 'channel', 'month'],
    numericColumns: ['nsq'],
    percentColumns: [],
  },
  soft_forecast: {
    fileType: 'soft_forecast',
    requiredColumns: ['sub_brand', 'sub_category', 'gender', 'nsq'],
    dimensionColumns: ['sub_brand', 'sub_category', 'gender'],
    numericColumns: ['nsq'],
    percentColumns: [],
  },
  actuals: {
    fileType: 'actuals',
    requiredColumns: ['sub_brand', 'sub_category', 'gender', 'channel', 'month', 'actual_nsq', 'actual_inwards_qty'],
    dimensionColumns: ['sub_brand', 'sub_category', 'gender', 'channel', 'month'],
    numericColumns: ['actual_nsq', 'actual_inwards_qty'],
    percentColumns: [],
  },
};

export interface MasterDataContext {
  subBrands: Set<string>;
  subCategories: Set<string>;
  channels: Set<string>;
  genders: Set<string>;
}

export interface ValidateResult {
  valid: boolean;
  errors: ValidationError[];
  normalizedRows: Record<string, unknown>[];
}

function normalizeValue(value: unknown): string {
  if (value == null) return '';
  return String(value).trim().toLowerCase();
}

export function validateUpload(
  fileType: FileType,
  rows: Record<string, unknown>[],
  masterData: MasterDataContext
): ValidateResult {
  const schema = FILE_SCHEMAS[fileType];
  const errors: ValidationError[] = [];
  const normalizedRows: Record<string, unknown>[] = [];

  if (rows.length === 0) {
    errors.push({ row: 0, field: '', rule: 'V-007', message: 'File is empty' });
    return { valid: false, errors, normalizedRows };
  }

  // V-005: Check required columns exist
  const firstRowKeys = Object.keys(rows[0]).map(k => k.toLowerCase().trim());
  for (const col of schema.requiredColumns) {
    if (!firstRowKeys.includes(col)) {
      errors.push({ row: 0, field: col, rule: 'V-005', message: `Missing required column: ${col}` });
    }
  }
  if (errors.length > 0) {
    return { valid: false, errors, normalizedRows };
  }

  // Track dimension combos for duplicate aggregation (V-006)
  // Instead of rejecting duplicates, we aggregate numeric columns (sum them)
  const seenKeys = new Map<string, number>(); // dimKey → index in normalizedRows

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // 1-indexed + header row
    const row = rows[i];
    const normalizedRow: Record<string, unknown> = {};

    // Normalize and map dimension columns
    for (const col of schema.requiredColumns) {
      let val = normalizeValue(row[col]);

      // V-003: Validate dimension columns against master data
      if (col === 'sub_brand') {
        normalizedRow[col] = val;
        if (!masterData.subBrands.has(val)) {
          const valid = [...masterData.subBrands].join(', ');
          errors.push({ row: rowNum, field: col, rule: 'V-003', message: `Unknown sub_brand: "${val}". Valid values: ${valid}` });
        }
      } else if (col === 'sub_category') {
        normalizedRow[col] = val;
        if (!masterData.subCategories.has(val)) {
          const valid = [...masterData.subCategories].join(', ');
          errors.push({ row: rowNum, field: col, rule: 'V-003', message: `Unknown sub_category: "${val}". Valid values: ${valid}` });
        }
      } else if (col === 'channel') {
        normalizedRow[col] = val;
        if (!masterData.channels.has(val)) {
          const valid = [...masterData.channels].join(', ');
          errors.push({ row: rowNum, field: col, rule: 'V-003', message: `Unknown channel: "${val}". Valid values: ${valid}` });
        }
      } else if (col === 'gender') {
        normalizedRow[col] = val;
        if (!masterData.genders.has(val)) {
          const valid = [...masterData.genders].join(', ');
          errors.push({ row: rowNum, field: col, rule: 'V-003', message: `Unknown gender: "${val}". Valid values: ${valid}` });
        }
      } else {
        // Numeric or other columns
        const numVal = Number(row[col]);
        if (isNaN(numVal)) {
          normalizedRow[col] = val;
        } else {
          normalizedRow[col] = numVal;
        }
      }
    }

    // V-001: Non-negative numeric validation
    for (const col of schema.numericColumns) {
      const numVal = Number(row[col]);
      if (isNaN(numVal)) {
        errors.push({ row: rowNum, field: col, rule: 'V-001', message: `${col} must be a number` });
      } else if (numVal < 0) {
        errors.push({ row: rowNum, field: col, rule: 'V-001', message: `${col} must be non-negative, got ${numVal}` });
      }
    }

    // V-002: Percentage range validation (0-100)
    for (const col of schema.percentColumns) {
      const numVal = Number(row[col]);
      if (isNaN(numVal)) {
        errors.push({ row: rowNum, field: col, rule: 'V-002', message: `${col} must be a number` });
      } else if (numVal < 0 || numVal > 100) {
        errors.push({ row: rowNum, field: col, rule: 'V-002', message: `${col} must be 0-100, got ${numVal}` });
      }
    }

    // V-004: ASP must be > 0
    if (schema.aspColumn) {
      const aspVal = Number(row[schema.aspColumn]);
      if (isNaN(aspVal) || aspVal <= 0) {
        errors.push({ row: rowNum, field: schema.aspColumn, rule: 'V-004', message: `ASP must be greater than 0, got ${row[schema.aspColumn]}` });
      }
    }

    // V-006: Duplicate handling — aggregate numeric columns by summing
    const dimKey = schema.dimensionColumns.map(col => normalizeValue(normalizedRow[col] ?? row[col])).join('|');
    if (seenKeys.has(dimKey)) {
      // Aggregate: sum numeric columns into the existing row
      const existingIdx = seenKeys.get(dimKey)!;
      const existing = normalizedRows[existingIdx];
      for (const col of [...schema.numericColumns, ...(schema.aspColumn ? [] : [])]) {
        const oldVal = Number(existing[col]) || 0;
        const newVal = Number(normalizedRow[col]) || 0;
        existing[col] = oldVal + newVal;
      }
      // For quantity-like columns not in numericColumns, also aggregate
      if (normalizedRow['quantity'] !== undefined && !schema.numericColumns.includes('quantity')) {
        const oldVal = Number(existing['quantity']) || 0;
        const newVal = Number(normalizedRow['quantity']) || 0;
        existing['quantity'] = oldVal + newVal;
      }
    } else {
      seenKeys.set(dimKey, normalizedRows.length);
      normalizedRows.push(normalizedRow);
    }
  }

  return { valid: errors.length === 0, errors, normalizedRows };
}
