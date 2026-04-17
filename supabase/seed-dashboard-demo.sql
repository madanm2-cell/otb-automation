-- ============================================================
-- Dashboard Demo Seed Data
-- Creates realistic OTB data for 4 brands across Q1 FY27:
--   2 Approved cycles (Bewakoof, TIGC)     -> Zone 2 + Zone 3
--   2 InReview cycles (Wrogn, Nobero)      -> Zone 1
-- Plus actuals for the Approved cycles     -> Zone 3 variance
-- ============================================================

-- 0. Clean up any existing demo data (idempotent)
DELETE FROM otb_actuals WHERE cycle_id IN (
  SELECT id FROM otb_cycles WHERE cycle_name LIKE 'Q1 FY27 Plan%'
);
DELETE FROM approval_tracking WHERE cycle_id IN (
  SELECT id FROM otb_cycles WHERE cycle_name LIKE 'Q1 FY27 Plan%'
);
DELETE FROM otb_plan_data WHERE row_id IN (
  SELECT r.id FROM otb_plan_rows r
  JOIN otb_cycles c ON r.cycle_id = c.id
  WHERE c.cycle_name LIKE 'Q1 FY27 Plan%'
);
DELETE FROM otb_plan_rows WHERE cycle_id IN (
  SELECT id FROM otb_cycles WHERE cycle_name LIKE 'Q1 FY27 Plan%'
);
DELETE FROM otb_cycles WHERE cycle_name LIKE 'Q1 FY27 Plan%';

-- Ensure brands exist
INSERT INTO brands (name) VALUES
  ('Bewakoof'), ('TIGC'), ('Wrogn'), ('Nobero')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 1. CREATE CYCLES
-- ============================================================

-- Bewakoof — Approved
INSERT INTO otb_cycles (id, cycle_name, brand_id, planning_quarter, planning_period_start, planning_period_end, status, defaults_confirmed)
SELECT
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'Q1 FY27 Plan — Bewakoof',
  b.id,
  'Q1 FY27',
  '2026-04-01', '2026-06-30',
  'Approved',
  true
FROM brands b WHERE b.name = 'Bewakoof'
ON CONFLICT DO NOTHING;

-- TIGC — Approved
INSERT INTO otb_cycles (id, cycle_name, brand_id, planning_quarter, planning_period_start, planning_period_end, status, defaults_confirmed)
SELECT
  'a0000000-0000-0000-0000-000000000002'::uuid,
  'Q1 FY27 Plan — TIGC',
  b.id,
  'Q1 FY27',
  '2026-04-01', '2026-06-30',
  'Approved',
  true
FROM brands b WHERE b.name = 'TIGC'
ON CONFLICT DO NOTHING;

-- Wrogn — InReview
INSERT INTO otb_cycles (id, cycle_name, brand_id, planning_quarter, planning_period_start, planning_period_end, status, defaults_confirmed)
SELECT
  'a0000000-0000-0000-0000-000000000003'::uuid,
  'Q1 FY27 Plan — Wrogn',
  b.id,
  'Q1 FY27',
  '2026-04-01', '2026-06-30',
  'InReview',
  true
FROM brands b WHERE b.name = 'Wrogn'
ON CONFLICT DO NOTHING;

-- Nobero — InReview
INSERT INTO otb_cycles (id, cycle_name, brand_id, planning_quarter, planning_period_start, planning_period_end, status, defaults_confirmed)
SELECT
  'a0000000-0000-0000-0000-000000000004'::uuid,
  'Q1 FY27 Plan — Nobero',
  b.id,
  'Q1 FY27',
  '2026-04-01', '2026-06-30',
  'InReview',
  true
FROM brands b WHERE b.name = 'Nobero'
ON CONFLICT DO NOTHING;


-- ============================================================
-- 2. PLAN ROWS (dimension combos per cycle)
-- ============================================================

-- ---- Bewakoof (6 rows) ----
INSERT INTO otb_plan_rows (id, cycle_id, sub_brand, wear_type, sub_category, gender, channel) VALUES
  ('b0000000-0000-0000-0001-000000000001', 'a0000000-0000-0000-0000-000000000001', 'bewakoof', 'NWW', 'T-Shirts', 'Male', 'myntra_sor'),
  ('b0000000-0000-0000-0001-000000000002', 'a0000000-0000-0000-0000-000000000001', 'bewakoof', 'NWW', 'T-Shirts', 'Female', 'myntra_sor'),
  ('b0000000-0000-0000-0001-000000000003', 'a0000000-0000-0000-0000-000000000001', 'bewakoof', 'NWW', 'Joggers', 'Male', 'flipkart_sor'),
  ('b0000000-0000-0000-0001-000000000004', 'a0000000-0000-0000-0000-000000000001', 'bewakoof air', 'NWW', 'Shorts', 'Male', 'amazon_cocoblu'),
  ('b0000000-0000-0000-0001-000000000005', 'a0000000-0000-0000-0000-000000000001', 'bewakoof', 'WW', 'Hoodies', 'Unisex', 'unicommerce'),
  ('b0000000-0000-0000-0001-000000000006', 'a0000000-0000-0000-0000-000000000001', 'bewakoof heavy duty', 'NWW', 'Jeans', 'Male', 'Offline')
ON CONFLICT DO NOTHING;

-- ---- TIGC (5 rows) ----
INSERT INTO otb_plan_rows (id, cycle_id, sub_brand, wear_type, sub_category, gender, channel) VALUES
  ('b0000000-0000-0000-0002-000000000001', 'a0000000-0000-0000-0000-000000000002', 'TIGC', 'NWW', 'Shirts', 'Male', 'shoppers stop'),
  ('b0000000-0000-0000-0002-000000000002', 'a0000000-0000-0000-0000-000000000002', 'TIGC', 'NWW', 'Trousers', 'Male', 'shoppers stop'),
  ('b0000000-0000-0000-0002-000000000003', 'a0000000-0000-0000-0000-000000000002', 'TIGC', 'NWW', 'Blazers', 'Male', 'Offline'),
  ('b0000000-0000-0000-0002-000000000004', 'a0000000-0000-0000-0000-000000000002', 'TIGC', 'NWW', 'T-Shirts', 'Male', 'myntra_sor'),
  ('b0000000-0000-0000-0002-000000000005', 'a0000000-0000-0000-0000-000000000002', 'TIGC', 'WW', 'Jackets', 'Male', 'flipkart_sor')
ON CONFLICT DO NOTHING;

