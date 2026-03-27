-- otb_actuals: stores actual performance data uploaded by Planning Team
CREATE TABLE otb_actuals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cycle_id UUID NOT NULL REFERENCES otb_cycles(id) ON DELETE CASCADE,
  sub_brand TEXT NOT NULL,
  wear_type TEXT NOT NULL,
  sub_category TEXT NOT NULL,
  gender TEXT NOT NULL,
  channel TEXT NOT NULL,
  month DATE NOT NULL,
  -- Uploaded actuals (2 fields)
  actual_nsq INT NOT NULL,
  actual_inwards_qty INT NOT NULL,
  -- Recalculated from actuals using formula chain
  actual_gmv NUMERIC(15,2),
  actual_nsv NUMERIC(15,2),
  actual_closing_stock_qty INT,
  actual_doh NUMERIC(8,2),
  actual_gm_pct NUMERIC(5,2),
  actual_cm1 NUMERIC(15,2),
  actual_cm2 NUMERIC(15,2),
  -- Metadata
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  uploaded_by UUID REFERENCES auth.users(id),
  -- One actual per dimension combo per month per cycle
  UNIQUE(cycle_id, sub_brand, wear_type, sub_category, gender, channel, month)
);

-- Indexes
CREATE INDEX idx_actuals_cycle ON otb_actuals(cycle_id);
CREATE INDEX idx_actuals_month ON otb_actuals(cycle_id, month);

-- RLS
ALTER TABLE otb_actuals ENABLE ROW LEVEL SECURITY;

-- Planning, Admin can insert/update actuals
CREATE POLICY actuals_insert ON otb_actuals
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('Admin', 'Planning')
    )
  );

CREATE POLICY actuals_update ON otb_actuals
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('Admin', 'Planning')
    )
  );

-- All authenticated users can read actuals (view_variance permission checked at API layer)
CREATE POLICY actuals_select ON otb_actuals
  FOR SELECT TO authenticated
  USING (true);
