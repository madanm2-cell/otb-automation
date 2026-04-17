-- Seed master defaults for Bewakoof brand
-- Run AFTER fix_wear_type_ids.sql
-- Values are realistic for Indian fashion e-commerce

-- Get Bewakoof brand_id
DO $$
DECLARE
  bk_id uuid;
BEGIN
  SELECT id INTO bk_id FROM brands WHERE name = 'Bewakoof';

  -- ============================================================
  -- 1. TAX % (by sub_category only — GST rates)
  -- ============================================================
  INSERT INTO master_default_tax_pct (brand_id, sub_category, tax_pct) VALUES
    (bk_id, 't-shirts', 5),
    (bk_id, 'jeans', 12),
    (bk_id, 'joggers', 5),
    (bk_id, 'shorts', 5),
    (bk_id, 'shirts', 5),
    (bk_id, 'pyjamas', 5)
  ON CONFLICT (brand_id, sub_category) DO UPDATE SET tax_pct = EXCLUDED.tax_pct;

  -- ============================================================
  -- 2. COGS (by sub_brand x sub_category)
  -- ============================================================
  INSERT INTO master_default_cogs (brand_id, sub_brand, sub_category, cogs) VALUES
    -- bewakoof
    (bk_id, 'bewakoof', 't-shirts', 180),
    (bk_id, 'bewakoof', 'jeans', 380),
    (bk_id, 'bewakoof', 'joggers', 280),
    (bk_id, 'bewakoof', 'shorts', 160),
    (bk_id, 'bewakoof', 'shirts', 220),
    (bk_id, 'bewakoof', 'pyjamas', 200),
    -- bewakoof air
    (bk_id, 'bewakoof air', 't-shirts', 220),
    (bk_id, 'bewakoof air', 'jeans', 420),
    (bk_id, 'bewakoof air', 'joggers', 320),
    (bk_id, 'bewakoof air', 'shorts', 190),
    -- bewakoof heavy duty
    (bk_id, 'bewakoof heavy duty', 't-shirts', 280),
    (bk_id, 'bewakoof heavy duty', 'jeans', 480),
    (bk_id, 'bewakoof heavy duty', 'joggers', 380)
  ON CONFLICT (brand_id, sub_brand, sub_category) DO UPDATE SET cogs = EXCLUDED.cogs;

  -- ============================================================
  -- 3. STANDARD DOH (by sub_brand x sub_category)
  -- ============================================================
  INSERT INTO master_default_doh (brand_id, sub_brand, sub_category, doh) VALUES
    -- bewakoof (faster turns)
    (bk_id, 'bewakoof', 't-shirts', 35),
    (bk_id, 'bewakoof', 'jeans', 55),
    (bk_id, 'bewakoof', 'joggers', 45),
    (bk_id, 'bewakoof', 'shorts', 40),
    (bk_id, 'bewakoof', 'shirts', 50),
    (bk_id, 'bewakoof', 'pyjamas', 60),
    -- bewakoof air (premium, slower turns)
    (bk_id, 'bewakoof air', 't-shirts', 45),
    (bk_id, 'bewakoof air', 'jeans', 65),
    (bk_id, 'bewakoof air', 'joggers', 55),
    (bk_id, 'bewakoof air', 'shorts', 50),
    -- bewakoof heavy duty (slowest)
    (bk_id, 'bewakoof heavy duty', 't-shirts', 60),
    (bk_id, 'bewakoof heavy duty', 'jeans', 75),
    (bk_id, 'bewakoof heavy duty', 'joggers', 65)
  ON CONFLICT (brand_id, sub_brand, sub_category) DO UPDATE SET doh = EXCLUDED.doh;

  -- ============================================================
  -- 4. ASP (by sub_brand x sub_category x channel)
  -- Marketplace channels have higher ASP (MRP-driven), D2C/Offline lower
  -- ============================================================
  INSERT INTO master_default_asp (brand_id, sub_brand, sub_category, channel, asp) VALUES
    -- bewakoof
    (bk_id, 'bewakoof', 't-shirts', 'myntra_sor', 599),
    (bk_id, 'bewakoof', 't-shirts', 'amazon_cocoblu', 549),
    (bk_id, 'bewakoof', 't-shirts', 'flipkart_sor', 549),
    (bk_id, 'bewakoof', 't-shirts', 'offline', 499),
    (bk_id, 'bewakoof', 't-shirts', 'others', 449),
    (bk_id, 'bewakoof', 'jeans', 'myntra_sor', 1099),
    (bk_id, 'bewakoof', 'jeans', 'amazon_cocoblu', 999),
    (bk_id, 'bewakoof', 'jeans', 'flipkart_sor', 999),
    (bk_id, 'bewakoof', 'jeans', 'offline', 899),
    (bk_id, 'bewakoof', 'jeans', 'others', 849),
    (bk_id, 'bewakoof', 'joggers', 'myntra_sor', 799),
    (bk_id, 'bewakoof', 'joggers', 'amazon_cocoblu', 749),
    (bk_id, 'bewakoof', 'joggers', 'flipkart_sor', 749),
    (bk_id, 'bewakoof', 'joggers', 'offline', 699),
    (bk_id, 'bewakoof', 'joggers', 'others', 649),
    (bk_id, 'bewakoof', 'shorts', 'myntra_sor', 549),
    (bk_id, 'bewakoof', 'shorts', 'amazon_cocoblu', 499),
    (bk_id, 'bewakoof', 'shorts', 'flipkart_sor', 499),
    (bk_id, 'bewakoof', 'shorts', 'offline', 449),
    (bk_id, 'bewakoof', 'shorts', 'others', 399),
    (bk_id, 'bewakoof', 'shirts', 'myntra_sor', 799),
    (bk_id, 'bewakoof', 'shirts', 'amazon_cocoblu', 749),
    (bk_id, 'bewakoof', 'shirts', 'flipkart_sor', 749),
    (bk_id, 'bewakoof', 'shirts', 'offline', 699),
    (bk_id, 'bewakoof', 'shirts', 'others', 649),
    (bk_id, 'bewakoof', 'pyjamas', 'myntra_sor', 649),
    (bk_id, 'bewakoof', 'pyjamas', 'amazon_cocoblu', 599),
    (bk_id, 'bewakoof', 'pyjamas', 'flipkart_sor', 599),
    (bk_id, 'bewakoof', 'pyjamas', 'offline', 549),
    (bk_id, 'bewakoof', 'pyjamas', 'others', 499),
    -- bewakoof air (15-20% premium over bewakoof)
    (bk_id, 'bewakoof air', 't-shirts', 'myntra_sor', 699),
    (bk_id, 'bewakoof air', 't-shirts', 'amazon_cocoblu', 649),
    (bk_id, 'bewakoof air', 't-shirts', 'flipkart_sor', 649),
    (bk_id, 'bewakoof air', 'jeans', 'myntra_sor', 1299),
    (bk_id, 'bewakoof air', 'jeans', 'amazon_cocoblu', 1199),
    (bk_id, 'bewakoof air', 'jeans', 'flipkart_sor', 1199),
    (bk_id, 'bewakoof air', 'joggers', 'myntra_sor', 949),
    (bk_id, 'bewakoof air', 'joggers', 'amazon_cocoblu', 899),
    (bk_id, 'bewakoof air', 'joggers', 'offline', 849),
    (bk_id, 'bewakoof air', 'shorts', 'myntra_sor', 649),
    (bk_id, 'bewakoof air', 'shorts', 'amazon_cocoblu', 599),
    (bk_id, 'bewakoof air', 'shorts', 'flipkart_sor', 599),
    -- bewakoof heavy duty (25-35% premium)
    (bk_id, 'bewakoof heavy duty', 't-shirts', 'myntra_sor', 849),
    (bk_id, 'bewakoof heavy duty', 't-shirts', 'amazon_cocoblu', 799),
    (bk_id, 'bewakoof heavy duty', 't-shirts', 'flipkart_sor', 799),
    (bk_id, 'bewakoof heavy duty', 'jeans', 'myntra_sor', 1499),
    (bk_id, 'bewakoof heavy duty', 'jeans', 'flipkart_sor', 1399),
    (bk_id, 'bewakoof heavy duty', 'joggers', 'myntra_sor', 1099),
    (bk_id, 'bewakoof heavy duty', 'joggers', 'amazon_cocoblu', 999)
  ON CONFLICT (brand_id, sub_brand, sub_category, channel) DO UPDATE SET asp = EXCLUDED.asp;

  -- ============================================================
  -- 5. RETURN % (by sub_brand x sub_category x channel)
  -- Marketplaces higher return rates, offline lowest
  -- ============================================================
  INSERT INTO master_default_return_pct (brand_id, sub_brand, sub_category, channel, return_pct) VALUES
    -- bewakoof
    (bk_id, 'bewakoof', 't-shirts', 'myntra_sor', 18),
    (bk_id, 'bewakoof', 't-shirts', 'amazon_cocoblu', 15),
    (bk_id, 'bewakoof', 't-shirts', 'flipkart_sor', 16),
    (bk_id, 'bewakoof', 't-shirts', 'offline', 5),
    (bk_id, 'bewakoof', 't-shirts', 'others', 12),
    (bk_id, 'bewakoof', 'jeans', 'myntra_sor', 22),
    (bk_id, 'bewakoof', 'jeans', 'amazon_cocoblu', 18),
    (bk_id, 'bewakoof', 'jeans', 'flipkart_sor', 20),
    (bk_id, 'bewakoof', 'jeans', 'offline', 8),
    (bk_id, 'bewakoof', 'jeans', 'others', 15),
    (bk_id, 'bewakoof', 'joggers', 'myntra_sor', 15),
    (bk_id, 'bewakoof', 'joggers', 'amazon_cocoblu', 12),
    (bk_id, 'bewakoof', 'joggers', 'flipkart_sor', 14),
    (bk_id, 'bewakoof', 'joggers', 'offline', 5),
    (bk_id, 'bewakoof', 'joggers', 'others', 10),
    (bk_id, 'bewakoof', 'shorts', 'myntra_sor', 16),
    (bk_id, 'bewakoof', 'shorts', 'amazon_cocoblu', 13),
    (bk_id, 'bewakoof', 'shorts', 'flipkart_sor', 14),
    (bk_id, 'bewakoof', 'shorts', 'offline', 5),
    (bk_id, 'bewakoof', 'shorts', 'others', 10),
    (bk_id, 'bewakoof', 'shirts', 'myntra_sor', 20),
    (bk_id, 'bewakoof', 'shirts', 'amazon_cocoblu', 16),
    (bk_id, 'bewakoof', 'shirts', 'flipkart_sor', 18),
    (bk_id, 'bewakoof', 'shirts', 'offline', 7),
    (bk_id, 'bewakoof', 'shirts', 'others', 13),
    (bk_id, 'bewakoof', 'pyjamas', 'myntra_sor', 12),
    (bk_id, 'bewakoof', 'pyjamas', 'amazon_cocoblu', 10),
    (bk_id, 'bewakoof', 'pyjamas', 'flipkart_sor', 11),
    (bk_id, 'bewakoof', 'pyjamas', 'offline', 4),
    (bk_id, 'bewakoof', 'pyjamas', 'others', 8),
    -- bewakoof air
    (bk_id, 'bewakoof air', 't-shirts', 'myntra_sor', 16),
    (bk_id, 'bewakoof air', 't-shirts', 'amazon_cocoblu', 13),
    (bk_id, 'bewakoof air', 't-shirts', 'flipkart_sor', 14),
    (bk_id, 'bewakoof air', 'jeans', 'myntra_sor', 20),
    (bk_id, 'bewakoof air', 'jeans', 'amazon_cocoblu', 16),
    (bk_id, 'bewakoof air', 'jeans', 'flipkart_sor', 18),
    (bk_id, 'bewakoof air', 'joggers', 'myntra_sor', 14),
    (bk_id, 'bewakoof air', 'joggers', 'amazon_cocoblu', 11),
    (bk_id, 'bewakoof air', 'joggers', 'offline', 5),
    (bk_id, 'bewakoof air', 'shorts', 'myntra_sor', 14),
    (bk_id, 'bewakoof air', 'shorts', 'amazon_cocoblu', 11),
    (bk_id, 'bewakoof air', 'shorts', 'flipkart_sor', 12),
    -- bewakoof heavy duty
    (bk_id, 'bewakoof heavy duty', 't-shirts', 'myntra_sor', 14),
    (bk_id, 'bewakoof heavy duty', 't-shirts', 'amazon_cocoblu', 11),
    (bk_id, 'bewakoof heavy duty', 't-shirts', 'flipkart_sor', 12),
    (bk_id, 'bewakoof heavy duty', 'jeans', 'myntra_sor', 18),
    (bk_id, 'bewakoof heavy duty', 'jeans', 'flipkart_sor', 15),
    (bk_id, 'bewakoof heavy duty', 'joggers', 'myntra_sor', 12),
    (bk_id, 'bewakoof heavy duty', 'joggers', 'amazon_cocoblu', 10)
  ON CONFLICT (brand_id, sub_brand, sub_category, channel) DO UPDATE SET return_pct = EXCLUDED.return_pct;

  -- ============================================================
  -- 6. SELLEX % (by sub_brand x sub_category x channel)
  -- Marketplace commissions + logistics, D2C has ad spend
  -- ============================================================
  INSERT INTO master_default_sellex_pct (brand_id, sub_brand, sub_category, channel, sellex_pct) VALUES
    -- bewakoof
    (bk_id, 'bewakoof', 't-shirts', 'myntra_sor', 28),
    (bk_id, 'bewakoof', 't-shirts', 'amazon_cocoblu', 30),
    (bk_id, 'bewakoof', 't-shirts', 'flipkart_sor', 25),
    (bk_id, 'bewakoof', 't-shirts', 'offline', 18),
    (bk_id, 'bewakoof', 't-shirts', 'others', 20),
    (bk_id, 'bewakoof', 'jeans', 'myntra_sor', 25),
    (bk_id, 'bewakoof', 'jeans', 'amazon_cocoblu', 28),
    (bk_id, 'bewakoof', 'jeans', 'flipkart_sor', 23),
    (bk_id, 'bewakoof', 'jeans', 'offline', 16),
    (bk_id, 'bewakoof', 'jeans', 'others', 18),
    (bk_id, 'bewakoof', 'joggers', 'myntra_sor', 27),
    (bk_id, 'bewakoof', 'joggers', 'amazon_cocoblu', 29),
    (bk_id, 'bewakoof', 'joggers', 'flipkart_sor', 24),
    (bk_id, 'bewakoof', 'joggers', 'offline', 17),
    (bk_id, 'bewakoof', 'joggers', 'others', 19),
    (bk_id, 'bewakoof', 'shorts', 'myntra_sor', 28),
    (bk_id, 'bewakoof', 'shorts', 'amazon_cocoblu', 30),
    (bk_id, 'bewakoof', 'shorts', 'flipkart_sor', 25),
    (bk_id, 'bewakoof', 'shorts', 'offline', 18),
    (bk_id, 'bewakoof', 'shorts', 'others', 20),
    (bk_id, 'bewakoof', 'shirts', 'myntra_sor', 26),
    (bk_id, 'bewakoof', 'shirts', 'amazon_cocoblu', 28),
    (bk_id, 'bewakoof', 'shirts', 'flipkart_sor', 23),
    (bk_id, 'bewakoof', 'shirts', 'offline', 16),
    (bk_id, 'bewakoof', 'shirts', 'others', 18),
    (bk_id, 'bewakoof', 'pyjamas', 'myntra_sor', 26),
    (bk_id, 'bewakoof', 'pyjamas', 'amazon_cocoblu', 28),
    (bk_id, 'bewakoof', 'pyjamas', 'flipkart_sor', 23),
    (bk_id, 'bewakoof', 'pyjamas', 'offline', 16),
    (bk_id, 'bewakoof', 'pyjamas', 'others', 18),
    -- bewakoof air
    (bk_id, 'bewakoof air', 't-shirts', 'myntra_sor', 26),
    (bk_id, 'bewakoof air', 't-shirts', 'amazon_cocoblu', 28),
    (bk_id, 'bewakoof air', 't-shirts', 'flipkart_sor', 23),
    (bk_id, 'bewakoof air', 'jeans', 'myntra_sor', 23),
    (bk_id, 'bewakoof air', 'jeans', 'amazon_cocoblu', 26),
    (bk_id, 'bewakoof air', 'jeans', 'flipkart_sor', 21),
    (bk_id, 'bewakoof air', 'joggers', 'myntra_sor', 25),
    (bk_id, 'bewakoof air', 'joggers', 'amazon_cocoblu', 27),
    (bk_id, 'bewakoof air', 'joggers', 'offline', 16),
    (bk_id, 'bewakoof air', 'shorts', 'myntra_sor', 26),
    (bk_id, 'bewakoof air', 'shorts', 'amazon_cocoblu', 28),
    (bk_id, 'bewakoof air', 'shorts', 'flipkart_sor', 23),
    -- bewakoof heavy duty
    (bk_id, 'bewakoof heavy duty', 't-shirts', 'myntra_sor', 24),
    (bk_id, 'bewakoof heavy duty', 't-shirts', 'amazon_cocoblu', 26),
    (bk_id, 'bewakoof heavy duty', 't-shirts', 'flipkart_sor', 22),
    (bk_id, 'bewakoof heavy duty', 'jeans', 'myntra_sor', 22),
    (bk_id, 'bewakoof heavy duty', 'jeans', 'flipkart_sor', 20),
    (bk_id, 'bewakoof heavy duty', 'joggers', 'myntra_sor', 23),
    (bk_id, 'bewakoof heavy duty', 'joggers', 'amazon_cocoblu', 25)
  ON CONFLICT (brand_id, sub_brand, sub_category, channel) DO UPDATE SET sellex_pct = EXCLUDED.sellex_pct;

END $$;

-- Verify counts
SELECT 'master_default_asp' AS tbl, count(*) FROM master_default_asp
UNION ALL SELECT 'master_default_cogs', count(*) FROM master_default_cogs
UNION ALL SELECT 'master_default_return_pct', count(*) FROM master_default_return_pct
UNION ALL SELECT 'master_default_tax_pct', count(*) FROM master_default_tax_pct
UNION ALL SELECT 'master_default_sellex_pct', count(*) FROM master_default_sellex_pct
UNION ALL SELECT 'master_default_doh', count(*) FROM master_default_doh;
