export interface Brand {
  id: string;
  name: string;
}

export interface SubBrand {
  id: string;
  name: string;
  brand_id: string;
}

export interface WearType {
  id: string;
  name: string;
  brand_id: string;
}

export interface SubCategory {
  id: string;
  name: string;
  brand_id: string;
  wear_type_id: string | null;
  // Joined
  wear_types?: WearType;
}

export interface Channel {
  id: string;
  name: string;
  brand_id: string;
}

export interface Gender {
  id: string;
  name: string;
  brand_id: string;
}

export interface MasterMapping {
  id: string;
  mapping_type: string;
  raw_value: string;
  standard_value: string;
  brand_id: string | null;
}

// Master data defaults — brand-scoped reference values
export interface MasterDefaultAsp {
  id: string;
  brand_id: string;
  sub_brand: string;
  sub_category: string;
  channel: string;
  asp: number;
}

export interface MasterDefaultCogs {
  id: string;
  brand_id: string;
  sub_brand: string;
  sub_category: string;
  cogs: number;
}

export interface MasterDefaultReturnPct {
  id: string;
  brand_id: string;
  sub_brand: string;
  sub_category: string;
  channel: string;
  return_pct: number;
}

export interface MasterDefaultTaxPct {
  id: string;
  brand_id: string;
  sub_category: string;
  tax_pct: number;
}

export interface MasterDefaultSellexPct {
  id: string;
  brand_id: string;
  sub_brand: string;
  sub_category: string;
  channel: string;
  sellex_pct: number;
}

export interface MasterDefaultDoh {
  id: string;
  brand_id: string;
  sub_brand: string;
  sub_category: string;
  doh: number;
}

export type DefaultType = 'asp' | 'cogs' | 'return_pct' | 'tax_pct' | 'sellex_pct' | 'standard_doh';

export interface CycleDefault {
  id: string;
  cycle_id: string;
  default_type: DefaultType;
  sub_brand: string | null;
  sub_category: string;
  channel: string | null;
  value: number;
  confirmed: boolean;
}

export interface OtbCycle {
  id: string;
  cycle_name: string;
  brand_id: string;
  planning_quarter: string;
  planning_period_start: string;
  planning_period_end: string;
  fill_deadline: string | null;
  approval_deadline: string | null;
  assigned_gd_id: string | null;
  defaults_confirmed: boolean;
  status: 'Draft' | 'Active' | 'Filling' | 'InReview' | 'Approved';
  created_at: string;
  updated_at: string;
  // Joined
  brands?: Brand;
}

export type FileType =
  | 'opening_stock'
  | 'ly_sales' | 'recent_sales'
  | 'soft_forecast'
  | 'actuals';

export const REQUIRED_FILE_TYPES: FileType[] = [
  'opening_stock', 'ly_sales', 'recent_sales',
];

export const ALL_FILE_TYPES: FileType[] = [
  ...REQUIRED_FILE_TYPES,
  'soft_forecast',
  'actuals',
];

export const FILE_TYPE_LABELS: Record<FileType, string> = {
  opening_stock: 'Opening Stock',
  ly_sales: 'LY Sales',
  recent_sales: 'Recent Sales (3M)',
  soft_forecast: 'Soft Forecast (Optional)',
  actuals: 'Actuals (NSQ + Inwards)',
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
}

export interface FormulaInputs {
  nsq: number | null;
  inwardsQty: number | null;
  asp: number | null;
  cogs: number | null;
  openingStockQty: number | null;
  lySalesNsq: number | null;
  returnPct: number | null;
  taxPct: number | null;
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
}

export type CycleStatus = OtbCycle['status'];