-- ---- Wrogn (5 rows) ----
INSERT INTO otb_plan_rows (id, cycle_id, sub_brand, wear_type, sub_category, gender, channel) VALUES
  ('b0000000-0000-0000-0003-000000000001', 'a0000000-0000-0000-0000-000000000003', 'Wrogn', 'NWW', 'T-Shirts', 'Male', 'myntra_sor'),
  ('b0000000-0000-0000-0003-000000000002', 'a0000000-0000-0000-0000-000000000003', 'Wrogn', 'NWW', 'Jeans', 'Male', 'flipkart_sor'),
  ('b0000000-0000-0000-0003-000000000003', 'a0000000-0000-0000-0000-000000000003', 'Wrogn', 'NWW', 'Joggers', 'Male', 'amazon_cocoblu'),
  ('b0000000-0000-0000-0003-000000000004', 'a0000000-0000-0000-0000-000000000003', 'Wrogn', 'NWW', 'Shorts', 'Unisex', 'unicommerce'),
  ('b0000000-0000-0000-0003-000000000005', 'a0000000-0000-0000-0000-000000000003', 'Wrogn', 'WW', 'Sweatshirts', 'Male', 'Offline')
ON CONFLICT DO NOTHING;

-- ---- Nobero (4 rows) ----
INSERT INTO otb_plan_rows (id, cycle_id, sub_brand, wear_type, sub_category, gender, channel) VALUES
  ('b0000000-0000-0000-0004-000000000001', 'a0000000-0000-0000-0000-000000000004', 'Nobero', 'NWW', 'T-Shirts', 'Male', 'myntra_sor'),
  ('b0000000-0000-0000-0004-000000000002', 'a0000000-0000-0000-0000-000000000004', 'Nobero', 'NWW', 'Joggers', 'Male', 'amazon_cocoblu'),
  ('b0000000-0000-0000-0004-000000000003', 'a0000000-0000-0000-0000-000000000004', 'Nobero', 'NWW', 'Pyjamas', 'Male', 'flipkart_sor'),
  ('b0000000-0000-0000-0004-000000000004', 'a0000000-0000-0000-0000-000000000004', 'Nobero', 'NWW', 'Shorts', 'Male', 'Offline')
ON CONFLICT DO NOTHING;


-- ============================================================
-- 3. PLAN DATA (3 months x each row — Apr, May, Jun 2026)
--    Realistic fashion-brand OTB values
--    NOTE: cm1/cm2 are percentages (numeric(8,2)), ly_sales_nsq is int quantity
-- ============================================================

-- ---- Bewakoof Plan Data (6 rows x 3 months = 18 records) ----

-- Row 1: bewakoof / T-Shirts / Male / myntra_sor (top seller)
-- cm1 = gm_pct - return_pct - tax_pct = 42.1 - 12.5 - 5.0 = 24.60
-- cm2 = cm1 - sellex_pct = 24.60 - 5.0 = 19.60
INSERT INTO otb_plan_data (row_id, month, asp, cogs, opening_stock_qty, nsq, inwards_qty, sales_plan_gmv, nsv, inwards_val_cogs, closing_stock_qty, fwd_30day_doh, gm_pct, gross_margin, cm1, cm2, return_pct, tax_pct, sellex_pct, ly_sales_nsq) VALUES
  ('b0000000-0000-0000-0001-000000000001', '2026-04-01', 799, 280, 12000, 8500, 6000, 6791500, 5297370, 1680000, 9500, 33.5, 42.1, 2835170, 24.60, 19.60, 12.5, 5.0, 5.0, 7200),
  ('b0000000-0000-0000-0001-000000000001', '2026-05-01', 799, 280, 9500, 9200, 7000, 7349800, 5732844, 1960000, 7300, 23.8, 42.1, 3068344, 24.60, 19.60, 12.5, 5.0, 5.0, 7800),
  ('b0000000-0000-0000-0001-000000000001', '2026-06-01', 799, 280, 7300, 8800, 6500, 7031200, 5484336, 1820000, 5000, 17.0, 42.1, 2932336, 24.60, 19.60, 12.5, 5.0, 5.0, 7500)
ON CONFLICT (row_id, month) DO NOTHING;

-- Row 2: bewakoof / T-Shirts / Female / myntra_sor
-- cm1 = 41.8 - 12.5 - 5.0 = 24.30, cm2 = 24.30 - 5.0 = 19.30
INSERT INTO otb_plan_data (row_id, month, asp, cogs, opening_stock_qty, nsq, inwards_qty, sales_plan_gmv, nsv, inwards_val_cogs, closing_stock_qty, fwd_30day_doh, gm_pct, gross_margin, cm1, cm2, return_pct, tax_pct, sellex_pct, ly_sales_nsq) VALUES
  ('b0000000-0000-0000-0001-000000000002', '2026-04-01', 699, 245, 5000, 3500, 2500, 2446500, 1908270, 612500, 4000, 34.3, 41.8, 973270, 24.30, 19.30, 12.5, 5.0, 5.0, 3000),
  ('b0000000-0000-0000-0001-000000000002', '2026-05-01', 699, 245, 4000, 3800, 3000, 2656200, 2071836, 735000, 3200, 25.3, 41.8, 1056336, 24.30, 19.30, 12.5, 5.0, 5.0, 3200),
  ('b0000000-0000-0000-0001-000000000002', '2026-06-01', 699, 245, 3200, 3600, 2800, 2516400, 1962792, 686000, 2400, 20.0, 41.8, 998792, 24.30, 19.30, 12.5, 5.0, 5.0, 3100)
ON CONFLICT (row_id, month) DO NOTHING;

-- Row 3: bewakoof / Joggers / Male / flipkart_sor
-- cm1 = 40.5 - 10.0 - 5.0 = 25.50, cm2 = 25.50 - 5.0 = 20.50
INSERT INTO otb_plan_data (row_id, month, asp, cogs, opening_stock_qty, nsq, inwards_qty, sales_plan_gmv, nsv, inwards_val_cogs, closing_stock_qty, fwd_30day_doh, gm_pct, gross_margin, cm1, cm2, return_pct, tax_pct, sellex_pct, ly_sales_nsq) VALUES
  ('b0000000-0000-0000-0001-000000000003', '2026-04-01', 999, 350, 6000, 4200, 3000, 4195800, 3272724, 1050000, 4800, 34.3, 40.5, 1620724, 25.50, 20.50, 10.0, 5.0, 5.0, 3600),
  ('b0000000-0000-0000-0001-000000000003', '2026-05-01', 999, 350, 4800, 4500, 3500, 4495500, 3506490, 1225000, 3800, 25.3, 40.5, 1738990, 25.50, 20.50, 10.0, 5.0, 5.0, 3800),
  ('b0000000-0000-0000-0001-000000000003', '2026-06-01', 999, 350, 3800, 4300, 3200, 4295700, 3350646, 1120000, 2700, 18.8, 40.5, 1660646, 25.50, 20.50, 10.0, 5.0, 5.0, 3700)
ON CONFLICT (row_id, month) DO NOTHING;

