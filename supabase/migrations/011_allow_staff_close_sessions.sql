-- Any admin-assigned staff role may update (e.g. force-close) a training
-- session from the dashboard. Permissive policy, OR-ed with existing policies.
drop policy if exists sessions_update_all_staff on public.training_sessions;
create policy sessions_update_all_staff on public.training_sessions
for update to authenticated
using (get_user_role() = any (array['admin','associate','trainer','supervisor','area_manager','city_manager']::user_role[]))
with check (get_user_role() = any (array['admin','associate','trainer','supervisor','area_manager','city_manager']::user_role[]));
