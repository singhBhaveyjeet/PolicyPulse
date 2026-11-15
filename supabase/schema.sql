create table if not exists public.agent_workspaces (
  user_id uuid primary key references auth.users (id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.policy_records (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  customer_name text not null,
  phone text not null default '',
  email text not null default '',
  policy_number text not null,
  insurer text not null default 'Unassigned',
  policy_type text not null default 'Other',
  start_date date,
  expiry_date date not null,
  premium numeric(14, 2) not null default 0 check (premium >= 0),
  source_file text not null default '',
  source_sheet text not null default '',
  source_row integer not null default 0 check (source_row >= 0),
  imported_at timestamptz not null default now(),
  import_id text not null default 'manual',
  follow_up text not null default 'pending' check (follow_up in ('pending', 'contacted', 'interested', 'renewed', 'lost')),
  note text not null default '',
  primary key (user_id, id)
);

create table if not exists public.policy_imports (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  file_name text not null,
  sheet_name text not null,
  added integer not null default 0 check (added >= 0),
  updated integer not null default 0 check (updated >= 0),
  unchanged integer not null default 0 check (unchanged >= 0),
  rejected integer not null default 0 check (rejected >= 0),
  imported_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists policy_records_owner_expiry_idx
  on public.policy_records (user_id, expiry_date);
create index if not exists policy_records_owner_number_idx
  on public.policy_records (user_id, policy_number);
create index if not exists policy_imports_owner_date_idx
  on public.policy_imports (user_id, imported_at desc);

alter table public.agent_workspaces enable row level security;
alter table public.policy_records enable row level security;
alter table public.policy_imports enable row level security;

revoke all on public.agent_workspaces, public.policy_records, public.policy_imports from public, anon;
grant select, insert, update, delete on public.agent_workspaces, public.policy_records, public.policy_imports to authenticated;

drop policy if exists "Users manage their own workspace" on public.agent_workspaces;
create policy "Users manage their own workspace"
  on public.agent_workspaces for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own policy records" on public.policy_records;
create policy "Users manage their own policy records"
  on public.policy_records for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own import records" on public.policy_imports;
create policy "Users manage their own import records"
  on public.policy_imports for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