-- Row 4: bewakoof air / Shorts / Male / amazon_cocoblu
-- cm1 = 44.2 - 8.0 - 5.0 = 31.20, cm2 = 31.20 - 5.0 = 26.20
INSERT INTO otb_plan_data (row_id, month, asp, cogs, opening_stock_qty, nsq, inwards_qty, sales_plan_gmv, nsv, inwards_val_cogs, closing_stock_qty, fwd_30day_doh, gm_pct, gross_margin, cm1, cm2, return_pct, tax_pct, sellex_pct, ly_sales_nsq) VALUES
  ('b0000000-0000-0000-0001-000000000004', '2026-04-01', 599, 210, 3000, 2200, 1500, 1317800, 1027884, 315000, 2300, 31.4, 44.2, 592284, 31.20, 26.20, 8.0, 5.0, 5.0, 1900),
  ('b0000000-0000-0000-0001-000000000004', '2026-05-01', 599, 210, 2300, 2500, 2000, 1497500, 1168050, 420000, 1800, 21.6, 44.2, 673050, 31.20, 26.20, 8.0, 5.0, 5.0, 2100),
  ('b0000000-0000-0000-0001-000000000004', '2026-06-01', 599, 210, 1800, 2400, 1800, 1437600, 1121328, 378000, 1200, 15.0, 44.2, 646328, 31.20, 26.20, 8.0, 5.0, 5.0, 2000)
ON CONFLICT (row_id, month) DO NOTHING;

-- Row 5: bewakoof / Hoodies / Unisex / unicommerce
-- cm1 = 45.3 - 7.0 - 5.0 = 33.30, cm2 = 33.30 - 5.0 = 28.30
INSERT INTO otb_plan_data (row_id, month, asp, cogs, opening_stock_qty, nsq, inwards_qty, sales_plan_gmv, nsv, inwards_val_cogs, closing_stock_qty, fwd_30day_doh, gm_pct, gross_margin, cm1, cm2, return_pct, tax_pct, sellex_pct, ly_sales_nsq) VALUES
  ('b0000000-0000-0000-0001-000000000005', '2026-04-01', 1299, 450, 2000, 1200, 800, 1558800, 1215864, 360000, 1600, 40.0, 45.3, 705864, 33.30, 28.30, 7.0, 5.0, 5.0, 1100),
  ('b0000000-0000-0000-0001-000000000005', '2026-05-01', 1299, 450, 1600, 1000, 600, 1299000, 1013220, 270000, 1200, 36.0, 45.3, 588220, 33.30, 28.30, 7.0, 5.0, 5.0, 900),
  ('b0000000-0000-0000-0001-000000000005', '2026-06-01', 1299, 450, 1200, 800, 500, 1039200, 810576, 225000, 900, 33.8, 45.3, 470576, 33.30, 28.30, 7.0, 5.0, 5.0, 700)
ON CONFLICT (row_id, month) DO NOTHING;

-- Row 6: bewakoof heavy duty / Jeans / Male / Offline
-- cm1 = 43.8 - 5.0 - 5.0 = 33.80, cm2 = 33.80 - 5.0 = 28.80
INSERT INTO otb_plan_data (row_id, month, asp, cogs, opening_stock_qty, nsq, inwards_qty, sales_plan_gmv, nsv, inwards_val_cogs, closing_stock_qty, fwd_30day_doh, gm_pct, gross_margin, cm1, cm2, return_pct, tax_pct, sellex_pct, ly_sales_nsq) VALUES
  ('b0000000-0000-0000-0001-000000000006', '2026-04-01', 1499, 525, 4000, 2800, 2000, 4197200, 3273816, 1050000, 3200, 34.3, 43.8, 1821816, 33.80, 28.80, 5.0, 5.0, 5.0, 2400),
  ('b0000000-0000-0000-0001-000000000006', '2026-05-01', 1499, 525, 3200, 3000, 2200, 4497000, 3507660, 1155000, 2400, 24.0, 43.8, 1955160, 33.80, 28.80, 5.0, 5.0, 5.0, 2600),
  ('b0000000-0000-0000-0001-000000000006', '2026-06-01', 1499, 525, 2400, 2900, 2100, 4347100, 3390738, 1102500, 1600, 16.6, 43.8, 1893238, 33.80, 28.80, 5.0, 5.0, 5.0, 2500)
ON CONFLICT (row_id, month) DO NOTHING;


-- ---- TIGC Plan Data (5 rows x 3 months = 15 records) ----

-- Row 1: TIGC / Shirts / Male / shoppers stop (top seller)
-- cm1 = 46.5 - 5.0 - 5.0 = 36.50, cm2 = 36.50 - 5.0 = 31.50
INSERT INTO otb_plan_data (row_id, month, asp, cogs, opening_stock_qty, nsq, inwards_qty, sales_plan_gmv, nsv, inwards_val_cogs, closing_stock_qty, fwd_30day_doh, gm_pct, gross_margin, cm1, cm2, return_pct, tax_pct, sellex_pct, ly_sales_nsq) VALUES
  ('b0000000-0000-0000-0002-000000000001', '2026-04-01', 2499, 875, 3000, 1800, 1200, 4498200, 3508596, 1050000, 2400, 40.0, 46.5, 2154096, 36.50, 31.50, 5.0, 5.0, 5.0, 1500),
  ('b0000000-0000-0000-0002-000000000001', '2026-05-01', 2499, 875, 2400, 2000, 1500, 4998000, 3898440, 1312500, 1900, 28.5, 46.5, 2393940, 36.50, 31.50, 5.0, 5.0, 5.0, 1700),
  ('b0000000-0000-0000-0002-000000000001', '2026-06-01', 2499, 875, 1900, 1900, 1400, 4748100, 3703518, 1225000, 1400, 22.1, 46.5, 2275018, 36.50, 31.50, 5.0, 5.0, 5.0, 1600)
ON CONFLICT (row_id, month) DO NOTHING;

-- Row 2: TIGC / Trousers / Male / shoppers stop
-- cm1 = 44.2 - 5.0 - 5.0 = 34.20, cm2 = 34.20 - 5.0 = 29.20
INSERT INTO otb_plan_data (row_id, month, asp, cogs, opening_stock_qty, nsq, inwards_qty, sales_plan_gmv, nsv, inwards_val_cogs, closing_stock_qty, fwd_30day_doh, gm_pct, gross_margin, cm1, cm2, return_pct, tax_pct, sellex_pct, ly_sales_nsq) VALUES
  ('b0000000-0000-0000-0002-000000000002', '2026-04-01', 1999, 700, 2500, 1500, 1000, 2998500, 2338830, 700000, 2000, 40.0, 44.2, 1338830, 34.20, 29.20, 5.0, 5.0, 5.0, 1300),
  ('b0000000-0000-0000-0002-000000000002', '2026-05-01', 1999, 700, 2000, 1600, 1200, 3198400, 2494752, 840000, 1600, 30.0, 44.2, 1430752, 34.20, 29.20, 5.0, 5.0, 5.0, 1400),
  ('b0000000-0000-0000-0002-000000000002', '2026-06-01', 1999, 700, 1600, 1500, 1100, 2998500, 2338830, 770000, 1200, 24.0, 44.2, 1338830, 34.20, 29.20, 5.0, 5.0, 5.0, 1300)
