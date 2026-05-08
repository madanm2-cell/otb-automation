CREATE TABLE brand_variance_thresholds (
  brand_id      uuid        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  metric        text        NOT NULL CHECK (metric IN (
                              'gmv_pct','nsv_pct','nsq_pct',
                              'inwards_pct','closing_stock_pct','doh_pct'
                            )),
  threshold_pct numeric     NOT NULL CHECK (threshold_pct > 0),
  updated_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brand_id, metric)
);

ALTER TABLE brand_variance_thresholds ENABLE ROW LEVEL SECURITY;

-- Admin and Planning can read/write (Planning scoped to assigned brands)
CREATE POLICY "admin_write" ON brand_variance_thresholds
  FOR ALL TO authenticated
  USING (get_user_role() = 'Admin')
  WITH CHECK (get_user_role() = 'Admin');

CREATE POLICY "planning_write" ON brand_variance_thresholds
  FOR ALL TO authenticated
  USING (
    get_user_role() = 'Planning'
    AND brand_id::text IN (SELECT jsonb_array_elements_text(get_assigned_brands()))
  )
  WITH CHECK (
    get_user_role() = 'Planning'
    AND brand_id::text IN (SELECT jsonb_array_elements_text(get_assigned_brands()))
  );

-- All authenticated users can read their assigned brands' thresholds (Admin reads all)
CREATE POLICY "brand_read" ON brand_variance_thresholds
  FOR SELECT TO authenticated
  USING (
    CASE get_user_role()
      WHEN 'Admin' THEN true
      ELSE brand_id::text IN (SELECT jsonb_array_elements_text(get_assigned_brands()))
    END
  );
