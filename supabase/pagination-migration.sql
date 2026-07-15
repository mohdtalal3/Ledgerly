-- Run once on existing installations. Fresh installations only need schema.sql.

create or replace view public.loan_contact_balances with (security_invoker = false) as
select c.id, c.profile_id, c.name, c.phone, c.notes, c.is_archived,
  coalesce(sum(le.amount_pkr) filter (where le.entry_type='lend'),0) as total_lent_pkr,
  coalesce(sum(le.amount_pkr) filter (where le.entry_type='repayment'),0) as total_returned_pkr,
  coalesce(sum(case when le.entry_type='lend' then le.amount_pkr else -le.amount_pkr end),0) as outstanding_pkr,
  count(le.id)::integer as entry_count
from public.loan_contacts c left join public.loan_entries le on le.contact_id=c.id
group by c.id;

create or replace view public.tax_liability_balances with (security_invoker = false) as
select tl.id, tl.profile_id, tl.income_transaction_id, tl.tax_percentage, tl.amount_pkr, tl.amount_usd, tl.status, tl.created_at,
  t.description as income_description, t.transaction_date as income_date, t.original_amount as income_original_amount, t.original_currency as income_original_currency,
  coalesce(sum(tp.amount_pkr),0) as paid_pkr
from public.tax_liabilities tl
join public.transactions t on t.id=tl.income_transaction_id
left join public.tax_payments tp on tp.liability_id=tl.id
group by tl.id,t.id;

create or replace function public.period_financial_summary(p_profile_id uuid, p_start date, p_end date)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'income', coalesce(sum(t.amount_pkr) filter(where t.type='income'),0),
    'expenses', coalesce(sum(t.amount_pkr) filter(where t.type='expense'),0),
    'incomeCount', count(*) filter(where t.type='income'),
    'expenseCount', count(*) filter(where t.type='expense'),
    'incomeMax', coalesce(max(t.amount_pkr) filter(where t.type='income'),0),
    'expenseMax', coalesce(max(t.amount_pkr) filter(where t.type='expense'),0),
    'categories', (select coalesce(jsonb_agg(jsonb_build_object('name',x.name,'value',x.value) order by x.value desc),'[]'::jsonb) from (
      select coalesce(c.name,'Other') name,sum(e.amount_pkr) value from transactions e
      left join expense_categories c on c.id=e.expense_category_id
      where e.profile_id=p_profile_id and e.deleted_at is null and e.type='expense' and e.transaction_date>=p_start and e.transaction_date<p_end
      group by coalesce(c.name,'Other')
    ) x),
    'taxGenerated', (select coalesce(sum(amount_pkr),0) from tax_liabilities where profile_id=p_profile_id),
    'taxPaid', (select coalesce(sum(amount_pkr),0) from tax_payments where profile_id=p_profile_id),
    'openTaxCount', (select count(*) from tax_liabilities where profile_id=p_profile_id and status<>'paid')
  )
  from transactions t where t.profile_id=p_profile_id and t.deleted_at is null and t.transaction_date>=p_start and t.transaction_date<p_end;
$$;

create or replace function public.loan_financial_summary(p_profile_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'totalLent', coalesce(sum(amount_pkr) filter(where entry_type='lend'),0),
    'totalReturned', coalesce(sum(amount_pkr) filter(where entry_type='repayment'),0),
    'outstanding', coalesce(sum(case when entry_type='lend' then amount_pkr else -amount_pkr end),0),
    'peopleWithBalance', (select count(*) from loan_contact_balances where profile_id=p_profile_id and outstanding_pkr>0)
  ) from loan_entries where profile_id=p_profile_id;
$$;
