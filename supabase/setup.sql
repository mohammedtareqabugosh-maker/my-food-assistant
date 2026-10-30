-- صحن / مساعدي الغذائي + نَسّق
-- مخطط إعداد جديد متوافق مع الجداول التي تستخدمها التطبيقات.
-- نفّذ من Supabase Dashboard > SQL Editor عند إعداد مشروع جديد.
-- لا يحذف هذا الملف أي بيانات. إذا كانت الجداول موجودة، راجع الأعمدة والسياسات قبل تطبيقه.

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_name text not null default 'وجبة',
  meal_date timestamptz not null default now(),
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  meal_type text,
  ingredients text,
  notes text,
  client_id text,
  constraint meals_user_client_id_key unique (user_id, client_id)
);

create index if not exists meals_user_client_id_unique
  on public.meals (user_id, client_id) where client_id is not null;

alter table public.meals enable row level security;
drop policy if exists "Users manage own meals" on public.meals;
drop policy if exists "Users can view their own meals" on public.meals;
drop policy if exists "Users can insert their own meals" on public.meals;
drop policy if exists "Users can update their own meals" on public.meals;
drop policy if exists "Users can delete their own meals" on public.meals;
create policy "Users can view their own meals" on public.meals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own meals" on public.meals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own meals" on public.meals
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own meals" on public.meals
  for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.meals to authenticated;

create table if not exists public.shared_schedule (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('task', 'appointment', 'meal')),
  title text not null,
  details text not null default '',
  starts_at timestamptz not null,
  meal_type text not null default '',
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  ingredients text not null default '',
  source_app text not null default '',
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  progress_notes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists shared_schedule_user_time_idx
  on public.shared_schedule (user_id, starts_at);

alter table public.shared_schedule enable row level security;
drop policy if exists "Users manage own shared schedule" on public.shared_schedule;
drop policy if exists "Users can read own shared schedule" on public.shared_schedule;
drop policy if exists "Users can insert own shared schedule" on public.shared_schedule;
drop policy if exists "Users can update own shared schedule" on public.shared_schedule;
drop policy if exists "Users can delete own shared schedule" on public.shared_schedule;
create policy "Users can read own shared schedule" on public.shared_schedule
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own shared schedule" on public.shared_schedule
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own shared schedule" on public.shared_schedule
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete own shared schedule" on public.shared_schedule
  for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.shared_schedule to authenticated;
