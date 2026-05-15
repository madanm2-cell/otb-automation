// src/lib/wiki-content.ts

export interface ProcessStep {
  step: number;
  title: string;
  description: string;
  responsible: string;
}

export interface MasterDataField {
  field: string;
  description: string;
  managedBy: string;
}

export interface DefaultField {
  field: string;
  description: string;
  scopedBy: string;
  editableBy: string;
}

export interface UploadInputField {
  field: string;
  sourceFile: string;
  description: string;
  required: string;
}

export interface GridField {
  field: string;
  description: string;
}

export interface SystemField {
  field: string;
  source: string;
}

export interface CalculatedField {
  field: string;
  formula: string;
  description: string;
}

export interface RoleDescription {
  role: string;
  description: string;
}

export interface PermissionRow {
  label: string;
  admin: boolean;
  planning: boolean;
  gd: boolean;
  finance: boolean;
  cxo: boolean;
  readOnly: boolean;
}

export interface GlossaryTerm {
  term: string;
  definition: string;
}

export const PROCESS_STEPS: ProcessStep[] = [
  {
    step: 1,
    title: 'Create Cycle',
    description:
      'Admin or Planning creates a new planning cycle for a brand and quarter. They assign a Growth Director and set the fill deadline (when the grid must be completed) and the approval deadline.',
    responsible: 'Admin, Planning',
  },
  {
    step: 2,
    title: 'Upload Reference Files',
    description:
      'Planning uploads the required data files: Opening Stock, Last Year Sales, and Recent Sales (three months). An optional Soft Forecast file can also be uploaded to provide a forward-looking demand estimate.',
    responsible: 'Admin, Planning',
  },
  {
    step: 3,
    title: 'Confirm Defaults',
    description:
      'Planning reviews the per-row default values that seed the grid — Average Selling Price, Cost of Goods Sold, Return Percentage, Tax Percentage, and Standard Days on Hand. These are seeded from master defaults and can be overridden before confirmation. The Growth Director cannot begin editing until defaults are confirmed.',
    responsible: 'Admin, Planning',
  },
  {
    step: 4,
    title: 'Growth Director Fills the Grid',
    description:
      'The Growth Director enters Net Sales Quantity and Inwards Quantity for each planning row. All calculated fields (Gross Merchandise Value, Net Sales Value, Gross Margin, and others) update in real time. A system-suggested Inwards Quantity is shown as a reference for each row.',
    responsible: 'Growth Director',
  },
  {
    step: 5,
    title: 'Submit for Approval',
    description:
      'Once the Growth Director has completed the grid, they submit the plan. The cycle status moves to "In Review" and the approval chain begins.',
    responsible: 'Growth Director',
  },
  {
    step: 6,
    title: 'Approval Chain',
    description:
      'Finance and CXO review and approve the plan sequentially. Either approver can reject the plan and leave a comment, which returns it to the Growth Director for revision.',
    responsible: 'Finance, CXO',
  },
  {
    step: 7,
    title: 'Actuals Upload',
    description:
      'After the planning period closes, Planning or Admin uploads actual figures — Net Sales Quantity and Inwards Quantity — to record what actually happened versus the plan.',
    responsible: 'Admin, Planning',
  },
  {
    step: 8,
    title: 'Variance Review',
    description:
      'The platform computes the difference between planned and actual figures for key metrics. Variance is visible to all roles with the view variance permission.',
    responsible: 'All eligible roles',
  },
];

export const MASTER_DATA_FIELDS: MasterDataField[] = [
  {
    field: 'Brand',
    description: 'Top-level brand entity. Each planning cycle belongs to one brand.',
    managedBy: 'Admin',
  },
  {
    field: 'Sub-Brand',
    description: 'A product line within a brand.',
    managedBy: 'Admin, Planning',
  },
  {
    field: 'Wear Type',
    description: 'Broad product category (e.g., topwear, bottomwear).',
    managedBy: 'Admin, Planning',
  },
  {
    field: 'Sub-Category',
    description: 'A more specific product grouping within a Wear Type.',
    managedBy: 'Admin, Planning',
  },
  {
    field: 'Channel',
    description: 'Sales channel (e.g., direct-to-consumer, marketplace).',
    managedBy: 'Admin, Planning',
  },
  {
    field: 'Gender',
    description: 'Target gender segment for the product.',
    managedBy: 'Admin, Planning',
  },
];

