export interface Brand {
  id: string;
  name: string;
}

export interface SubBrand {
  id: string;
  name: string;
  brand_id: string;
}

export interface OtbCycle {
  id: string;
  cycle_name: string;
  brand_id: string;
  planning_quarter: string;
  planning_period_start: string;
  planning_period_end: string;
  wear_types: string[];
  fill_deadline: string | null;
  approval_deadline: string | null;
  assigned_gd_id: string | null;
  status: 'Draft' | 'Active' | 'Filling' | 'InReview' | 'Approved';
  created_at: string;
  updated_at: string;
  // Joined
  brands?: Brand;
}

export type FileType =
  | 'opening_stock' | 'cogs' | 'asp' | 'standard_doh'
  | 'ly_sales' | 'recent_sales'
  | 'return_pct' | 'tax_pct' | 'sellex_pct'
  | 'soft_forecast';

export const REQUIRED_FILE_TYPES: FileType[] = [
  'opening_stock', 'cogs', 'asp', 'standard_doh',
  'ly_sales', 'recent_sales', 'return_pct', 'tax_pct', 'sellex_pct',
];

export const ALL_FILE_TYPES: FileType[] = [
  ...REQUIRED_FILE_TYPES,
  'soft_forecast',
];

export const FILE_TYPE_LABELS: Record<FileType, string> = {
  opening_stock: 'Opening Stock',
  cogs: 'COGS',
  asp: 'ASP',
  standard_doh: 'Standard DoH',
  ly_sales: 'LY Sales',
  recent_sales: 'Recent Sales (3M)',
  return_pct: 'Return %',
  tax_pct: 'Tax %',
  sellex_pct: 'Sellex %',
  soft_forecast: 'Soft Forecast (Optional)',
};

export interface FileUpload {
  id: string;
  cycle_id: string;
  file_type: FileType;
  file_name: string;
  storage_path: string;
  status: 'pending' | 'validated' | 'failed';
  row_count: number | null;
  errors: ValidationError[] | null;
  uploaded_at: string;
}

export interface ValidationError {
  row: number;
  field: string;
  rule: string;      // V-001 through V-007
  message: string;
}

export interface PlanRow {
  id: string;
  cycle_id: string;
  sub_brand: string;
  wear_type: string;
  sub_category: string;
  gender: string;
  channel: string;
  months: Record<string, PlanMonthData>;  // keyed by "YYYY-MM-DD"
}

export interface PlanMonthData {
  id: string;
  month: string;
  // Reference data
  asp: number | null;
  cogs: number | null;
  opening_stock_qty: number | null;
  ly_sales_nsq: number | null;
  recent_sales_nsq: number | null;
  soft_forecast_nsq: number | null;
  return_pct: number | null;
  tax_pct: number | null;
  sellex_pct: number | null;
  standard_doh: number | null;
  // GD inputs
  nsq: number | null;
  inwards_qty: number | null;
  perf_marketing_pct: number | null;
  // Calculated
  sales_plan_gmv: number | null;
  goly_pct: number | null;
  nsv: number | null;
  inwards_val_cogs: number | null;
  opening_stock_val: number | null;
  closing_stock_qty: number | null;
  fwd_30day_doh: number | null;
  gm_pct: number | null;
  gross_margin: number | null;
  cm1: number | null;
  cm2: number | null;
}

export interface FormulaInputs {
  nsq: number | null;
  inwardsQty: number | null;
  perfMarketingPct: number | null;
  asp: number | null;
  cogs: number | null;
  openingStockQty: number | null;
  lySalesNsq: number | null;
  returnPct: number | null;
  taxPct: number | null;
  sellexPct: number | null;
  nextMonthNsq: number | null;
}

export interface FormulaOutputs {
  salesPlanGmv: number | null;
  golyPct: number | null;
  nsv: number | null;
  inwardsValCogs: number | null;
  openingStockVal: number | null;
  closingStockQty: number | null;
  fwd30dayDoh: number | null;
  gmPct: number | null;
  grossMargin: number | null;
  cm1: number | null;
  cm2: number | null;
}

export type CycleStatus = OtbCycle['status'];

export interface BulkUpdateItem {
  rowId: string;
  month: string;
  nsq?: number | null;
  inwards_qty?: number | null;
  perf_marketing_pct?: number | null;
}

export interface PlanDataResponse {
  months: string[];
  rows: PlanRow[];
}

export type Role = 'Admin' | 'Planning' | 'GD' | 'Finance' | 'CXO' | 'ReadOnly';

export interface UserProfile {
  id: string;            // auth.users.id
  email: string;
  full_name: string;
  role: Role;
  assigned_brands: string[];  // brand IDs (for GDs)
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
