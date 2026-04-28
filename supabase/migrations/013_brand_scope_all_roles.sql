-- Migration: Unify brand-scoping for all non-Admin roles
-- Previously only GD was brand-scoped; now Planning, Finance, CXO, ReadOnly all require assigned_brands

-- Drop existing role-specific cycle SELECT policies
drop policy if exists "Privileged roles see all cycles" on otb_cycles;
drop policy if exists "GD sees assigned brand cycles" on otb_cycles;
drop policy if exists "ReadOnly sees approved cycles" on otb_cycles;

-- Unified SELECT policy: Admin sees all, others see only assigned brands
create policy "Users see cycles for assigned brands"
  on otb_cycles for select using (
    case get_user_role()
      when 'Admin' then true
      when 'ReadOnly' then
        status = 'Approved'
        and brand_id::text in (select jsonb_array_elements_text(get_assigned_brands()))
      else brand_id::text in (
        select jsonb_array_elements_text(get_assigned_brands())
      )
    end
  );

-- Update plan data UPDATE policy: extend GD check to all non-Admin roles
drop policy if exists "GD can update plan data" on otb_plan_data;

create policy "Non-admin can update plan data for assigned brands"
  on otb_plan_data for update using (
    get_user_role() in ('Admin', 'GD')
    and exists (
      select 1 from otb_plan_rows r
      join otb_cycles c on c.id = r.cycle_id
      where r.id = otb_plan_data.row_id
        and c.status = 'Filling'
        and (
          get_user_role() = 'Admin'
          or c.brand_id::text in (select jsonb_array_elements_text(get_assigned_brands()))
        )
    )
  );
