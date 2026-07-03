-- Assign each order to a RANDOM active location matching the rider's MOT at
-- their store, with graceful fallbacks. Randomizes destinations run to run.
create or replace function public.auto_assign_waiting_session()
returns trigger as $$
declare v_mot mot_type; v_loc uuid;
begin
  if new.status <> 'waiting' then return new; end if;
  select mot into v_mot from public.profiles where id = new.rider_id;
  v_mot := coalesce(v_mot, 'rider');
  select id into v_loc from public.training_locations
    where is_active and mot = v_mot and store_id = new.store_id order by random() limit 1;
  if v_loc is null then select id into v_loc from public.training_locations
    where is_active and store_id = new.store_id order by random() limit 1; end if;
  if v_loc is null then select id into v_loc from public.training_locations
    where is_active and mot = v_mot order by random() limit 1; end if;
  if v_loc is null then select id into v_loc from public.training_locations
    where is_active order by random() limit 1; end if;
  update public.training_sessions
     set status='assigned', assigned_at=now(), mot=v_mot,
         difficulty = case v_mot when 'walker' then 'easy' when 'cyclist' then 'medium' else 'hard' end,
         location_id = coalesce(v_loc, location_id)
   where id = new.id and status='waiting';
  return new;
end;
$$ language plpgsql security definer;