export interface BulkUpdateItem {
  rowId: string;
  month: string;
  nsq?: number | null;
  inwards_qty?: number | null;
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
  assigned_brands: string[];  // brand IDs (all non-Admin roles)
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// === Approval Workflow Types ===

export type ApproverRole = 'Planning' | 'GD' | 'Finance' | 'CXO';

export type ApprovalStatus = 'Pending' | 'Approved' | 'RevisionRequested';

export interface ApprovalRecord {
  id?: string;
  cycle_id: string;
  role: ApproverRole;
  user_id: string | null;
  status: ApprovalStatus;
  comment: string | null;
  decided_at: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined
  user_name?: string;
}

export type CommentType = 'brand' | 'metric' | 'general';

export interface OtbComment {
  id: string;
  cycle_id: string;
  parent_id: string | null;
  comment_type: CommentType;
  row_id: string | null;
  month: string | null;
  field: string | null;
  text: string;
  author_id: string;
  author_name: string;
  author_role: string;
  created_at: string;
  // Client-side
  replies?: OtbComment[];
}

// === Actuals & Variance Types ===

export interface ActualsRow {
  id: string;
  cycle_id: string;
  sub_brand: string;
  wear_type: string;
  sub_category: string;
  gender: string;
  channel: string;
  month: string;
  actual_nsq: number;
  actual_inwards_qty: number;
  // Recalculated from actuals
  actual_gmv: number | null;
  actual_nsv: number | null;
  actual_closing_stock_qty: number | null;
  actual_doh: number | null;
  actual_gm_pct: number | null;
  uploaded_at: string;
  uploaded_by: string;
}

export type VarianceLevel = 'green' | 'yellow' | 'red';

export interface VarianceMetric {
  metric: string;
  planned: number | null;
  actual: number | null;
  variance_pct: number | null;
  level: VarianceLevel;
}

export interface VarianceRow {
  sub_brand: string;
  wear_type: string;
  sub_category: string;
  gender: string;
  channel: string;
  month: string;
  nsq: VarianceMetric;
  gmv: VarianceMetric;
  inwards: VarianceMetric;
  closing_stock: VarianceMetric;
}

export interface VarianceThresholds {
  nsq_pct: number;          // ±15%
  gmv_pct: number;          // ±15%
  inwards_pct: number;      // ±20%
  closing_stock_pct: number; // ±25%
}

export const DEFAULT_VARIANCE_THRESHOLDS: VarianceThresholds = {
  nsq_pct: 15,
  gmv_pct: 15,
  inwards_pct: 20,
  closing_stock_pct: 25,
};

export interface VarianceReportData {
  cycle_id: string;
  cycle_name: string;
  brand_name: string;
  planning_quarter: string;
  months: string[];
  rows: VarianceRow[];
  summary: VarianceSummary;
}

export interface VarianceSummary {
  total_rows: number;
  red_count: number;
  yellow_count: number;
  green_count: number;
  top_variances: VarianceRow[]; // Top 10 by magnitude
}

// === Enhanced Dashboard Types ===

export interface BrandMonthBreakdown {
  month: string;
  gmv: number;
  nsv: number;
  nsq: number;
  inwards_qty: number;
  closing_stock_qty: number;
  avg_doh: number;
}

export interface CategoryBreakdown {
  sub_category: string;
  gmv: number;
  nsq: number;
  pct_of_total: number; // percentage of brand total GMV
}

export interface EnhancedBrandSummary {
  brand_id: string;
  brand_name: string;
  cycle_id: string;
  cycle_name: string;
  status: string;
  planning_quarter: string;
  // Aggregate metrics
  gmv: number;
  nsv: number;
  nsq: number;
  inwards_qty: number;
  avg_doh: number;
  closing_stock_qty: number;
  // Breakdowns
  monthly: BrandMonthBreakdown[];
  top_categories: CategoryBreakdown[];
}

export interface DashboardKpiTotals {
  gmv: number;
  nsv: number;
  nsq: number;
  inwards_qty: number;
  avg_doh: number;
  closing_stock_qty: number;
}

export interface DashboardSummaryResponse {
  kpiTotals: DashboardKpiTotals;
  brands: EnhancedBrandSummary[];
  months: string[];
}