ON CONFLICT (row_id, month) DO NOTHING;

-- Row 3: TIGC / Blazers / Male / Offline
-- cm1 = 48.0 - 3.0 - 5.0 = 40.00, cm2 = 40.00 - 5.0 = 35.00
INSERT INTO otb_plan_data (row_id, month, asp, cogs, opening_stock_qty, nsq, inwards_qty, sales_plan_gmv, nsv, inwards_val_cogs, closing_stock_qty, fwd_30day_doh, gm_pct, gross_margin, cm1, cm2, return_pct, tax_pct, sellex_pct, ly_sales_nsq) VALUES
  ('b0000000-0000-0000-0002-000000000003', '2026-04-01', 4999, 1750, 800, 500, 350, 2499500, 1949610, 612500, 650, 39.0, 48.0, 1287110, 40.00, 35.00, 3.0, 5.0, 5.0, 420),
  ('b0000000-0000-0000-0002-000000000003', '2026-05-01', 4999, 1750, 650, 450, 300, 2249550, 1754649, 525000, 500, 33.3, 48.0, 1158399, 40.00, 35.00, 3.0, 5.0, 5.0, 380),
  ('b0000000-0000-0000-0002-000000000003', '2026-06-01', 4999, 1750, 500, 400, 280, 1999600, 1559688, 490000, 380, 28.5, 48.0, 1029688, 40.00, 35.00, 3.0, 5.0, 5.0, 340)
ON CONFLICT (row_id, month) DO NOTHING;

-- Row 4: TIGC / T-Shirts / Male / myntra_sor
-- cm1 = 44.8 - 10.0 - 5.0 = 29.80, cm2 = 29.80 - 5.0 = 24.80
INSERT INTO otb_plan_data (row_id, month, asp, cogs, opening_stock_qty, nsq, inwards_qty, sales_plan_gmv, nsv, inwards_val_cogs, closing_stock_qty, fwd_30day_doh, gm_pct, gross_margin, cm1, cm2, return_pct, tax_pct, sellex_pct, ly_sales_nsq) VALUES
  ('b0000000-0000-0000-0002-000000000004', '2026-04-01', 1299, 455, 2000, 1200, 800, 1558800, 1215864, 364000, 1600, 40.0, 44.8, 851864, 29.80, 24.80, 10.0, 5.0, 5.0, 1000),
  ('b0000000-0000-0000-0002-000000000004', '2026-05-01', 1299, 455, 1600, 1400, 1000, 1818600, 1418508, 455000, 1200, 25.7, 44.8, 963508, 29.80, 24.80, 10.0, 5.0, 5.0, 1200),
  ('b0000000-0000-0000-0002-000000000004', '2026-06-01', 1299, 455, 1200, 1300, 900, 1688700, 1317186, 409500, 800, 18.5, 44.8, 907686, 29.80, 24.80, 10.0, 5.0, 5.0, 1100)
ON CONFLICT (row_id, month) DO NOTHING;

-- Row 5: TIGC / Jackets / Male / flipkart_sor
-- cm1 = 47.0 - 8.0 - 5.0 = 34.00, cm2 = 34.00 - 5.0 = 29.00
INSERT INTO otb_plan_data (row_id, month, asp, cogs, opening_stock_qty, nsq, inwards_qty, sales_plan_gmv, nsv, inwards_val_cogs, closing_stock_qty, fwd_30day_doh, gm_pct, gross_margin, cm1, cm2, return_pct, tax_pct, sellex_pct, ly_sales_nsq) VALUES
  ('b0000000-0000-0000-0002-000000000005', '2026-04-01', 3499, 1225, 600, 350, 250, 1224650, 955347, 306250, 500, 42.9, 47.0, 598097, 34.00, 29.00, 8.0, 5.0, 5.0, 300),
  ('b0000000-0000-0000-0002-000000000005', '2026-05-01', 3499, 1225, 500, 300, 200, 1049700, 818766, 245000, 400, 40.0, 47.0, 512016, 34.00, 29.00, 8.0, 5.0, 5.0, 250),
  ('b0000000-0000-0000-0002-000000000005', '2026-06-01', 3499, 1225, 400, 280, 200, 979720, 764182, 245000, 320, 34.3, 47.0, 478432, 34.00, 29.00, 8.0, 5.0, 5.0, 240)
ON CONFLICT (row_id, month) DO NOTHING;


-- ---- Wrogn Plan Data (5 rows x 3 months = 15 records) ----

-- Row 1: Wrogn / T-Shirts / Male / myntra_sor
-- cm1 = 41.0 - 12.0 - 5.0 = 24.00, cm2 = 24.00 - 5.0 = 19.00
INSERT INTO otb_plan_data (row_id, month, asp, cogs, opening_stock_qty, nsq, inwards_qty, sales_plan_gmv, nsv, inwards_val_cogs, closing_stock_qty, fwd_30day_doh, gm_pct, gross_margin, cm1, cm2, return_pct, tax_pct, sellex_pct, ly_sales_nsq) VALUES
  ('b0000000-0000-0000-0003-000000000001', '2026-04-01', 899, 315, 8000, 5500, 4000, 4944500, 3856710, 1260000, 6500, 35.5, 41.0, 2080210, 24.00, 19.00, 12.0, 5.0, 5.0, 4700),
  ('b0000000-0000-0000-0003-000000000001', '2026-05-01', 899, 315, 6500, 6000, 4500, 5394000, 4207320, 1417500, 5000, 25.0, 41.0, 2269820, 24.00, 19.00, 12.0, 5.0, 5.0, 5100),
  ('b0000000-0000-0000-0003-000000000001', '2026-06-01', 899, 315, 5000, 5800, 4200, 5214200, 4067076, 1323000, 3400, 17.6, 41.0, 2195576, 24.00, 19.00, 12.0, 5.0, 5.0, 4900)
ON CONFLICT (row_id, month) DO NOTHING;

-- Row 2: Wrogn / Jeans / Male / flipkart_sor
-- cm1 = 43.2 - 8.0 - 5.0 = 30.20, cm2 = 30.20 - 5.0 = 25.20
INSERT INTO otb_plan_data (row_id, month, asp, cogs, opening_stock_qty, nsq, inwards_qty, sales_plan_gmv, nsv, inwards_val_cogs, closing_stock_qty, fwd_30day_doh, gm_pct, gross_margin, cm1, cm2, return_pct, tax_pct, sellex_pct, ly_sales_nsq) VALUES
  ('b0000000-0000-0000-0003-000000000002', '2026-04-01', 1599, 560, 4000, 2500, 1800, 3997500, 3118050, 1008000, 3300, 39.6, 43.2, 1758050, 30.20, 25.20, 8.0, 5.0, 5.0, 2100),
  ('b0000000-0000-0000-0003-000000000002', '2026-05-01', 1599, 560, 3300, 2700, 2000, 4317300, 3367494, 1120000, 2600, 28.9, 43.2, 1899494, 30.20, 25.20, 8.0, 5.0, 5.0, 2300),
  ('b0000000-0000-0000-0003-000000000002', '2026-06-01', 1599, 560, 2600, 2600, 1900, 4157400, 3242772, 1064000, 1900, 21.9, 43.2, 1830772, 30.20, 25.20, 8.0, 5.0, 5.0, 2200)
