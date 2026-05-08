CREATE TABLE brand_variance_thresholds (
  brand_id      uuid        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  metric        text        NOT NULL CHECK (metric IN (
                              'gmv_pct','nsv_pct','nsq_pct',
                              'inwards_pct','closing_stock_pct','doh_pct'
                            )),
  threshold_pct numeric     NOT NULL CHECK (threshold_pct > 0),
  updated_by    uuid        REFERENCES auth.users(id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brand_id, metric)
);

ALTER TABLE brand_variance_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON brand_variance_thresholds
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin')
  );

CREATE POLICY "planning_assigned" ON brand_variance_thresholds
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'Planning'
        AND assigned_brands @> jsonb_build_array(brand_id::text)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'Planning'
        AND assigned_brands @> jsonb_build_array(brand_id::text)
    )
  );

CREATE POLICY "all_read" ON brand_variance_thresholds
  FOR SELECT TO authenticated
  USING (true);
