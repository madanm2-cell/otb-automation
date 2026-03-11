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
  cogs: {
    fileType: 'cogs',
    requiredColumns: ['sub_brand', 'sub_category', 'cogs'],
    dimensionColumns: ['sub_brand', 'sub_category'],
    numericColumns: ['cogs'],
    percentColumns: [],
  },
  asp: {
    fileType: 'asp',
    requiredColumns: ['sub_brand', 'sub_category', 'channel', 'asp'],
    dimensionColumns: ['sub_brand', 'sub_category', 'channel'],
    numericColumns: [],
    percentColumns: [],
    aspColumn: 'asp',
  },
  standard_doh: {
    fileType: 'standard_doh',
    requiredColumns: ['sub_brand', 'sub_category', 'doh'],
    dimensionColumns: ['sub_brand', 'sub_category'],
    numericColumns: ['doh'],
    percentColumns: [],
  },
  ly_sales: {
    fileType: 'ly_sales',
    requiredColumns: ['sub_brand', 'sub_category', 'gender', 'channel', 'month', 'gmv'],
    dimensionColumns: ['sub_brand', 'sub_category', 'gender', 'channel', 'month'],
    numericColumns: ['gmv'],
    percentColumns: [],
  },
  recent_sales: {
    fileType: 'recent_sales',
    requiredColumns: ['sub_brand', 'sub_category', 'gender', 'nsq'],
    dimensionColumns: ['sub_brand', 'sub_category', 'gender'],
    numericColumns: ['nsq'],
    percentColumns: [],
  },
  return_pct: {
    fileType: 'return_pct',
    requiredColumns: ['sub_category', 'channel', 'return_pct'],
    dimensionColumns: ['sub_category', 'channel'],
    numericColumns: [],
    percentColumns: ['return_pct'],
  },
  tax_pct: {
    fileType: 'tax_pct',
    requiredColumns: ['sub_category', 'channel', 'tax_pct'],
    dimensionColumns: ['sub_category', 'channel'],
    numericColumns: [],
    percentColumns: ['tax_pct'],
  },
  sellex_pct: {
    fileType: 'sellex_pct',
    requiredColumns: ['sub_category', 'channel', 'sellex_pct'],
    dimensionColumns: ['sub_category', 'channel'],
    numericColumns: [],
    percentColumns: ['sellex_pct'],
  },
  soft_forecast: {
    fileType: 'soft_forecast',
    requiredColumns: ['sub_brand', 'sub_category', 'gender', 'nsq'],
    dimensionColumns: ['sub_brand', 'sub_category', 'gender'],
    numericColumns: ['nsq'],
    percentColumns: [],
  },
};

export interface MasterDataContext {
  subBrands: Set<string>;
  subCategories: Set<string>;
  channels: Set<string>;
  genders: Set<string>;
  mappings: Map<string, string>;  // key: "type:rawValue" → standardValue
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

function applyMapping(mappings: Map<string, string>, type: string, raw: string): string {
  const key = `${type}:${raw.toLowerCase()}`;
  return mappings.get(key) ?? raw;
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

  // Track dimension combos for duplicate detection (V-006)
  const seenKeys = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // 1-indexed + header row
    const row = rows[i];
    const normalizedRow: Record<string, unknown> = {};

    // Normalize and map dimension columns
    for (const col of schema.requiredColumns) {
      let val = normalizeValue(row[col]);

      // Apply master data mappings for dimension columns
      if (col === 'sub_brand') {
        val = applyMapping(masterData.mappings, 'sub_brand', val);
        normalizedRow[col] = val;
        // V-003: Check against master data
        if (!masterData.subBrands.has(val)) {
          errors.push({ row: rowNum, field: col, rule: 'V-003', message: `Unknown sub_brand: "${val}"` });
        }
      } else if (col === 'sub_category') {
        val = applyMapping(masterData.mappings, 'sub_category', val);
        normalizedRow[col] = val;
        if (!masterData.subCategories.has(val)) {
          errors.push({ row: rowNum, field: col, rule: 'V-003', message: `Unknown sub_category: "${val}"` });
        }
      } else if (col === 'channel') {
        val = applyMapping(masterData.mappings, 'channel', val);
        normalizedRow[col] = val;
        if (!masterData.channels.has(val)) {
          errors.push({ row: rowNum, field: col, rule: 'V-003', message: `Unknown channel: "${val}"` });
        }
      } else if (col === 'gender') {
        normalizedRow[col] = val;
        if (!masterData.genders.has(val)) {
          errors.push({ row: rowNum, field: col, rule: 'V-003', message: `Unknown gender: "${val}"` });
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

    // V-006: Duplicate dimension combination check
    const dimKey = schema.dimensionColumns.map(col => normalizeValue(normalizedRow[col] ?? row[col])).join('|');
    if (seenKeys.has(dimKey)) {
      errors.push({ row: rowNum, field: '', rule: 'V-006', message: `Duplicate dimension combination: ${dimKey}` });
    }
    seenKeys.add(dimKey);

    normalizedRows.push(normalizedRow);
  }

  return { valid: errors.length === 0, errors, normalizedRows };
}