export const DEFAULTS_FIELDS: DefaultField[] = [
  {
    field: 'Average Selling Price',
    description: 'Expected selling price per unit. Used to compute Gross Merchandise Value.',
    scopedBy: 'Sub-Brand × Sub-Category × Channel',
    editableBy: 'Admin, Planning',
  },
  {
    field: 'Cost of Goods Sold',
    description: 'Unit cost of inventory. Used to value stock and compute Gross Margin.',
    scopedBy: 'Sub-Brand × Sub-Category',
    editableBy: 'Admin, Planning',
  },
  {
    field: 'Return Percentage',
    description: 'Expected percentage of sold units returned. Reduces Net Sales Value.',
    scopedBy: 'Sub-Brand × Sub-Category × Channel',
    editableBy: 'Admin, Planning',
  },
  {
    field: 'Tax Percentage',
    description: 'Tax rate applied to Gross Merchandise Value. Reduces Net Sales Value.',
    scopedBy: 'Sub-Category',
    editableBy: 'Admin, Planning',
  },
  {
    field: 'Standard Days on Hand',
    description: 'Target inventory cover in days. Drives the Suggested Inwards calculation.',
    scopedBy: 'Sub-Brand × Sub-Category',
    editableBy: 'Admin, Planning',
  },
];

export const UPLOAD_INPUT_FIELDS: UploadInputField[] = [
  {
    field: 'Opening Stock Quantity',
    sourceFile: 'Opening Stock',
    description: 'Units on hand at the start of the planning period.',
    required: 'Yes',
  },
  {
    field: 'Last Year Net Sales Quantity',
    sourceFile: 'Last Year Sales',
    description: 'Actual units sold in the same period last year. Used for year-over-year comparison.',
    required: 'Yes',
  },
  {
    field: 'Recent Sales Net Sales Quantity',
    sourceFile: 'Recent Sales (3 months)',
    description: 'Actual units sold in the most recent three months. Used as a demand reference.',
    required: 'Yes',
  },
  {
    field: 'Soft Forecast',
    sourceFile: 'Soft Forecast',
    description: 'Optional forward-looking demand estimate provided by Planning.',
    required: 'No',
  },
  {
    field: 'Actuals — Net Sales Quantity',
    sourceFile: 'Actuals',
    description: 'Actual units sold during the plan period. Uploaded after the period closes for variance analysis.',
    required: 'Post-period',
  },
  {
    field: 'Actuals — Inwards Quantity',
    sourceFile: 'Actuals',
    description: 'Actual inwards received during the plan period. Uploaded after the period closes.',
    required: 'Post-period',
  },
];

export const GD_INPUT_FIELDS: GridField[] = [
  {
    field: 'Net Sales Quantity',
    description:
      'The number of units the Growth Director plans to sell in the month. This is the primary planning input — all value-based metrics derive from it.',
  },
  {
    field: 'Inwards Quantity',
    description:
      'The number of units planned to arrive (be received) in the month. Defaults to the Suggested Inwards value; the Growth Director can override it.',
  },
];

export const SYSTEM_POPULATED_FIELDS: SystemField[] = [
  { field: 'Opening Stock Quantity', source: 'Opening Stock upload' },
  { field: 'Last Year Net Sales Quantity', source: 'Last Year Sales upload' },
];

