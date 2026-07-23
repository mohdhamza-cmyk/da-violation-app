-- Signup via the GoTrue API runs the trigger with a restricted search_path,
-- so unqualified enum types (user_role, mot_type) were "not found", causing
-- "Database error saving new user". Qualify types and pin search_path.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, employee_id, full_name, role, mot)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'employee_id', new.email),
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'rider'),
    coalesce((new.raw_user_meta_data->>'mot')::public.mot_type, 'rider'));
  return new;
end;
$$;
