import "server-only";
import { cache } from "react";
import { DEFAULT_PROFILE_ID } from "@/lib/constants";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getUsdToPkrRate } from "@/lib/currency/server";

export const PAGE_SIZE = 25;
export type PageResult<T> = { items:T[]; count:number; page:number; pageSize:number; totalPages:number };

export type Settings = { app_name: string; default_currency: "PKR" | "USD"; usd_to_pkr_rate: string; tax_percentage: string; date_format: string; allow_negative_balances: boolean; theme: string };
export type Account = { id: string; name: string; account_type: string; default_currency: "PKR" | "USD"; opening_balance: string; current_balance?: string; icon?: string; notes?: string; is_archived?: boolean };
export type Category = { id: string; name: string; icon?: string; color?: string };
export type Source = { id: string; name: string };
export type Transaction = {
  id: string; type: string; transaction_date: string; original_amount: string; original_currency: "PKR" | "USD";
  amount_pkr: string; amount_usd: string; description: string; merchant?: string; account_id: string;
  accounts?: { name: string } | null; expense_categories?: { name: string } | null; income_sources?: { name: string } | null;
};
export type LoanContactSummary = { id:string; name:string; phone?:string|null; notes?:string|null; totalLentPkr:number; totalReturnedPkr:number; outstandingPkr:number; entryCount:number };
export type LoanEntry = { id:string;entry_type:"lend"|"repayment";entry_date:string;original_amount:string;original_currency:"PKR"|"USD";amount_pkr:string;amount_usd:string;notes?:string|null;loan_contacts:{name:string};transactions:{accounts:{name:string}|null}|null };
export type PeriodSummary={income:number;expenses:number;incomeCount:number;expenseCount:number;incomeMax:number;expenseMax:number;categories:Array<{name:string;value:number}>;taxGenerated:number;taxPaid:number;openTaxCount:number};
export type TaxLiability={id:string;amount_pkr:string;amount_usd:string;tax_percentage:string;status:string;created_at:string;income_description:string;income_date:string;income_original_amount:string;income_original_currency:"PKR"|"USD";paid_pkr:string};
export type LoanSummary={totalLent:number;totalReturned:number;outstanding:number;peopleWithBalance:number};

function pageNumber(value?:number){return Number.isInteger(value)&&Number(value)>0?Number(value):1}
function validUuid(value?:string){return Boolean(value&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))}
function result<T>(items:T[],count:number,page:number,pageSize=PAGE_SIZE):PageResult<T>{return{items,count,page,pageSize,totalPages:Math.max(1,Math.ceil(count/pageSize))}}
function monthRange(month:string){const safe=/^\d{4}-\d{2}$/.test(month)?month:new Date().toISOString().slice(0,7);const start=`${safe}-01`;const end=new Date(`${start}T00:00:00Z`);end.setUTCMonth(end.getUTCMonth()+1);return{start,end:end.toISOString().slice(0,10)}}

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

export async function getTransactionsPage(options:{type?:string;month?:string;search?:string;accountId?:string;page?:number;pageSize?:number}={}):Promise<PageResult<Transaction>>{
  const page=pageNumber(options.page),pageSize=options.pageSize??PAGE_SIZE,from=(page-1)*pageSize,to=from+pageSize-1;
  let query=getSupabaseAdmin().from("transactions").select("id,type,transaction_date,original_amount,original_currency,amount_pkr,amount_usd,description,merchant,account_id,accounts(name),expense_categories(name),income_sources(name)",{count:"exact"}).eq("profile_id",DEFAULT_PROFILE_ID).is("deleted_at",null).order("transaction_date",{ascending:false}).order("created_at",{ascending:false}).range(from,to);
  if(options.type)query=query.eq("type",options.type);if(validUuid(options.accountId))query=query.eq("account_id",options.accountId!);if(options.search){const search=options.search.replaceAll(",","");query=query.or(`description.ilike.%${search}%,merchant.ilike.%${search}%`)}if(options.month){const{start,end}=monthRange(options.month);query=query.gte("transaction_date",start).lt("transaction_date",end)}
  const{data,error,count}=await query;if(error)throw error;return result(data as unknown as Transaction[],count??0,page,pageSize);
}