ON CONFLICT (row_id, month) DO NOTHING;

-- Row 3: Wrogn / Joggers / Male / amazon_cocoblu
-- cm1 = 42.5 - 10.0 - 5.0 = 27.50, cm2 = 27.50 - 5.0 = 22.50
INSERT INTO otb_plan_data (row_id, month, asp, cogs, opening_stock_qty, nsq, inwards_qty, sales_plan_gmv, nsv, inwards_val_cogs, closing_stock_qty, fwd_30day_doh, gm_pct, gross_margin, cm1, cm2, return_pct, tax_pct, sellex_pct, ly_sales_nsq) VALUES
  ('b0000000-0000-0000-0003-000000000003', '2026-04-01', 1099, 385, 3500, 2000, 1500, 2198000, 1714440, 577500, 3000, 45.0, 42.5, 888940, 27.50, 22.50, 10.0, 5.0, 5.0, 1700),
  ('b0000000-0000-0000-0003-000000000003', '2026-05-01', 1099, 385, 3000, 2200, 1800, 2417800, 1885884, 693000, 2600, 35.5, 42.5, 977884, 27.50, 22.50, 10.0, 5.0, 5.0, 1900),
  ('b0000000-0000-0000-0003-000000000003', '2026-06-01', 1099, 385, 2600, 2100, 1600, 2307900, 1800162, 616000, 2100, 30.0, 42.5, 933162, 27.50, 22.50, 10.0, 5.0, 5.0, 1800)
ON CONFLICT (row_id, month) DO NOTHING;

-- Row 4: Wrogn / Shorts / Unisex / unicommerce
-- cm1 = 44.0 - 7.0 - 5.0 = 32.00, cm2 = 32.00 - 5.0 = 27.00
INSERT INTO otb_plan_data (row_id, month, asp, cogs, opening_stock_qty, nsq, inwards_qty, sales_plan_gmv, nsv, inwards_val_cogs, closing_stock_qty, fwd_30day_doh, gm_pct, gross_margin, cm1, cm2, return_pct, tax_pct, sellex_pct, ly_sales_nsq) VALUES
  ('b0000000-0000-0000-0003-000000000004', '2026-04-01', 699, 245, 2000, 1500, 1000, 1048500, 817830, 245000, 1500, 30.0, 44.0, 572830, 32.00, 27.00, 7.0, 5.0, 5.0, 1300),
  ('b0000000-0000-0000-0003-000000000004', '2026-05-01', 699, 245, 1500, 1700, 1200, 1188300, 926876, 294000, 1000, 17.6, 44.0, 632876, 32.00, 27.00, 7.0, 5.0, 5.0, 1450),
  ('b0000000-0000-0000-0003-000000000004', '2026-06-01', 699, 245, 1000, 1600, 1100, 1118400, 872352, 269500, 500, 9.4, 44.0, 602852, 32.00, 27.00, 7.0, 5.0, 5.0, 1350)
ON CONFLICT (row_id, month) DO NOTHING;

-- Row 5: Wrogn / Sweatshirts / Male / Offline
-- cm1 = 44.5 - 5.0 - 5.0 = 34.50, cm2 = 34.50 - 5.0 = 29.50
INSERT INTO otb_plan_data (row_id, month, asp, cogs, opening_stock_qty, nsq, inwards_qty, sales_plan_gmv, nsv, inwards_val_cogs, closing_stock_qty, fwd_30day_doh, gm_pct, gross_margin, cm1, cm2, return_pct, tax_pct, sellex_pct, ly_sales_nsq) VALUES
  ('b0000000-0000-0000-0003-000000000005', '2026-04-01', 1499, 525, 1500, 800, 500, 1199200, 935376, 262500, 1200, 45.0, 44.5, 517876, 34.50, 29.50, 5.0, 5.0, 5.0, 680),
  ('b0000000-0000-0000-0003-000000000005', '2026-05-01', 1499, 525, 1200, 700, 400, 1049300, 818454, 210000, 900, 38.6, 44.5, 453454, 34.50, 29.50, 5.0, 5.0, 5.0, 600),
  ('b0000000-0000-0000-0003-000000000005', '2026-06-01', 1499, 525, 900, 600, 350, 899400, 701532, 183750, 650, 32.5, 44.5, 389032, 34.50, 29.50, 5.0, 5.0, 5.0, 510)
ON CONFLICT (row_id, month) DO NOTHING;


-- ---- Nobero Plan Data (4 rows x 3 months = 12 records) ----

-- Row 1: Nobero / T-Shirts / Male / myntra_sor
-- cm1 = 43.5 - 12.0 - 5.0 = 26.50, cm2 = 26.50 - 5.0 = 21.50
INSERT INTO otb_plan_data (row_id, month, asp, cogs, opening_stock_qty, nsq, inwards_qty, sales_plan_gmv, nsv, inwards_val_cogs, closing_stock_qty, fwd_30day_doh, gm_pct, gross_margin, cm1, cm2, return_pct, tax_pct, sellex_pct, ly_sales_nsq) VALUES
  ('b0000000-0000-0000-0004-000000000001', '2026-04-01', 599, 210, 6000, 4000, 3000, 2396000, 1868880, 630000, 5000, 37.5, 43.5, 1068880, 26.50, 21.50, 12.0, 5.0, 5.0, 3400),
  ('b0000000-0000-0000-0004-000000000001', '2026-05-01', 599, 210, 5000, 4500, 3500, 2695500, 2102490, 735000, 4000, 26.7, 43.5, 1205490, 26.50, 21.50, 12.0, 5.0, 5.0, 3800),
  ('b0000000-0000-0000-0004-000000000001', '2026-06-01', 599, 210, 4000, 4200, 3200, 2515800, 1962324, 672000, 3000, 21.4, 43.5, 1122324, 26.50, 21.50, 12.0, 5.0, 5.0, 3600)
ON CONFLICT (row_id, month) DO NOTHING;

