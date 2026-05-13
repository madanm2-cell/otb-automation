# Wiki / Explainer Page — Design

**Date:** 2026-05-13
**Status:** Approved

## Overview

Add a dedicated `/wiki` page to the OTB Automation platform that serves as a reference document for all users. The page explains the end-to-end OTB planning process, all fields in the system, and the user roles and permission model.

## Goals

- Reference-only: definitions, formulas, and process steps — not an onboarding flow
- Accessible to all roles via the sidebar nav
- Static content (no API calls, no database reads)
- No search; accordion-style navigation with a sticky right-side table of contents

## Non-Goals

- Onboarding walkthroughs or step-by-step guided tours (deferred)
- Contextual inline help / tooltips on existing pages (deferred)
- Mobile-optimised layout

---

## Layout

**Route:** `/wiki`

**Sidebar nav entry:** "Wiki" with `BookOutlined` icon, added to `AppLayout.tsx`. Visible to all roles.

**Two-column desktop layout:**
- **Main content area (flex-1):** Ant Design `Collapse` component with top-level accordion panels, each containing structured content
- **Right sticky sidebar (240px):** Ant Design `Anchor` component — "On this page" table of contents with links to each major section and key sub-sections; highlights the active section as the user scrolls

**Components used:** `Collapse`, `Typography`, `Table`, `Tag`, `Anchor` (all from Ant Design 6, already installed)

---

## Content Sections

### Panel 1 — OTB Process

A numbered walkthrough of the end-to-end planning cycle. Each step shows:
- Step number and title
- What happens in this step
- Who is responsible

| Step | Title | Description | Responsible |
|------|-------|-------------|-------------|
| 1 | Create Cycle | Admin or Planning creates a new cycle for a brand and quarter, assigns a Growth Director, and sets fill and approval deadlines | Admin / Planning |
| 2 | Upload Reference Files | Planning uploads the required files: Opening Stock, Last Year Sales, Recent Sales (3 months). Soft Forecast is optional. | Admin / Planning |
| 3 | Confirm Defaults | Planning reviews and confirms the per-row default values (Average Selling Price, Cost of Goods Sold, Return Percentage, Tax Percentage, Standard Days on Hand) seeded from master defaults. The Growth Director cannot begin editing until defaults are confirmed. | Admin / Planning |
| 4 | Growth Director Fills the Grid | Growth Director enters Net Sales Quantity and Inwards Quantity for each planning row. All calculated fields update in real time. | Growth Director |
| 5 | Submit for Approval | Growth Director submits the completed plan. Cycle status moves to "In Review". | Growth Director |
| 6 | Approval Chain | Finance and CXO approve sequentially. Any approver can reject and leave a comment, which returns the cycle for revision. | Finance, CXO |
| 7 | Actuals Upload | After the planning period closes, Planning or Admin uploads actual figures (Net Sales Quantity and Inwards Quantity) to record what actually happened. | Admin / Planning |
| 8 | Variance Review | The platform computes plan-versus-actuals variance. Visible to all roles that have the view variance permission. | All eligible roles |

---

### Panel 2 — Field Reference

Organised into four sub-sections within the panel.

#### 2a. Master Data (Reference Dimensions)

Structural dimensions that define the planning hierarchy. Managed by Admin and Planning in the Master Data admin screen.

| Field | Description | Managed By |
|-------|-------------|------------|
| Brand | Top-level brand entity. Each planning cycle belongs to one brand. | Admin |
| Sub-Brand | A product line within a brand (e.g., a sub-label or range). | Admin / Planning |
| Wear Type | Broad product category (e.g., topwear, bottomwear). | Admin / Planning |
| Sub-Category | A more specific product grouping within a Wear Type. | Admin / Planning |
| Channel | Sales channel (e.g., direct-to-consumer, marketplace). | Admin / Planning |
| Gender | Target gender segment for the product. | Admin / Planning |

#### 2b. Defaults

Per-row reference values that seed the planning grid before the Growth Director begins editing. Sourced from master defaults; Planning can override them during the Confirm Defaults step.

