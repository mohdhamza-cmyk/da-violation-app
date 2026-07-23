-- ============================================================
-- 006 — Sequential auto-assignment of training orders
-- ============================================================
-- As soon as a rider enters the waiting queue (taps "Ready for Training",
-- including immediately after completing and returning a prior order), the
-- order is assigned automatically so they advance to the Accept screen.
-- Runs server-side via a trigger, so it works whether or not the admin
-- dashboard is open. Assignment can still be performed/overridden manually
-- from the dashboard's Assign Orders page.

create or replace function public.auto_assign_waiting_session()
returns trigger as $$
begin
  if new.status = 'waiting' then
    update public.training_sessions
    set status = 'assigned', assigned_at = now()
    where id = new.id and status = 'waiting';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_auto_assign_session on public.training_sessions;
create trigger trg_auto_assign_session
  after insert on public.training_sessions
  for each row execute function public.auto_assign_waiting_session();