-- Row 2: Nobero / Joggers / Male / amazon_cocoblu
-- cm1 = 43.0 - 10.0 - 5.0 = 28.00, cm2 = 28.00 - 5.0 = 23.00
INSERT INTO otb_plan_data (row_id, month, asp, cogs, opening_stock_qty, nsq, inwards_qty, sales_plan_gmv, nsv, inwards_val_cogs, closing_stock_qty, fwd_30day_doh, gm_pct, gross_margin, cm1, cm2, return_pct, tax_pct, sellex_pct, ly_sales_nsq) VALUES
  ('b0000000-0000-0000-0004-000000000002', '2026-04-01', 799, 280, 3000, 2000, 1500, 1598000, 1246440, 420000, 2500, 37.5, 43.0, 826440, 28.00, 23.00, 10.0, 5.0, 5.0, 1700),
  ('b0000000-0000-0000-0004-000000000002', '2026-05-01', 799, 280, 2500, 2200, 1800, 1757800, 1371084, 504000, 2100, 28.6, 43.0, 911084, 28.00, 23.00, 10.0, 5.0, 5.0, 1900),
  ('b0000000-0000-0000-0004-000000000002', '2026-06-01', 799, 280, 2100, 2100, 1600, 1677900, 1308762, 448000, 1600, 22.9, 43.0, 868762, 28.00, 23.00, 10.0, 5.0, 5.0, 1800)
ON CONFLICT (row_id, month) DO NOTHING;

-- Row 3: Nobero / Pyjamas / Male / flipkart_sor
-- cm1 = 44.8 - 8.0 - 5.0 = 31.80, cm2 = 31.80 - 5.0 = 26.80
INSERT INTO otb_plan_data (row_id, month, asp, cogs, opening_stock_qty, nsq, inwards_qty, sales_plan_gmv, nsv, inwards_val_cogs, closing_stock_qty, fwd_30day_doh, gm_pct, gross_margin, cm1, cm2, return_pct, tax_pct, sellex_pct, ly_sales_nsq) VALUES
  ('b0000000-0000-0000-0004-000000000003', '2026-04-01', 499, 175, 4000, 3000, 2000, 1497000, 1167660, 350000, 3000, 30.0, 44.8, 817660, 31.80, 26.80, 8.0, 5.0, 5.0, 2500),
  ('b0000000-0000-0000-0004-000000000003', '2026-05-01', 499, 175, 3000, 3500, 2500, 1746500, 1362270, 437500, 2000, 17.1, 44.8, 954270, 31.80, 26.80, 8.0, 5.0, 5.0, 3000),
  ('b0000000-0000-0000-0004-000000000003', '2026-06-01', 499, 175, 2000, 3200, 2200, 1596800, 1245504, 385000, 1000, 9.4, 44.8, 872504, 31.80, 26.80, 8.0, 5.0, 5.0, 2700)
ON CONFLICT (row_id, month) DO NOTHING;

-- Row 4: Nobero / Shorts / Male / Offline
-- cm1 = 46.0 - 5.0 - 5.0 = 36.00, cm2 = 36.00 - 5.0 = 31.00
INSERT INTO otb_plan_data (row_id, month, asp, cogs, opening_stock_qty, nsq, inwards_qty, sales_plan_gmv, nsv, inwards_val_cogs, closing_stock_qty, fwd_30day_doh, gm_pct, gross_margin, cm1, cm2, return_pct, tax_pct, sellex_pct, ly_sales_nsq) VALUES
  ('b0000000-0000-0000-0004-000000000004', '2026-04-01', 399, 140, 2000, 1500, 1000, 598500, 466830, 140000, 1500, 30.0, 46.0, 326830, 36.00, 31.00, 5.0, 5.0, 5.0, 1300),
  ('b0000000-0000-0000-0004-000000000004', '2026-05-01', 399, 140, 1500, 1800, 1300, 718200, 560196, 182000, 1000, 16.7, 46.0, 392196, 36.00, 31.00, 5.0, 5.0, 5.0, 1500),
  ('b0000000-0000-0000-0004-000000000004', '2026-06-01', 399, 140, 1000, 1600, 1100, 638400, 497952, 154000, 500, 9.4, 46.0, 348952, 36.00, 31.00, 5.0, 5.0, 5.0, 1350)
ON CONFLICT (row_id, month) DO NOTHING;


-- ============================================================
-- 4. APPROVAL TRACKING
--    InReview cycles get partial approvals
--    Approved cycles get all 4 approvals
-- ============================================================

-- Bewakoof (Approved) — all 4 roles approved
INSERT INTO approval_tracking (cycle_id, role, status, comment, decided_at) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Planning', 'Approved', 'Numbers look solid for Q1.', now() - interval '5 days'),
  ('a0000000-0000-0000-0000-000000000001', 'GD', 'Approved', 'Inwards plan aligned with warehouse capacity.', now() - interval '4 days'),
  ('a0000000-0000-0000-0000-000000000001', 'Finance', 'Approved', 'Margins meet target thresholds.', now() - interval '3 days'),
  ('a0000000-0000-0000-0000-000000000001', 'CXO', 'Approved', 'Approved. Execute as planned.', now() - interval '2 days')
ON CONFLICT (cycle_id, role) DO NOTHING;

-- TIGC (Approved) — all 4 roles approved
INSERT INTO approval_tracking (cycle_id, role, status, comment, decided_at) VALUES
  ('a0000000-0000-0000-0000-000000000002', 'Planning', 'Approved', 'Category mix is healthy.', now() - interval '6 days'),
  ('a0000000-0000-0000-0000-000000000002', 'GD', 'Approved', 'Stock levels acceptable.', now() - interval '5 days'),
  ('a0000000-0000-0000-0000-000000000002', 'Finance', 'Approved', 'Blazer segment slightly below GM target but overall good.', now() - interval '4 days'),
  ('a0000000-0000-0000-0000-000000000002', 'CXO', 'Approved', 'Good to go.', now() - interval '3 days')
ON CONFLICT (cycle_id, role) DO NOTHING;

-- Wrogn (InReview) — Planning + GD approved, Finance + CXO pending
INSERT INTO approval_tracking (cycle_id, role, status, comment, decided_at) VALUES
  ('a0000000-0000-0000-0000-000000000003', 'Planning', 'Approved', 'Plan is comprehensive.', now() - interval '2 days'),
  ('a0000000-0000-0000-0000-000000000003', 'GD', 'Approved', 'Inwards timing confirmed with supply chain.', now() - interval '1 day'),
  ('a0000000-0000-0000-0000-000000000003', 'Finance', 'Pending', NULL, NULL),
  ('a0000000-0000-0000-0000-000000000003', 'CXO', 'Pending', NULL, NULL)
ON CONFLICT (cycle_id, role) DO NOTHING;

-- Nobero (InReview) — only Planning approved
INSERT INTO approval_tracking (cycle_id, role, status, comment, decided_at) VALUES
  ('a0000000-0000-0000-0000-000000000004', 'Planning', 'Approved', 'Initial review complete.', now() - interval '1 day'),
  ('a0000000-0000-0000-0000-000000000004', 'GD', 'Pending', NULL, NULL),
  ('a0000000-0000-0000-0000-000000000004', 'Finance', 'Pending', NULL, NULL),
  ('a0000000-0000-0000-0000-000000000004', 'CXO', 'Pending', NULL, NULL)
