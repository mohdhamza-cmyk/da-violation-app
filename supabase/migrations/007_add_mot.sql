-- Mode of Transport (MOT): Walker, Cyclist, Rider (motorbike).
-- Replaces the user-facing difficulty tiers (walker≈easy, cyclist≈medium, rider≈hard).
create type mot_type as enum ('walker', 'cyclist', 'rider');

alter table public.profiles add column if not exists mot mot_type not null default 'rider';

alter table public.training_locations add column if not exists mot mot_type;
update public.training_locations set mot = case difficulty
    when 'easy' then 'walker'::mot_type when 'medium' then 'cyclist'::mot_type
    else 'rider'::mot_type end where mot is null;
alter table public.training_locations alter column mot set default 'cyclist';
alter table public.training_locations alter column mot set not null;

alter table public.training_sessions add column if not exists mot mot_type;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, employee_id, full_name, role, mot)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'employee_id', new.email),
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'rider'),
    coalesce((new.raw_user_meta_data->>'mot')::mot_type, 'rider'));
  return new;
end;
$$ language plpgsql security definer;