export const CALCULATED_FIELDS: CalculatedField[] = [
  {
    field: 'Net Sales Value',
    formula: 'Net Sales Quantity × Average Selling Price',
    description: 'Planned revenue from net sales units at the selling price.',
  },
  {
    field: 'Sales Plan Gross Merchandise Value',
    formula: 'Net Sales Value ÷ ((1 − Return Percentage) × (1 − Tax Percentage))',
    description: 'Gross revenue before returns and taxes, derived by grossing up Net Sales Value.',
  },
  {
    field: 'Growth Over Last Year Percentage',
    formula: '(Net Sales Quantity ÷ Last Year Net Sales Quantity) − 1',
    description: "Year-over-year growth of planned net sales quantity versus last year's actuals.",
  },
  {
    field: 'Inwards Value at Cost',
    formula: 'Inwards Quantity × Cost of Goods Sold',
    description: 'Total cost of planned inwards.',
  },
  {
    field: 'Opening Stock Value',
    formula: 'Opening Stock Quantity × Cost of Goods Sold',
    description: 'Value of opening inventory at cost.',
  },
  {
    field: 'Closing Stock Quantity',
    formula: 'Opening Stock Quantity + Inwards Quantity − Net Sales Quantity',
    description: 'Estimated units on hand at the end of the month.',
  },
  {
    field: 'Forward 30-Day Days on Hand',
    formula: 'Closing Stock Quantity ÷ (Next Month Net Sales Quantity ÷ 30)',
    description:
      'How many days of forward demand the closing stock covers, rounded to the nearest day.',
  },
  {
    field: 'Gross Margin Percentage',
    formula: '(Average Selling Price − Cost of Goods Sold) ÷ Average Selling Price × 100',
    description: 'Margin earned per unit as a percentage of selling price.',
  },
  {
    field: 'Gross Margin',
    formula: 'Net Sales Value × Gross Margin Percentage',
    description: 'Total gross margin in value terms.',
  },
];

export const SUGGESTED_FIELDS: CalculatedField[] = [
  {
    field: 'Suggested Inwards Quantity',
    formula:
      'max(0, round(Standard Days on Hand × Next Month Net Sales Quantity ÷ 30 − Opening Stock Quantity + Net Sales Quantity))',
    description:
      'System-recommended inwards to maintain the target Days on Hand cover. Shown alongside the editable Inwards Quantity field as a reference.',
  },
];

export const ROLE_DESCRIPTIONS: RoleDescription[] = [
  {
    role: 'Admin',
    description:
      'Full platform access. Manages users, master data, and can override any cycle state.',
  },
  {
    role: 'Planning',
    description:
      'Creates and manages cycles, uploads files, confirms defaults, and manages master data for assigned brands.',
  },
  {
    role: 'Growth Director',
    description:
      'Fills the planning grid for assigned cycles and submits plans for approval.',
  },
  {
    role: 'Finance',
    description: 'Reviews and approves submitted plans. Read access to all cycle data.',
  },
  {
    role: 'CXO',
    description: 'Reviews and approves submitted plans. Read access to all cycle data.',
  },
  {
    role: 'Read Only',
    description: 'Can view approved plans and variance data only. No write access.',
  },
];

// Derived from src/lib/auth/roles.ts — update here if roles.ts changes.
export const PERMISSION_ROWS: PermissionRow[] = [
  { label: 'View Cycle',               admin: true,  planning: true,  gd: true,  finance: true,  cxo: true,  readOnly: true  },
  { label: 'View Approved Plans',      admin: true,  planning: true,  gd: true,  finance: true,  cxo: true,  readOnly: true  },
  { label: 'View All Plans',           admin: true,  planning: true,  gd: true,  finance: true,  cxo: true,  readOnly: false },
  { label: 'View Variance',            admin: true,  planning: true,  gd: true,  finance: true,  cxo: true,  readOnly: true  },
  { label: 'Export Plan',              admin: true,  planning: true,  gd: true,  finance: true,  cxo: true,  readOnly: false },
  { label: 'Create Cycle',             admin: true,  planning: true,  gd: false, finance: false, cxo: false, readOnly: false },
  { label: 'Upload Data',              admin: true,  planning: true,  gd: false, finance: false, cxo: false, readOnly: false },
  { label: 'Assign Growth Director',   admin: true,  planning: true,  gd: false, finance: false, cxo: false, readOnly: false },
  { label: 'Manage Master Data',       admin: true,  planning: true,  gd: false, finance: false, cxo: false, readOnly: false },
  { label: 'Edit Plan (Grid)',          admin: true,  planning: false, gd: true,  finance: false, cxo: false, readOnly: false },
  { label: 'Submit Plan',              admin: true,  planning: false, gd: true,  finance: false, cxo: false, readOnly: false },
  { label: 'Approve Plan',             admin: true,  planning: true,  gd: true,  finance: true,  cxo: true,  readOnly: false },
  { label: 'Upload Actuals',           admin: true,  planning: true,  gd: false, finance: false, cxo: false, readOnly: false },
  { label: 'Request Reopen',           admin: true,  planning: false, gd: true,  finance: false, cxo: false, readOnly: false },
  { label: 'View Audit Logs',          admin: true,  planning: false, gd: false, finance: false, cxo: false, readOnly: false },
  { label: 'Manage Users',             admin: true,  planning: false, gd: false, finance: false, cxo: false, readOnly: false },
  { label: 'Admin Override',           admin: true,  planning: false, gd: false, finance: false, cxo: false, readOnly: false },
  { label: 'View Cross-Brand Summary', admin: true,  planning: false, gd: false, finance: false, cxo: false, readOnly: false },
];

