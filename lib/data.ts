import "server-only";
import { cache } from "react";
import { DEFAULT_PROFILE_ID } from "@/lib/constants";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getUsdToPkrRate } from "@/lib/currency/server";

export type Settings = { app_name: string; default_currency: "PKR" | "USD"; usd_to_pkr_rate: string; tax_percentage: string; date_format: string; allow_negative_balances: boolean; theme: string };
export type Account = { id: string; name: string; account_type: string; default_currency: "PKR" | "USD"; opening_balance: string; current_balance?: string; icon?: string; notes?: string; is_archived?: boolean };
export type Category = { id: string; name: string; icon?: string; color?: string };
export type Source = { id: string; name: string };
export type Transaction = {
  id: string; type: string; transaction_date: string; original_amount: string; original_currency: "PKR" | "USD";
  amount_pkr: string; amount_usd: string; description: string; merchant?: string; account_id: string;
  accounts?: { name: string } | null; expense_categories?: { name: string } | null; income_sources?: { name: string } | null;
};

export const getSettings = cache(async () => {
  const { data, error } = await getSupabaseAdmin().from("app_settings").select("*").eq("profile_id", DEFAULT_PROFILE_ID).single();
  if (error) throw error;
  const settings = data as Settings;
  settings.usd_to_pkr_rate = await getUsdToPkrRate(settings.usd_to_pkr_rate);
  return settings;
});

export const getAccounts = cache(async (includeArchived = false) => {
  let query = getSupabaseAdmin().from("account_balances").select("*").eq("profile_id", DEFAULT_PROFILE_ID).order("name");
  if (!includeArchived) query = query.eq("is_archived", false);
  const { data, error } = await query;
  if (error) throw error;
  return data as Account[];
});

export const getCategories = cache(async () => {
  const { data, error } = await getSupabaseAdmin().from("expense_categories").select("id,name,icon,color").eq("profile_id", DEFAULT_PROFILE_ID).eq("is_archived", false).order("sort_order");
  if (error) throw error;
  return data as Category[];
});

export const getSources = cache(async () => {
  const { data, error } = await getSupabaseAdmin().from("income_sources").select("id,name").eq("profile_id", DEFAULT_PROFILE_ID).eq("is_archived", false).order("sort_order");
  if (error) throw error;
  return data as Source[];
});

export async function getTransactions(options: { type?: string; month?: string; search?: string; limit?: number } = {}) {
  let query = getSupabaseAdmin().from("transactions")
    .select("id,type,transaction_date,original_amount,original_currency,amount_pkr,amount_usd,description,merchant,account_id,accounts(name),expense_categories(name),income_sources(name)")
    .eq("profile_id", DEFAULT_PROFILE_ID).is("deleted_at", null).order("transaction_date", { ascending: false }).order("created_at", { ascending: false }).limit(options.limit ?? 100);
  if (options.type) query = query.eq("type", options.type);
  if (options.search) query = query.or(`description.ilike.%${options.search.replaceAll(",", "") }%,merchant.ilike.%${options.search.replaceAll(",", "")}%`);
  if (options.month && /^\d{4}-\d{2}$/.test(options.month)) {
    const start = `${options.month}-01`;
    const end = new Date(`${start}T00:00:00Z`); end.setUTCMonth(end.getUTCMonth() + 1);
    query = query.gte("transaction_date", start).lt("transaction_date", end.toISOString().slice(0, 10));
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as Transaction[];
}

export async function getDashboard(month: string) {
  const transactions = await getTransactions({ month, limit: 1000 });
  const accounts = await getAccounts();
  const income = transactions.filter((t) => t.type === "income").reduce((n, t) => n + Number(t.amount_pkr), 0);
  const expenses = transactions.filter((t) => t.type === "expense").reduce((n, t) => n + Number(t.amount_pkr), 0);
  const categoryMap = new Map<string, number>();
  transactions.filter((t) => t.type === "expense").forEach((t) => categoryMap.set(t.expense_categories?.name ?? "Other", (categoryMap.get(t.expense_categories?.name ?? "Other") ?? 0) + Number(t.amount_pkr)));
  const { data: liabilities } = await getSupabaseAdmin().from("tax_liabilities").select("amount_pkr,tax_payments(amount_pkr)").eq("profile_id", DEFAULT_PROFILE_ID);
  const taxGenerated = liabilities?.reduce((n, row) => n + Number(row.amount_pkr), 0) ?? 0;
  const taxPaid = liabilities?.reduce((n, row) => n + (row.tax_payments as { amount_pkr: string }[]).reduce((s, p) => s + Number(p.amount_pkr), 0), 0) ?? 0;
  return { transactions, accounts, income, expenses, net: income - expenses, taxGenerated, taxPaid, outstandingTax: taxGenerated - taxPaid, categories: [...categoryMap].map(([name, value]) => ({ name, value })) };
}

export async function getTaxData() {
  const { data, error } = await getSupabaseAdmin().from("tax_liabilities")
    .select("id,amount_pkr,amount_usd,tax_percentage,status,created_at,transactions!income_transaction_id(description,transaction_date,original_amount,original_currency),tax_payments(amount_pkr,paid_at)")
    .eq("profile_id", DEFAULT_PROFILE_ID).order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as Array<{ id:string; amount_pkr:string; amount_usd:string; tax_percentage:string; status:string; created_at:string; transactions:{description:string;transaction_date:string;original_amount:string;original_currency:"PKR"|"USD"};tax_payments:{amount_pkr:string;paid_at:string}[] }>;
}
