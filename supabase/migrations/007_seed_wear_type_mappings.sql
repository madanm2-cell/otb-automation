-- Seed data for wear_type_mappings
-- Maps sub_brand × sub_category → wear_type
-- These are example mappings; update with actual business data

insert into wear_type_mappings (sub_brand, sub_category, wear_type) values
  ('bewakoof', 't-shirts', 'NWW'),
  ('bewakoof', 'shirts', 'NWW'),
  ('bewakoof', 'jeans', 'NWW'),
  ('bewakoof', 'joggers', 'NWW'),
  ('bewakoof', 'shorts', 'NWW'),
  ('bewakoof', 'dresses', 'WW'),
  ('bewakoof', 'co-ord sets', 'WW'),
  ('bewakoof', 'tops', 'WW'),
  ('bewakoof', 'kurtas', 'WW'),
  ('bewakoof', 'pyjamas', 'NWW')
on conflict (sub_brand, sub_category) do nothing;