// ─── Variance Report ──────────────────────────────────────────────────────────

export interface VarianceMetricDef {
  metric: string;
  unit: string;
  planValue: string;
  actualValue: string;
  aggregation: string;
  notes: string;
}

export const VARIANCE_METRIC_DEFS: VarianceMetricDef[] = [
  {
    metric: 'GMV',
    unit: '₹ Cr',
    planValue: 'sales_plan_gmv from plan grid',
    actualValue: 'Derived: actual NSV ÷ ((1 − Return%) × (1 − Tax%))',
    aggregation: 'Sum across all dimension rows for the month',
    notes: 'Flow metric — summed across all actuals months for Q Total.',
  },
  {
    metric: 'NSV',
    unit: '₹ Cr',
    planValue: 'nsv from plan grid',
    actualValue: 'Derived: actual NSQ × ASP',
    aggregation: 'Sum across all dimension rows for the month',
    notes: 'Flow metric — summed across all actuals months for Q Total.',
  },
  {
    metric: 'NSQ',
    unit: 'Units',
    planValue: 'nsq (GD input)',
    actualValue: 'actual_nsq from Actuals upload',
    aggregation: 'Sum across all dimension rows for the month',
    notes: 'Flow metric — summed across all actuals months for Q Total.',
  },
  {
    metric: 'Inwards',
    unit: 'Units',
    planValue: 'inwards_qty (GD input)',
    actualValue: 'actual_inwards_qty from Actuals upload',
    aggregation: 'Sum across all dimension rows for the month',
    notes: 'Flow metric — summed across all actuals months for Q Total.',
  },
  {
    metric: 'Closing Stock',
    unit: 'Units',
    planValue: 'closing_stock_qty from plan grid',
    actualValue: 'Derived: Opening Stock + actual Inwards − actual NSQ',
    aggregation: 'Sum across all dimension rows for the last actuals month only',
    notes: 'Snapshot metric — represents the stock position at a point in time, not a flow. Summing across multiple months would be meaningless. Q Total uses the last actuals month.',
  },
  {
    metric: 'DOH',
    unit: 'Days',
    planValue: 'fwd_30day_doh from plan grid',
    actualValue: 'Derived from actual closing stock and next-month actual NSQ',
    aggregation: 'sum(Closing Stock Qty for month M) ÷ (sum(NSQ for month M+1) ÷ 30)',
    notes: 'Uses next month NSQ as the forward sales rate, matching the per-row formula. For the last month of the quarter, current month NSQ is used as the denominator. Q Total uses closing stock of the last actuals month divided by NSQ of the following month.',
  },
];

export interface VarianceThresholdDef {
  metric: string;
  defaultThreshold: string;
  direction: string;
  description: string;
}

