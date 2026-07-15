-- Run this once in the Supabase SQL Editor for an existing Ledgerly installation.
-- Fresh installations only need schema.sql, which already contains these changes.

do $$ begin
  create type public.loan_entry_kind as enum ('lend', 'repayment');
exception when duplicate_object then null;
end $$;
alter type public.transaction_kind add value if not exists 'loan_out';
alter type public.transaction_kind add value if not exists 'loan_repayment';

create table if not exists public.loan_contacts (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.app_profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  name_key text generated always as (lower(trim(name))) stored,
  phone text, notes text, is_archived boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(profile_id, name_key)
);

create table if not exists public.loan_entries (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.app_profiles(id) on delete cascade,
  contact_id uuid not null references public.loan_contacts(id) on delete restrict,
  transaction_id uuid not null unique references public.transactions(id) on delete cascade,
  entry_type public.loan_entry_kind not null, entry_date date not null,
  original_amount numeric(20,4) not null check (original_amount > 0), original_currency public.currency_code not null,
  exchange_rate numeric(20,6) not null check (exchange_rate > 0),
  amount_pkr numeric(20,4) not null check (amount_pkr > 0), amount_usd numeric(20,4) not null check (amount_usd > 0),
  notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create index if not exists loan_contacts_profile_name_idx on public.loan_contacts(profile_id, name_key) where is_archived is false;
create index if not exists loan_entries_contact_date_idx on public.loan_entries(contact_id, entry_date desc);

drop trigger if exists loan_contacts_updated_at on public.loan_contacts;
create trigger loan_contacts_updated_at before update on public.loan_contacts for each row execute function public.set_updated_at();
drop trigger if exists loan_entries_updated_at on public.loan_entries;
create trigger loan_entries_updated_at before update on public.loan_entries for each row execute function public.set_updated_at();

alter table public.loan_contacts enable row level security;
alter table public.loan_entries enable row level security;

create or replace view public.account_balances with (security_invoker = false) as
select a.id, a.profile_id, a.name, a.account_type, a.default_currency, a.opening_balance, a.icon, a.notes, a.sort_order, a.is_archived,
  a.opening_balance + coalesce(sum(case
    when t.type::text in ('income','transfer_in','loan_repayment','opening_balance') then case when a.default_currency='PKR' then t.amount_pkr else t.amount_usd end
    else -case when a.default_currency='PKR' then t.amount_pkr else t.amount_usd end end),0) as current_balance
from public.accounts a left join public.transactions t on t.account_id=a.id and t.deleted_at is null
group by a.id;
