-- BhadeBook cloud sync schema.
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It creates the three tables that mirror the local Dexie schema and locks them
-- down so only a signed-in user (the shared household account) can read/write.
--
-- Columns are snake_case here; the app maps them to/from its camelCase fields
-- in lib/sync.ts. Primary keys are client-generated UUIDs so two phones can
-- create records offline without colliding. `updated_at` drives last-write-wins;
-- `deleted_at` is a soft-delete tombstone so deletions propagate.

create table if not exists shops (
  id           uuid primary key,
  name         text not null,
  area         text not null,
  address      text,
  monthly_rent numeric not null,
  created_at   timestamptz not null,
  updated_at   timestamptz not null,
  deleted_at   timestamptz
);

create table if not exists tenants (
  id         uuid primary key,
  shop_id    uuid not null,
  name       text not null,
  phone      text,
  type       text not null,
  active     boolean not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create table if not exists payments (
  id           uuid primary key,
  shop_id      uuid not null,
  tenant_id    uuid not null,
  amount       numeric not null,
  due_month    text not null,
  date_paid    timestamptz,
  payment_mode text not null,
  notes        text,
  created_at   timestamptz not null,
  updated_at   timestamptz not null,
  deleted_at   timestamptz
);

-- other_transactions: miscellaneous personal records (a donation, a medical
-- expense, ...) fully independent of the rent tables above. Added later than
-- the rest of this schema — this file is safe to re-run in full on an
-- existing project (every statement is IF NOT EXISTS), so re-running it is
-- how an already-deployed project picks up this table.
create table if not exists other_transactions (
  id             uuid primary key,
  amount         numeric not null,
  direction      text not null,
  category       text not null,
  category_other text,
  description    text,
  date           timestamptz not null,
  logged_by      text not null,
  photo          text,
  created_at     timestamptz not null,
  updated_at     timestamptz not null,
  deleted_at     timestamptz
);

-- Pull queries filter on updated_at; index it on each table.
create index if not exists shops_updated_at_idx    on shops    (updated_at);
create index if not exists tenants_updated_at_idx  on tenants  (updated_at);
create index if not exists payments_updated_at_idx on payments (updated_at);
create index if not exists other_transactions_updated_at_idx on other_transactions (updated_at);

-- Row Level Security: enable it, then allow any *authenticated* user full access.
-- This is a single-household app — everyone who logs in shares one dataset, so
-- there is no per-user row ownership. The shared credentials are the boundary.
alter table shops              enable row level security;
alter table tenants             enable row level security;
alter table payments            enable row level security;
alter table other_transactions  enable row level security;

-- `create policy` has no IF NOT EXISTS — drop-then-recreate so this whole
-- file stays safe to re-run in full (needed so an already-deployed project
-- can pick up other_transactions by just re-running this same file).
drop policy if exists "authenticated full access" on shops;
create policy "authenticated full access" on shops
  for all to authenticated using (true) with check (true);
drop policy if exists "authenticated full access" on tenants;
create policy "authenticated full access" on tenants
  for all to authenticated using (true) with check (true);
drop policy if exists "authenticated full access" on payments;
create policy "authenticated full access" on payments
  for all to authenticated using (true) with check (true);
drop policy if exists "authenticated full access" on other_transactions;
create policy "authenticated full access" on other_transactions
  for all to authenticated using (true) with check (true);