export async function getPeriodSummary(month:string):Promise<PeriodSummary>{
  const{start,end}=monthRange(month);const{data,error}=await getSupabaseAdmin().rpc("period_financial_summary",{p_profile_id:DEFAULT_PROFILE_ID,p_start:start,p_end:end});if(error)throw error;
  const value=(data??{}) as Record<string,unknown>;return{income:Number(value.income??0),expenses:Number(value.expenses??0),incomeCount:Number(value.incomeCount??0),expenseCount:Number(value.expenseCount??0),incomeMax:Number(value.incomeMax??0),expenseMax:Number(value.expenseMax??0),categories:(value.categories as Array<{name:string;value:number|string}>??[]).map(c=>({name:c.name,value:Number(c.value)})),taxGenerated:Number(value.taxGenerated??0),taxPaid:Number(value.taxPaid??0),openTaxCount:Number(value.openTaxCount??0)};
}

export async function getDashboard(month: string) {
  const [recent,accounts,summary]=await Promise.all([getTransactions({limit:6}),getAccounts(),getPeriodSummary(month)]);
  return{transactions:recent,accounts,income:summary.income,expenses:summary.expenses,net:summary.income-summary.expenses,taxGenerated:summary.taxGenerated,taxPaid:summary.taxPaid,outstandingTax:summary.taxGenerated-summary.taxPaid,categories:summary.categories};
}

export async function getTaxData(pageValue?:number):Promise<PageResult<TaxLiability>> {
  const page=pageNumber(pageValue),from=(page-1)*PAGE_SIZE;const{data,error,count}=await getSupabaseAdmin().from("tax_liability_balances").select("*",{count:"exact"}).eq("profile_id",DEFAULT_PROFILE_ID).order("created_at",{ascending:false}).range(from,from+PAGE_SIZE-1);if(error)throw error;return result(data as TaxLiability[],count??0,page);
}

export async function getLoanContacts(search?:string,pageValue?:number):Promise<PageResult<LoanContactSummary>>{
  const page=pageNumber(pageValue),from=(page-1)*PAGE_SIZE;let query=getSupabaseAdmin().from("loan_contact_balances").select("id,name,phone,notes,total_lent_pkr,total_returned_pkr,outstanding_pkr,entry_count",{count:"exact"}).eq("profile_id",DEFAULT_PROFILE_ID).eq("is_archived",false).order("name").range(from,from+PAGE_SIZE-1);if(search)query=query.ilike("name",`%${search.replaceAll("%","")}%`);const{data,error,count}=await query;if(error)throw error;const items=(data??[]).map(c=>({id:c.id,name:c.name,phone:c.phone,notes:c.notes,totalLentPkr:Number(c.total_lent_pkr),totalReturnedPkr:Number(c.total_returned_pkr),outstandingPkr:Number(c.outstanding_pkr),entryCount:Number(c.entry_count)}));return result(items,count??0,page);
}

export async function getLoanEntries(contactId?:string,pageValue?:number):Promise<PageResult<LoanEntry>>{
  const page=pageNumber(pageValue),from=(page-1)*PAGE_SIZE;let query=getSupabaseAdmin().from("loan_entries").select("id,entry_type,entry_date,original_amount,original_currency,amount_pkr,amount_usd,notes,loan_contacts(name),transactions(accounts(name))",{count:"exact"}).eq("profile_id",DEFAULT_PROFILE_ID).order("entry_date",{ascending:false}).order("created_at",{ascending:false}).range(from,from+PAGE_SIZE-1);if(contactId)query=query.eq("contact_id",contactId);const{data,error,count}=await query;if(error)throw error;return result(data as unknown as LoanEntry[],count??0,page);
}

export async function getLoanSummary():Promise<LoanSummary>{const{data,error}=await getSupabaseAdmin().rpc("loan_financial_summary",{p_profile_id:DEFAULT_PROFILE_ID});if(error)throw error;const value=(data??{}) as Record<string,unknown>;return{totalLent:Number(value.totalLent??0),totalReturned:Number(value.totalReturned??0),outstanding:Number(value.outstanding??0),peopleWithBalance:Number(value.peopleWithBalance??0)}}
