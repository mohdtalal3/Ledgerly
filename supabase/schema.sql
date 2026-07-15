-- Ledgerly schema. Safe to run in the Supabase SQL Editor.
create extension if not exists pgcrypto;

create type public.currency_code as enum ('PKR', 'USD');
create type public.account_kind as enum ('cash', 'bank', 'wallet');
create type public.transaction_kind as enum ('income', 'expense', 'transfer_in', 'transfer_out', 'tax_payment', 'opening_balance', 'adjustment');
create type public.tax_status as enum ('unpaid', 'partial', 'paid');

create table public.app_profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null default 'Owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_settings (
  profile_id uuid primary key references public.app_profiles(id) on delete cascade,
  app_name text not null default 'Ledgerly',
  default_currency public.currency_code not null default 'PKR',
  usd_to_pkr_rate numeric(20,6) not null default 280 check (usd_to_pkr_rate > 0),
  tax_percentage numeric(7,4) not null default 5 check (tax_percentage between 0 and 100),
  date_format text not null default 'DD/MM/YYYY' check (date_format in ('DD/MM/YYYY','MM/DD/YYYY','YYYY-MM-DD')),
  allow_negative_balances boolean not null default false,
  theme text not null default 'light' check (theme in ('light','dark','system')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);


create table public.accounts (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.app_profiles(id) on delete cascade,
  name text not null, account_type public.account_kind not null, default_currency public.currency_code not null default 'PKR',
  opening_balance numeric(20,4) not null default 0 check (opening_balance >= 0), icon text, notes text,
  sort_order integer not null default 0, is_archived boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(profile_id, name)
);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.app_profiles(id) on delete cascade,
  name text not null, icon text, color text, sort_order integer not null default 0, is_archived boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(profile_id, name)
);

create table public.income_sources (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.app_profiles(id) on delete cascade,
  name text not null, sort_order integer not null default 0, is_archived boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(profile_id, name)
);

create table public.transfers (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.app_profiles(id) on delete cascade,
  from_account_id uuid not null references public.accounts(id), to_account_id uuid not null references public.accounts(id),
  transfer_date date not null, original_amount numeric(20,4) not null check (original_amount > 0), original_currency public.currency_code not null,
  exchange_rate numeric(20,6) not null check (exchange_rate > 0), fee_amount numeric(20,4) not null default 0 check (fee_amount >= 0), notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  check (from_account_id <> to_account_id)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.app_profiles(id) on delete cascade,
  account_id uuid not null references public.accounts(id), type public.transaction_kind not null,
  transaction_date date not null default current_date, original_amount numeric(20,4) not null check (original_amount > 0),
  original_currency public.currency_code not null, exchange_rate numeric(20,6) not null check (exchange_rate > 0),
  amount_pkr numeric(20,4) not null check (amount_pkr >= 0), amount_usd numeric(20,4) not null check (amount_usd >= 0),
  description text not null, notes text, merchant text, reference text,
  expense_category_id uuid references public.expense_categories(id), income_source_id uuid references public.income_sources(id),
  transfer_id uuid references public.transfers(id) on delete cascade,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  check ((type <> 'expense') or expense_category_id is not null),
  check ((type <> 'income') or income_source_id is not null)
);