| Field | Description | Scoped By | Editable By |
|-------|-------------|-----------|-------------|
| Average Selling Price | The expected selling price per unit, used to compute Gross Merchandise Value. | Sub-Brand × Sub-Category × Channel | Admin / Planning |
| Cost of Goods Sold | The unit cost, used to compute stock values and Gross Margin. | Sub-Brand × Sub-Category | Admin / Planning |
| Return Percentage | Expected percentage of sold units that will be returned; reduces Net Sales Value. | Sub-Brand × Sub-Category × Channel | Admin / Planning |
| Tax Percentage | Tax rate applied to Gross Merchandise Value; reduces Net Sales Value. | Sub-Category | Admin / Planning |
| Standard Days on Hand | Target inventory cover (in days); drives the Suggested Inwards calculation. | Sub-Brand × Sub-Category | Admin / Planning |

#### 2c. Upload Inputs

Data that enters the system through file uploads before the planning grid is generated.

| Field | Source File | Description | Required |
|-------|-------------|-------------|----------|
| Opening Stock Quantity | Opening Stock | Units on hand at the start of the planning period. | Yes |
| Last Year Net Sales Quantity | Last Year Sales | Actual units sold in the same period last year; used for year-over-year comparison. | Yes |
| Recent Sales Net Sales Quantity | Recent Sales (3 months) | Actual units sold in the most recent three months; used as a demand reference. | Yes |
| Soft Forecast | Soft Forecast | An optional forward-looking demand estimate provided by Planning. | No |
| Actuals — Net Sales Quantity | Actuals | Actual units sold during the plan period; uploaded after the period closes for variance analysis. | Post-period |
| Actuals — Inwards Quantity | Actuals | Actual inwards received during the plan period; uploaded after the period closes. | Post-period |

#### 2d. Grid Fields

All columns visible in the planning grid, organised by type.

**Growth Director Inputs (editable in the grid):**

| Field | Description |
|-------|-------------|
| Net Sales Quantity | The number of units the Growth Director plans to sell in the month. This is the primary planning input; all value-based metrics derive from it. |
| Inwards Quantity | The number of units planned to arrive (be purchased/received) in the month. Defaults to the Suggested Inwards value; Growth Director can override. |

**System-Populated (read-only, pre-filled from uploads):**

| Field | Source |
|-------|--------|
| Opening Stock Quantity | Opening Stock upload |
| Last Year Net Sales Quantity | Last Year Sales upload |

**Calculated Fields (read-only, auto-computed):**

| Field | Formula | Description |
|-------|---------|-------------|
| Sales Plan Gross Merchandise Value | Net Sales Quantity × Average Selling Price | Total planned revenue before deductions. |
| Growth Over Last Year Percentage | (Sales Plan Gross Merchandise Value ÷ Last Year Gross Merchandise Value) − 1 | Year-over-year growth of the planned sales versus last year's actuals. |
| Net Sales Value | Gross Merchandise Value × (1 − Return Percentage) × (1 − Tax Percentage) | Revenue after returns and tax. |
| Inwards Value at Cost | Inwards Quantity × Cost of Goods Sold | Total cost of planned inwards. |
| Opening Stock Value | Opening Stock Quantity × Cost of Goods Sold | Value of opening inventory at cost. |
| Closing Stock Quantity | Opening Stock Quantity + Inwards Quantity − Net Sales Quantity | Estimated units on hand at end of month. |
| Forward 30-Day Days on Hand | Closing Stock Quantity ÷ (Next Month Net Sales Quantity ÷ 30) | How many days of forward demand the closing stock covers, rounded to the nearest day. |
| Gross Margin Percentage | (Average Selling Price − Cost of Goods Sold) ÷ Average Selling Price × 100 | Margin earned per unit as a percentage of selling price. |
| Gross Margin | Net Sales Value × Gross Margin Percentage | Total gross margin in value terms. |

**Suggested Inwards (system recommendation, shown alongside Inwards Quantity):**

| Field | Formula | Description |
|-------|---------|-------------|
| Suggested Inwards Quantity | max(0, round(Standard Days on Hand × Next Month Net Sales Quantity ÷ 30 − Opening Stock Quantity + Net Sales Quantity)) | System-recommended inwards to maintain the target Days on Hand cover. Growth Director sees this as a reference and may accept or override it. |

---

### Panel 3 — Roles and Permissions