export const VARIANCE_THRESHOLD_DEFS: VarianceThresholdDef[] = [
  {
    metric: 'GMV',
    defaultThreshold: '±15%',
    direction: 'Higher is better',
    description: 'Green if within 15% of plan. Yellow or red if below plan by more than threshold.',
  },
  {
    metric: 'NSV',
    defaultThreshold: '±15%',
    direction: 'Higher is better',
    description: 'Green if within 15% of plan.',
  },
  {
    metric: 'NSQ',
    defaultThreshold: '±15%',
    direction: 'Higher is better',
    description: 'Green if within 15% of plan.',
  },
  {
    metric: 'Inwards',
    defaultThreshold: '±20%',
    direction: 'Lower is better',
    description: 'Actuals exceeding plan by more than threshold signal over-buying.',
  },
  {
    metric: 'Closing Stock',
    defaultThreshold: '±25%',
    direction: 'Lower is better',
    description: 'Actuals exceeding plan signal excess inventory build-up.',
  },
  {
    metric: 'DOH',
    defaultThreshold: '±20%',
    direction: 'Lower is better',
    description: 'Actuals exceeding plan signal stock cover is longer than planned.',
  },
];

export const VARIANCE_AGGREGATION_NOTES: string[] = [
  'Flow metrics (GMV, NSV, NSQ, Inwards) are summed across every dimension row × month combination shown in the table.',
  'Snapshot metrics (Closing Stock, DOH) are calculated only from the last actuals month to reflect the current stock position rather than a cumulative total.',
  'For Q Total, DOH = sum(Closing Stock of last actuals month) ÷ (sum(NSQ of the next planning month) ÷ 30). If the last actuals month is also the last planning month, current month NSQ is used.',
  'Sub-category breakdowns apply the same aggregation logic but scoped to rows matching that sub-category.',
  'RAG levels in the table are the worst level across all dimension rows included in the aggregation — if any row is red, the aggregated cell shows red.',
  'Thresholds are configurable per brand by Admin in the Variance Thresholds admin screen.',
];

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    term: 'Open-To-Buy',
    definition:
      'The process of planning how much inventory to purchase (inwards) in a future period to meet sales targets while maintaining healthy stock levels.',
  },
  {
    term: 'Cycle',
    definition:
      'A planning instance for one brand covering one quarter. Each cycle moves through a fixed status workflow from Draft to Approved.',
  },
  {
    term: 'Planning Period',
    definition: 'The set of months covered by a cycle, typically a full quarter.',
  },
  {
    term: 'Growth Director',
    definition:
      'The user role responsible for filling in the Net Sales Quantity and Inwards Quantity targets in the planning grid.',
  },
  {
    term: 'Net Sales Quantity',
    definition:
      'Units planned to be sold, after accounting for returns. The primary input entered by the Growth Director.',
  },
  {
    term: 'Net Sales Value',
    definition:
      'Net Sales Quantity × Average Selling Price. The net revenue figure used as the basis for deriving Gross Merchandise Value.',
  },
  {
    term: 'Gross Merchandise Value',
    definition:
      'Gross revenue before returns and taxes. Derived by grossing up Net Sales Value: NSV ÷ ((1 − Return%) × (1 − Tax%)).',
  },
  {
    term: 'Growth Over Last Year',
    definition:
      'Year-over-year percentage growth of planned Net Sales Quantity versus the same period last year.',
  },
  {
    term: 'Days on Hand',
    definition:
      'A measure of how many days of forward demand the current stock covers. Standard Days on Hand is the target set in master defaults.',
  },
  {
    term: 'Gross Margin',
    definition:
      'The value retained after deducting Cost of Goods Sold from Net Sales Value. Expressed as both a percentage and an absolute value.',
  },
  {
    term: 'Average Selling Price',
    definition:
      'The expected per-unit selling price used to convert quantity plans into revenue figures.',
  },
  {
    term: 'Cost of Goods Sold',
    definition: 'The per-unit cost of inventory, used to value stock and compute Gross Margin.',
  },
  {
    term: 'Inwards',
    definition: 'Inventory received into the warehouse (purchases).',
  },
  {
    term: 'Opening Stock',
    definition:
      "Units on hand at the start of a planning month, carried forward from the previous month's closing stock.",
  },
  {
    term: 'Closing Stock',
    definition:
      'Units on hand at the end of a planning month = Opening Stock + Inwards − Net Sales Quantity.',
  },
  {
    term: 'Actuals',
    definition:
      'Real sales and inwards figures uploaded after the planning period closes, used for variance analysis.',
  },
  {
    term: 'Variance',
    definition:
      'The difference between planned and actual figures for Net Sales Quantity, Inwards, and revenue metrics.',
  },
];