create table public.tax_liabilities (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.app_profiles(id) on delete cascade,
  income_transaction_id uuid not null unique references public.transactions(id) on delete cascade,
  tax_percentage numeric(7,4) not null check (tax_percentage between 0 and 100),
  amount_pkr numeric(20,4) not null check (amount_pkr >= 0), amount_usd numeric(20,4) not null check (amount_usd >= 0),
  status public.tax_status not null default 'unpaid', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.tax_payments (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.app_profiles(id) on delete cascade,
  liability_id uuid not null references public.tax_liabilities(id) on delete cascade,
  transaction_id uuid not null unique references public.transactions(id) on delete cascade,
  amount_pkr numeric(20,4) not null check (amount_pkr > 0), amount_usd numeric(20,4) not null check (amount_usd > 0),
  paid_at date not null default current_date, created_at timestamptz not null default now()
);

create table public.transaction_documents (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.app_profiles(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade, storage_path text, external_reference text,
  file_name text, mime_type text, created_at timestamptz not null default now(), check (storage_path is not null or external_reference is not null)
);

create table public.audit_logs (
  id bigint generated always as identity primary key, profile_id uuid references public.app_profiles(id) on delete set null,
  entity_type text not null, entity_id uuid, action text not null, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create index transactions_profile_date_idx on public.transactions(profile_id, transaction_date desc) where deleted_at is null;
create index transactions_account_idx on public.transactions(account_id, transaction_date desc) where deleted_at is null;
create index transactions_type_idx on public.transactions(profile_id, type, transaction_date desc) where deleted_at is null;
create index transactions_category_idx on public.transactions(expense_category_id) where deleted_at is null;
create index transactions_source_idx on public.transactions(income_source_id) where deleted_at is null;
create index tax_liabilities_profile_status_idx on public.tax_liabilities(profile_id, status);
create index tax_payments_liability_idx on public.tax_payments(liability_id);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
do $$ declare t text; begin foreach t in array array['app_profiles','app_settings','accounts','expense_categories','income_sources','transactions','transfers','tax_liabilities'] loop
  execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
end loop; end $$;

-- Calculated balances in the account's native currency. Transfer values are already stored in both currencies.
create or replace view public.account_balances with (security_invoker = false) as
select a.id, a.profile_id, a.name, a.account_type, a.default_currency, a.opening_balance, a.icon, a.notes, a.sort_order, a.is_archived,
  a.opening_balance + coalesce(sum(case
    when t.type in ('income','transfer_in','opening_balance') then case when a.default_currency='PKR' then t.amount_pkr else t.amount_usd end
    else -case when a.default_currency='PKR' then t.amount_pkr else t.amount_usd end end),0) as current_balance
from public.accounts a left join public.transactions t on t.account_id=a.id and t.deleted_at is null
group by a.id;

-- Atomically pays one liability and updates its derived status.
create or replace function public.record_tax_payment(
  p_profile_id uuid, p_liability_id uuid, p_account_id uuid, p_amount numeric, p_currency public.currency_code,
  p_rate numeric, p_date date, p_notes text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_liability tax_liabilities; v_paid numeric; v_pkr numeric; v_usd numeric; v_tx uuid; v_payment uuid;
begin
  select * into v_liability from tax_liabilities where id=p_liability_id and profile_id=p_profile_id for update;
  if not found then raise exception 'Tax liability not found'; end if;
  select coalesce(sum(amount_pkr),0) into v_paid from tax_payments where liability_id=p_liability_id;
  v_pkr := case when p_currency='PKR' then p_amount else p_amount*p_rate end;
  v_usd := case when p_currency='USD' then p_amount else p_amount/p_rate end;
  if p_amount<=0 or v_pkr > v_liability.amount_pkr-v_paid+0.0001 then raise exception 'Payment exceeds outstanding tax'; end if;
  insert into transactions(profile_id,account_id,type,transaction_date,original_amount,original_currency,exchange_rate,amount_pkr,amount_usd,description,notes)
  values(p_profile_id,p_account_id,'tax_payment',p_date,p_amount,p_currency,p_rate,v_pkr,v_usd,'Tax payment',p_notes) returning id into v_tx;
  insert into tax_payments(profile_id,liability_id,transaction_id,amount_pkr,amount_usd,paid_at)
  values(p_profile_id,p_liability_id,v_tx,v_pkr,v_usd,p_date) returning id into v_payment;
  v_paid := v_paid+v_pkr;
  update tax_liabilities set status=case when v_paid>=amount_pkr-0.0001 then 'paid'::tax_status when v_paid>0 then 'partial'::tax_status else 'unpaid'::tax_status end where id=p_liability_id;
  return v_payment;
end $$;

alter table public.app_profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.accounts enable row level security;
alter table public.expense_categories enable row level security;
alter table public.income_sources enable row level security;
alter table public.transactions enable row level security;
alter table public.transfers enable row level security;
alter table public.tax_liabilities enable row level security;
alter table public.tax_payments enable row level security;
alter table public.transaction_documents enable row level security;
alter table public.audit_logs enable row level security;
-- No anon/authenticated policies by design. The server service role is the sole data gateway.

insert into public.app_profiles(id,display_name) values ('00000000-0000-0000-0000-000000000001','Owner') on conflict do nothing;
insert into public.app_settings(profile_id) values ('00000000-0000-0000-0000-000000000001') on conflict do nothing;
insert into public.accounts(profile_id,name,account_type,default_currency,sort_order) values
('00000000-0000-0000-0000-000000000001','Cash','cash','PKR',1),
('00000000-0000-0000-0000-000000000001','HBL','bank','PKR',2),
('00000000-0000-0000-0000-000000000001','Payoneer','wallet','USD',3),
('00000000-0000-0000-0000-000000000001','JazzCash','wallet','PKR',4) on conflict do nothing;
insert into public.expense_categories(profile_id,name,icon,sort_order)
select '00000000-0000-0000-0000-000000000001', n, i, o from (values
('Food','Utensils',1),('Groceries','ShoppingBasket',2),('Petrol','Fuel',3),('Transport','Bus',4),('Bills','ReceiptText',5),
('Shopping','ShoppingBag',6),('Health','HeartPulse',7),('Entertainment','Clapperboard',8),('Education','GraduationCap',9),
('Rent','House',10),('Subscriptions','Repeat',11),('Family','Users',12),('Other','Shapes',13)) v(n,i,o) on conflict do nothing;
insert into public.income_sources(profile_id,name,sort_order)
select '00000000-0000-0000-0000-000000000001', n, o from (values
('Freelancing',1),('Salary',2),('Business',3),('Client Payment',4),('Other',5)) v(n,o) on conflict do nothing;