ON CONFLICT (cycle_id, role) DO NOTHING;


-- ============================================================
-- 5. ACTUALS DATA (for Approved cycles only — Zone 3 variance)
--    Actuals differ from plan by +/-5-20% to create interesting variances
-- ============================================================

-- ---- Bewakoof Actuals (6 rows x 3 months = 18 records) ----

-- Row 1: T-Shirts Male myntra_sor (slightly above plan)
INSERT INTO otb_actuals (cycle_id, sub_brand, wear_type, sub_category, gender, channel, month, actual_nsq, actual_inwards_qty, actual_gmv, actual_nsv, actual_closing_stock_qty, actual_doh, actual_gm_pct) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'bewakoof', 'NWW', 'T-Shirts', 'Male', 'myntra_sor', '2026-04-01', 9100, 5800, 7270900, 5671302, 8700, 28.7, 43.5),
  ('a0000000-0000-0000-0000-000000000001', 'bewakoof', 'NWW', 'T-Shirts', 'Male', 'myntra_sor', '2026-05-01', 8800, 7200, 7031200, 5484336, 7100, 24.2, 41.8),
  ('a0000000-0000-0000-0000-000000000001', 'bewakoof', 'NWW', 'T-Shirts', 'Male', 'myntra_sor', '2026-06-01', 9500, 6200, 7590500, 5920590, 3800, 12.0, 44.0)
ON CONFLICT (cycle_id, sub_brand, wear_type, sub_category, gender, channel, month) DO NOTHING;

-- Row 2: T-Shirts Female myntra_sor (below plan — weaker women's category)
INSERT INTO otb_actuals (cycle_id, sub_brand, wear_type, sub_category, gender, channel, month, actual_nsq, actual_inwards_qty, actual_gmv, actual_nsv, actual_closing_stock_qty, actual_doh, actual_gm_pct) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'bewakoof', 'NWW', 'T-Shirts', 'Female', 'myntra_sor', '2026-04-01', 2800, 2600, 1957200, 1526616, 4800, 51.4, 38.5),
  ('a0000000-0000-0000-0000-000000000001', 'bewakoof', 'NWW', 'T-Shirts', 'Female', 'myntra_sor', '2026-05-01', 3200, 3100, 2236800, 1744704, 4700, 44.1, 39.2),
  ('a0000000-0000-0000-0000-000000000001', 'bewakoof', 'NWW', 'T-Shirts', 'Female', 'myntra_sor', '2026-06-01', 3100, 2900, 2166900, 1690182, 4500, 43.5, 39.0)
ON CONFLICT (cycle_id, sub_brand, wear_type, sub_category, gender, channel, month) DO NOTHING;

-- Row 3: Joggers Male flipkart_sor (close to plan)
INSERT INTO otb_actuals (cycle_id, sub_brand, wear_type, sub_category, gender, channel, month, actual_nsq, actual_inwards_qty, actual_gmv, actual_nsv, actual_closing_stock_qty, actual_doh, actual_gm_pct) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'bewakoof', 'NWW', 'Joggers', 'Male', 'flipkart_sor', '2026-04-01', 4100, 3100, 4095900, 3194802, 5000, 36.6, 41.0),
  ('a0000000-0000-0000-0000-000000000001', 'bewakoof', 'NWW', 'Joggers', 'Male', 'flipkart_sor', '2026-05-01', 4700, 3400, 4695300, 3662334, 3700, 23.6, 40.8),
  ('a0000000-0000-0000-0000-000000000001', 'bewakoof', 'NWW', 'Joggers', 'Male', 'flipkart_sor', '2026-06-01', 4000, 3300, 3996000, 3116880, 3000, 22.5, 39.5)
ON CONFLICT (cycle_id, sub_brand, wear_type, sub_category, gender, channel, month) DO NOTHING;

-- Row 4: Shorts Male amazon (above plan — summer boost)
INSERT INTO otb_actuals (cycle_id, sub_brand, wear_type, sub_category, gender, channel, month, actual_nsq, actual_inwards_qty, actual_gmv, actual_nsv, actual_closing_stock_qty, actual_doh, actual_gm_pct) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'bewakoof air', 'NWW', 'Shorts', 'Male', 'amazon_cocoblu', '2026-04-01', 2600, 1400, 1557400, 1214772, 1900, 21.9, 45.8),
  ('a0000000-0000-0000-0000-000000000001', 'bewakoof air', 'NWW', 'Shorts', 'Male', 'amazon_cocoblu', '2026-05-01', 3000, 1900, 1797000, 1401660, 900, 9.0, 46.2),
  ('a0000000-0000-0000-0000-000000000001', 'bewakoof air', 'NWW', 'Shorts', 'Male', 'amazon_cocoblu', '2026-06-01', 2800, 2000, 1677200, 1308216, 100, 1.1, 45.0)
ON CONFLICT (cycle_id, sub_brand, wear_type, sub_category, gender, channel, month) DO NOTHING;

-- Row 5: Hoodies Unisex unicommerce (below plan — summer slump)
INSERT INTO otb_actuals (cycle_id, sub_brand, wear_type, sub_category, gender, channel, month, actual_nsq, actual_inwards_qty, actual_gmv, actual_nsv, actual_closing_stock_qty, actual_doh, actual_gm_pct) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'bewakoof', 'WW', 'Hoodies', 'Unisex', 'unicommerce', '2026-04-01', 900, 850, 1169100, 911898, 1950, 65.0, 42.0),
  ('a0000000-0000-0000-0000-000000000001', 'bewakoof', 'WW', 'Hoodies', 'Unisex', 'unicommerce', '2026-05-01', 700, 650, 909300, 709254, 1900, 81.4, 40.5),
  ('a0000000-0000-0000-0000-000000000001', 'bewakoof', 'WW', 'Hoodies', 'Unisex', 'unicommerce', '2026-06-01', 500, 500, 649500, 506610, 1900, 114.0, 38.0)
ON CONFLICT (cycle_id, sub_brand, wear_type, sub_category, gender, channel, month) DO NOTHING;

-- Row 6: Jeans Male Offline (close to plan)
INSERT INTO otb_actuals (cycle_id, sub_brand, wear_type, sub_category, gender, channel, month, actual_nsq, actual_inwards_qty, actual_gmv, actual_nsv, actual_closing_stock_qty, actual_doh, actual_gm_pct) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'bewakoof heavy duty', 'NWW', 'Jeans', 'Male', 'Offline', '2026-04-01', 2700, 2100, 4047300, 3156894, 3400, 37.8, 43.0),
  ('a0000000-0000-0000-0000-000000000001', 'bewakoof heavy duty', 'NWW', 'Jeans', 'Male', 'Offline', '2026-05-01', 3100, 2100, 4646900, 3624582, 2400, 23.2, 44.0),
  ('a0000000-0000-0000-0000-000000000001', 'bewakoof heavy duty', 'NWW', 'Jeans', 'Male', 'Offline', '2026-06-01', 2800, 2200, 4197200, 3273816, 1800, 19.3, 43.5)