Each user is assigned one role. Roles are set by Admin and determine what actions a user can take across all brands they are assigned to.

**Role descriptions:**

| Role | Description |
|------|-------------|
| Admin | Full platform access. Manages users, master data, and can override any cycle state. |
| Planning | Creates and manages cycles, uploads files, confirms defaults, and manages master data for assigned brands. |
| Growth Director | Fills the planning grid for assigned cycles and submits plans for approval. |
| Finance | Reviews and approves submitted plans. Read access to all cycle data. |
| CXO | Reviews and approves submitted plans. Read access to all cycle data. |
| Read Only | Can view approved plans and variance data only. No write access. |

**Permission matrix:**

| Permission | Admin | Planning | Growth Director | Finance | CXO | Read Only |
|------------|:-----:|:--------:|:---------------:|:-------:|:---:|:---------:|
| View cycle | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View approved plans | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View all plans | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| View variance | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Export plan | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Create cycle | ✓ | ✓ | — | — | — | — |
| Upload data | ✓ | ✓ | — | — | — | — |
| Assign Growth Director | ✓ | ✓ | — | — | — | — |
| Manage master data | ✓ | ✓ | — | — | — | — |
| Edit plan (grid) | ✓ | — | ✓ | — | — | — |
| Submit plan | ✓ | — | ✓ | — | — | — |
| Approve plan | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Upload actuals | ✓ | ✓ | — | — | — | — |
| Request reopen | ✓ | — | ✓ | — | — | — |
| View audit logs | ✓ | — | — | — | — | — |
| Manage users | ✓ | — | — | — | — | — |
| Admin override | ✓ | — | — | — | — | — |

---

### Panel 4 — Glossary

Key terms used throughout the platform.

| Term | Definition |
|------|------------|
| Open-To-Buy | The process of planning how much inventory to purchase (inwards) in a future period to meet sales targets while maintaining healthy stock levels. |
| Cycle | A planning instance for one brand covering one quarter. Each cycle moves through a fixed status workflow from Draft to Approved. |
| Planning Period | The set of months covered by a cycle, typically a full quarter. |
| Growth Director | The user role responsible for filling in the Net Sales Quantity and Inwards Quantity targets in the planning grid. |
| Net Sales Quantity | Units planned to be sold, after accounting for returns. The primary input entered by the Growth Director. |
| Gross Merchandise Value | Total planned revenue = Net Sales Quantity × Average Selling Price, before any deductions. |
| Net Sales Value | Revenue after returns and tax are deducted from Gross Merchandise Value. |
| Growth Over Last Year | Year-over-year percentage growth of planned Gross Merchandise Value versus the same period last year. |
| Days on Hand | A measure of how many days of forward demand the current stock covers. Standard Days on Hand is the target set in master defaults. |
| Gross Margin | The value retained after deducting Cost of Goods Sold from Net Sales Value. Expressed both as a percentage and an absolute value. |
| Average Selling Price | The expected per-unit selling price used to convert quantity plans into revenue figures. |
| Cost of Goods Sold | The per-unit cost of inventory, used to value stock and compute Gross Margin. |
| Inwards | Inventory received into the warehouse (purchases). |
| Opening Stock | Units on hand at the start of a planning month, carried forward from the previous month's closing stock. |
| Closing Stock | Units on hand at the end of a planning month = Opening Stock + Inwards − Net Sales Quantity. |
| Actuals | Real sales and inwards figures uploaded after the planning period closes, used for variance analysis. |
| Variance | The difference between planned and actual figures for Net Sales Quantity, Inwards, and revenue metrics. |

---

## File Structure

```
src/
  app/
    wiki/
      page.tsx                  # Wiki page (client component)
  components/
    wiki/
      PermissionMatrix.tsx      # Roles × permissions table
      ProcessSteps.tsx          # Numbered OTB process steps
  lib/
    wiki-content.ts             # All static wiki content as typed data
```

**Modified:**
- `src/components/AppLayout.tsx` — add "Wiki" nav item

---

## Design Reference

Visual patterns drawn from `/Users/madan.m2/Desktop/Claude Projects/otb-automation` — specifically the `/help` page layout, `HelpTOC` sticky sidebar, and `FormulaBlock` card style, adapted to Ant Design 6 components.
