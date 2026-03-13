-- Rename ly_sales_gmv to ly_sales_nsq (LY data is NSQ not GMV)
alter table otb_plan_data rename column ly_sales_gmv to ly_sales_nsq;
-- Change type from numeric to int (NSQ is quantity)
alter table otb_plan_data alter column ly_sales_nsq type int using ly_sales_nsq::int;

-- CM1 and CM2 are now percentages (not absolute values)
-- Change column types to match percentage storage
alter table otb_plan_data alter column cm1 type numeric(8,2);
alter table otb_plan_data alter column cm2 type numeric(8,2);
