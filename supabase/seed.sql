-- Brands (PRD 4.1)
INSERT INTO brands (name) VALUES
  ('Bewakoof'), ('TIGC'), ('Wrogn'), ('Urbano'),
  ('Nobero'), ('Veirdo'), ('Nauti Nati')
ON CONFLICT (name) DO NOTHING;

-- Sub Brands for Bewakoof
INSERT INTO sub_brands (name, brand_id)
SELECT sb.name, b.id FROM
  (VALUES ('bewakoof'), ('bewakoof air'), ('bewakoof heavy duty')) AS sb(name),
  brands b WHERE b.name = 'Bewakoof'
ON CONFLICT (brand_id, name) DO NOTHING;

-- Sub Categories
INSERT INTO sub_categories (name) VALUES
  ('T-Shirts'), ('Jeans'), ('Hoodies'), ('Joggers'), ('Shorts'),
  ('Shirts'), ('Trousers'), ('Jackets'), ('Sweatshirts'), ('Pyjamas')
ON CONFLICT (name) DO NOTHING;

-- Channels (PRD 4.1)
INSERT INTO channels (name) VALUES
  ('amazon_cocoblu'), ('flipkart_sor'), ('myntra_sor'), ('Offline'), ('Others')
ON CONFLICT (name) DO NOTHING;

-- Genders
INSERT INTO genders (name) VALUES ('Male'), ('Female'), ('Unisex')
ON CONFLICT (name) DO NOTHING;

-- Master Mappings (PRD 4.3 — standardization examples)
INSERT INTO master_mappings (mapping_type, raw_value, standard_value, brand) VALUES
  ('sub_brand', 'bob', 'bewakoof', 'Bewakoof'),
  ('sub_brand', 'BOB', 'bewakoof', 'Bewakoof'),
  ('channel', 'unicommerce', 'Others', NULL),
  ('channel', 'website', 'Others', NULL)
ON CONFLICT (mapping_type, raw_value, brand) DO NOTHING;
