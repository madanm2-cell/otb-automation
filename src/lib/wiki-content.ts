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
    field: 'Sales Plan Gross Merchandise Value',
    formula: 'Net Sales Quantity × Average Selling Price',
    description: 'Total planned revenue before any deductions.',
  },
  {
    field: 'Growth Over Last Year Percentage',
    formula: '(Sales Plan Gross Merchandise Value ÷ Last Year Gross Merchandise Value) − 1',
    description: "Year-over-year growth of planned sales versus last year's actuals.",
  },
  {
    field: 'Net Sales Value',
    formula: 'Gross Merchandise Value × (1 − Return Percentage) × (1 − Tax Percentage)',
    description: 'Revenue after returns and tax deductions.',
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
    term: 'Gross Merchandise Value',
    definition:
      'Total planned revenue = Net Sales Quantity × Average Selling Price, before any deductions.',
  },
  {
    term: 'Net Sales Value',
    definition: 'Revenue after returns and tax are deducted from Gross Merchandise Value.',
  },
  {
    term: 'Growth Over Last Year',
    definition:
      'Year-over-year percentage growth of planned Gross Merchandise Value versus the same period last year.',
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