ON CONFLICT (cycle_id, sub_brand, wear_type, sub_category, gender, channel, month) DO NOTHING;


-- ---- TIGC Actuals (5 rows x 3 months = 15 records) ----

-- Row 1: Shirts Male shoppers stop (slightly below plan)
INSERT INTO otb_actuals (cycle_id, sub_brand, wear_type, sub_category, gender, channel, month, actual_nsq, actual_inwards_qty, actual_gmv, actual_nsv, actual_closing_stock_qty, actual_doh, actual_gm_pct) VALUES
  ('a0000000-0000-0000-0000-000000000002', 'TIGC', 'NWW', 'Shirts', 'Male', 'shoppers stop', '2026-04-01', 1650, 1250, 4123350, 3216214, 2600, 47.3, 45.0),
  ('a0000000-0000-0000-0000-000000000002', 'TIGC', 'NWW', 'Shirts', 'Male', 'shoppers stop', '2026-05-01', 1850, 1550, 4623150, 3606057, 2300, 37.3, 44.8),
  ('a0000000-0000-0000-0000-000000000002', 'TIGC', 'NWW', 'Shirts', 'Male', 'shoppers stop', '2026-06-01', 1800, 1450, 4498200, 3508596, 1950, 32.5, 45.2)
ON CONFLICT (cycle_id, sub_brand, wear_type, sub_category, gender, channel, month) DO NOTHING;

-- Row 2: Trousers Male shoppers stop (above plan)
INSERT INTO otb_actuals (cycle_id, sub_brand, wear_type, sub_category, gender, channel, month, actual_nsq, actual_inwards_qty, actual_gmv, actual_nsv, actual_closing_stock_qty, actual_doh, actual_gm_pct) VALUES
  ('a0000000-0000-0000-0000-000000000002', 'TIGC', 'NWW', 'Trousers', 'Male', 'shoppers stop', '2026-04-01', 1600, 1050, 3198400, 2494752, 1950, 36.6, 45.0),
  ('a0000000-0000-0000-0000-000000000002', 'TIGC', 'NWW', 'Trousers', 'Male', 'shoppers stop', '2026-05-01', 1700, 1250, 3398300, 2650674, 1500, 26.5, 44.5),
  ('a0000000-0000-0000-0000-000000000002', 'TIGC', 'NWW', 'Trousers', 'Male', 'shoppers stop', '2026-06-01', 1600, 1150, 3198400, 2494752, 1050, 19.7, 44.8)
ON CONFLICT (cycle_id, sub_brand, wear_type, sub_category, gender, channel, month) DO NOTHING;

-- Row 3: Blazers Male Offline (significantly below — weaker formal demand)
INSERT INTO otb_actuals (cycle_id, sub_brand, wear_type, sub_category, gender, channel, month, actual_nsq, actual_inwards_qty, actual_gmv, actual_nsv, actual_closing_stock_qty, actual_doh, actual_gm_pct) VALUES
  ('a0000000-0000-0000-0000-000000000002', 'TIGC', 'NWW', 'Blazers', 'Male', 'Offline', '2026-04-01', 380, 370, 1899620, 1481703, 790, 62.4, 44.0),
  ('a0000000-0000-0000-0000-000000000002', 'TIGC', 'NWW', 'Blazers', 'Male', 'Offline', '2026-05-01', 340, 310, 1699660, 1325735, 760, 67.1, 43.0),
  ('a0000000-0000-0000-0000-000000000002', 'TIGC', 'NWW', 'Blazers', 'Male', 'Offline', '2026-06-01', 300, 290, 1499700, 1169766, 750, 75.0, 42.5)
ON CONFLICT (cycle_id, sub_brand, wear_type, sub_category, gender, channel, month) DO NOTHING;

-- Row 4: T-Shirts Male myntra_sor (close to plan)
INSERT INTO otb_actuals (cycle_id, sub_brand, wear_type, sub_category, gender, channel, month, actual_nsq, actual_inwards_qty, actual_gmv, actual_nsv, actual_closing_stock_qty, actual_doh, actual_gm_pct) VALUES
  ('a0000000-0000-0000-0000-000000000002', 'TIGC', 'NWW', 'T-Shirts', 'Male', 'myntra_sor', '2026-04-01', 1250, 780, 1623750, 1266525, 1530, 36.7, 45.5),
  ('a0000000-0000-0000-0000-000000000002', 'TIGC', 'NWW', 'T-Shirts', 'Male', 'myntra_sor', '2026-05-01', 1350, 1050, 1753650, 1367847, 1230, 27.4, 44.5),
  ('a0000000-0000-0000-0000-000000000002', 'TIGC', 'NWW', 'T-Shirts', 'Male', 'myntra_sor', '2026-06-01', 1350, 880, 1753650, 1367847, 760, 16.9, 45.0)
ON CONFLICT (cycle_id, sub_brand, wear_type, sub_category, gender, channel, month) DO NOTHING;

-- Row 5: Jackets Male flipkart_sor (below plan — off-season)
INSERT INTO otb_actuals (cycle_id, sub_brand, wear_type, sub_category, gender, channel, month, actual_nsq, actual_inwards_qty, actual_gmv, actual_nsv, actual_closing_stock_qty, actual_doh, actual_gm_pct) VALUES
  ('a0000000-0000-0000-0000-000000000002', 'TIGC', 'WW', 'Jackets', 'Male', 'flipkart_sor', '2026-04-01', 250, 260, 874750, 682305, 610, 73.2, 43.0),
  ('a0000000-0000-0000-0000-000000000002', 'TIGC', 'WW', 'Jackets', 'Male', 'flipkart_sor', '2026-05-01', 200, 210, 699800, 545844, 620, 93.0, 42.0),
  ('a0000000-0000-0000-0000-000000000002', 'TIGC', 'WW', 'Jackets', 'Male', 'flipkart_sor', '2026-06-01', 180, 200, 629820, 491260, 640, 106.7, 41.0)
ON CONFLICT (cycle_id, sub_brand, wear_type, sub_category, gender, channel, month) DO NOTHING;


-- ============================================================
-- DONE. Summary of seeded data:
-- ============================================================
-- Brands: 4 (Bewakoof, TIGC, Wrogn, Nobero)
-- Cycles: 4 (2 Approved, 2 InReview)
-- Plan rows: 20 total (6+5+5+4)
-- Plan data: 60 records (20 rows x 3 months)
-- Approval tracking: 16 records (4 per cycle)
-- Actuals: 33 records (18 Bewakoof + 15 TIGC)
-- ============================================================
