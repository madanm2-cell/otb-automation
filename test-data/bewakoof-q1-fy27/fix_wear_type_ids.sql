-- ============================================================
-- Reset Bewakoof master data to match seed.sql + fix wear_types
-- Run this BEFORE uploading test files
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Clear existing Bewakoof master data
-- ============================================================

-- Clear master defaults for Bewakoof (references sub_brand/sub_category/channel as text)
DELETE FROM master_default_asp WHERE brand_id = (SELECT id FROM brands WHERE name = 'Bewakoof');
DELETE FROM master_default_cogs WHERE brand_id = (SELECT id FROM brands WHERE name = 'Bewakoof');
DELETE FROM master_default_return_pct WHERE brand_id = (SELECT id FROM brands WHERE name = 'Bewakoof');
DELETE FROM master_default_tax_pct WHERE brand_id = (SELECT id FROM brands WHERE name = 'Bewakoof');
DELETE FROM master_default_sellex_pct WHERE brand_id = (SELECT id FROM brands WHERE name = 'Bewakoof');
DELETE FROM master_default_doh WHERE brand_id = (SELECT id FROM brands WHERE name = 'Bewakoof');

-- Clear brand-scoped master data
DELETE FROM sub_categories WHERE brand_id = (SELECT id FROM brands WHERE name = 'Bewakoof');
DELETE FROM channels WHERE brand_id = (SELECT id FROM brands WHERE name = 'Bewakoof');
DELETE FROM genders WHERE brand_id = (SELECT id FROM brands WHERE name = 'Bewakoof');
DELETE FROM sub_brands WHERE brand_id = (SELECT id FROM brands WHERE name = 'Bewakoof');
DELETE FROM wear_types WHERE brand_id = (SELECT id FROM brands WHERE name = 'Bewakoof');

-- ============================================================
-- 2. Re-seed from original seed.sql values (brand-scoped)
-- ============================================================

-- Sub Brands
INSERT INTO sub_brands (name, brand_id)
SELECT sb.name, b.id FROM
  (VALUES ('bewakoof'), ('bewakoof air'), ('bewakoof heavy duty')) AS sb(name),
  brands b WHERE b.name = 'Bewakoof'
ON CONFLICT (brand_id, name) DO NOTHING;

-- Wear Types
INSERT INTO wear_types (name, brand_id)
SELECT wt.name, b.id FROM
  (VALUES ('NWW'), ('WW')) AS wt(name),
  brands b WHERE b.name = 'Bewakoof'
ON CONFLICT (brand_id, name) DO NOTHING;

-- Sub Categories (with wear_type assignment)
DO $$
DECLARE
  bk_id uuid;
  nww_id uuid;
BEGIN
  SELECT id INTO bk_id FROM brands WHERE name = 'Bewakoof';
  SELECT id INTO nww_id FROM wear_types WHERE name = 'NWW' AND brand_id = bk_id;

  -- All 14 sub_categories from seed.sql, NWW for the 6 with known mappings
  INSERT INTO sub_categories (name, brand_id, wear_type_id) VALUES
    ('T-Shirts', bk_id, nww_id),
    ('Jeans', bk_id, nww_id),
    ('Joggers', bk_id, nww_id),
    ('Shorts', bk_id, nww_id),
    ('Shirts', bk_id, nww_id),
    ('Pyjamas', bk_id, nww_id),
    ('Hoodies', bk_id, NULL),
    ('Trousers', bk_id, NULL),
    ('Jackets', bk_id, NULL),
    ('Sweatshirts', bk_id, NULL),
    ('Pants', bk_id, NULL),
    ('Sweaters', bk_id, NULL),
    ('Blazers', bk_id, NULL),
    ('Others', bk_id, NULL)
  ON CONFLICT DO NOTHING;
END $$;

-- Channels (9 from seed.sql)
INSERT INTO channels (name, brand_id)
SELECT ch.name, b.id FROM
  (VALUES ('amazon_cocoblu'), ('flipkart_sor'), ('myntra_sor'),
          ('Offline'), ('Others'), ('unicommerce'),
          ('wondersoft'), ('shoppers stop'), ('zepto')) AS ch(name),
  brands b WHERE b.name = 'Bewakoof'
ON CONFLICT (brand_id, name) DO NOTHING;

-- Genders
INSERT INTO genders (name, brand_id)
SELECT g.name, b.id FROM
  (VALUES ('Male'), ('Female'), ('Unisex')) AS g(name),
  brands b WHERE b.name = 'Bewakoof'
ON CONFLICT (brand_id, name) DO NOTHING;

COMMIT;

-- ============================================================
-- Verify
-- ============================================================
SELECT 'sub_brands' AS tbl, count(*) FROM sub_brands WHERE brand_id = (SELECT id FROM brands WHERE name = 'Bewakoof')
UNION ALL SELECT 'wear_types', count(*) FROM wear_types WHERE brand_id = (SELECT id FROM brands WHERE name = 'Bewakoof')
UNION ALL SELECT 'sub_categories', count(*) FROM sub_categories WHERE brand_id = (SELECT id FROM brands WHERE name = 'Bewakoof')
UNION ALL SELECT 'channels', count(*) FROM channels WHERE brand_id = (SELECT id FROM brands WHERE name = 'Bewakoof')
UNION ALL SELECT 'genders', count(*) FROM genders WHERE brand_id = (SELECT id FROM brands WHERE name = 'Bewakoof');

-- Verify wear_type_id is set on the 6 key sub_categories
SELECT sc.name, wt.name AS wear_type
FROM sub_categories sc
LEFT JOIN wear_types wt ON wt.id = sc.wear_type_id
WHERE sc.brand_id = (SELECT id FROM brands WHERE name = 'Bewakoof')
ORDER BY sc.name;
