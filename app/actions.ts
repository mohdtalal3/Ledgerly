"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DEFAULT_PROFILE_ID } from "@/lib/constants";
import { requireSession } from "@/lib/auth/session";
import { convertMoney, calculateTax } from "@/lib/finance";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { accountSchema, settingsSchema, taxPaymentSchema, transactionSchema, transferSchema } from "@/lib/validations";

export type ActionState = { ok?: boolean; error?: string };
const text = (form: FormData, name: string) => String(form.get(name) ?? "");

export async function saveTransaction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  const parsed = transactionSchema.safeParse({
    id: text(form,"id") || undefined, type:text(form,"type"), amount:text(form,"amount"), currency:text(form,"currency"), accountId:text(form,"accountId"),
    date:text(form,"date"), description:text(form,"description"), notes:text(form,"notes"), exchangeRate:text(form,"exchangeRate"),
    categoryId:text(form,"categoryId") || undefined, sourceId:text(form,"sourceId") || undefined, merchant:text(form,"merchant"),
    reference:text(form,"reference"), taxable:form.get("taxable") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const value = parsed.data; const converted = convertMoney(value.amount, value.currency, value.exchangeRate); const db = getSupabaseAdmin();
  const row = { profile_id:DEFAULT_PROFILE_ID, account_id:value.accountId, type:value.type, transaction_date:value.date, original_amount:value.amount,
    original_currency:value.currency, exchange_rate:value.exchangeRate, amount_pkr:converted.amountPkr, amount_usd:converted.amountUsd,
    description:value.description, notes:value.notes || null, merchant:value.merchant || null, reference:value.reference || null,
    expense_category_id:value.categoryId ?? null, income_source_id:value.sourceId ?? null };
  const result = value.id ? await db.from("transactions").update(row).eq("id",value.id).eq("profile_id",DEFAULT_PROFILE_ID).select("id").single()
    : await db.from("transactions").insert(row).select("id").single();
  if (result.error) return { error: result.error.message };
  if (value.type === "income") {
    const { data: setting } = await db.from("app_settings").select("tax_percentage").eq("profile_id",DEFAULT_PROFILE_ID).single();
    const taxRate = value.taxable ? Number(setting?.tax_percentage ?? 5) : 0;
    const liability = { profile_id:DEFAULT_PROFILE_ID, income_transaction_id:result.data.id, tax_percentage:taxRate,
      amount_pkr:calculateTax(converted.amountPkr,taxRate), amount_usd:calculateTax(converted.amountUsd,taxRate), status:"unpaid" };
    const { error } = await db.from("tax_liabilities").upsert(liability,{ onConflict:"income_transaction_id" });
    if (error) return { error:`Transaction saved, but tax sync failed: ${error.message}` };
  }
  revalidatePath("/", "layout"); return { ok:true };
}

export async function deleteTransaction(id: string) {
  await requireSession();
  const db=getSupabaseAdmin();const deletedAt=new Date().toISOString();
  const{data:transaction}=await db.from("transactions").select("type,transfer_id").eq("id",id).eq("profile_id",DEFAULT_PROFILE_ID).single();
  if(transaction?.transfer_id){
    await db.from("transactions").update({deleted_at:deletedAt}).eq("transfer_id",transaction.transfer_id).eq("profile_id",DEFAULT_PROFILE_ID);
    await db.from("transfers").update({deleted_at:deletedAt}).eq("id",transaction.transfer_id).eq("profile_id",DEFAULT_PROFILE_ID);
  }else if(transaction?.type==="income"){
    const{data:liability}=await db.from("tax_liabilities").select("id,tax_payments(transaction_id)").eq("income_transaction_id",id).maybeSingle();
    const paymentIds=(liability?.tax_payments as {transaction_id:string}[]|undefined)?.map(p=>p.transaction_id)??[];
    if(paymentIds.length)await db.from("transactions").update({deleted_at:deletedAt}).in("id",paymentIds);
    if(liability)await db.from("tax_liabilities").delete().eq("id",liability.id);
    await db.from("transactions").update({deleted_at:deletedAt}).eq("id",id);
  }else if(transaction?.type==="tax_payment"){
    const{data:payment}=await db.from("tax_payments").select("liability_id").eq("transaction_id",id).maybeSingle();
    if(payment){await db.from("tax_payments").delete().eq("transaction_id",id);const{data:liability}=await db.from("tax_liabilities").select("amount_pkr,tax_payments(amount_pkr)").eq("id",payment.liability_id).single();const paid=(liability?.tax_payments as{amount_pkr:string}[]|undefined)?.reduce((n,p)=>n+Number(p.amount_pkr),0)??0;const status=paid<=0?"unpaid":paid>=Number(liability?.amount_pkr??0)-0.0001?"paid":"partial";await db.from("tax_liabilities").update({status}).eq("id",payment.liability_id)}
    await db.from("transactions").update({deleted_at:deletedAt}).eq("id",id);
  }else await db.from("transactions").update({ deleted_at:deletedAt }).eq("id",id).eq("profile_id",DEFAULT_PROFILE_ID);
  revalidatePath("/", "layout");
}

export async function saveTransfer(_: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  const parsed = transferSchema.safeParse({ fromAccountId:text(form,"fromAccountId"),toAccountId:text(form,"toAccountId"),amount:text(form,"amount"),currency:text(form,"currency"),date:text(form,"date"),exchangeRate:text(form,"exchangeRate"),fee:text(form,"fee"),notes:text(form,"notes") });
  if (!parsed.success) return { error:parsed.error.issues[0]?.message ?? "Check the transfer" };
  const v=parsed.data, db=getSupabaseAdmin(), converted=convertMoney(v.amount,v.currency,v.exchangeRate);
  const [{ data: balance },{ data: settings }] = await Promise.all([db.from("account_balances").select("current_balance,default_currency").eq("id",v.fromAccountId).single(),db.from("app_settings").select("allow_negative_balances").eq("profile_id",DEFAULT_PROFILE_ID).single()]);
  const feeConverted=v.fee>0?convertMoney(v.fee,v.currency,v.exchangeRate):{amountPkr:"0",amountUsd:"0"};
  const debit = balance?.default_currency === "USD" ? Number(converted.amountUsd)+Number(feeConverted.amountUsd) : Number(converted.amountPkr)+Number(feeConverted.amountPkr);
  if (!settings?.allow_negative_balances && Number(balance?.current_balance ?? 0) < debit) return { error:"The source account does not have enough money" };
  const { data: transfer,error }=await db.from("transfers").insert({profile_id:DEFAULT_PROFILE_ID,from_account_id:v.fromAccountId,to_account_id:v.toAccountId,transfer_date:v.date,original_amount:v.amount,original_currency:v.currency,exchange_rate:v.exchangeRate,fee_amount:v.fee,notes:v.notes||null}).select("id").single();
  if(error) return {error:error.message};
  const common={profile_id:DEFAULT_PROFILE_ID,transaction_date:v.date,original_amount:v.amount,original_currency:v.currency,exchange_rate:v.exchangeRate,amount_pkr:converted.amountPkr,amount_usd:converted.amountUsd,transfer_id:transfer.id,notes:v.notes||null};
  const rows=[{...common,account_id:v.fromAccountId,type:"transfer_out",description:"Account transfer"},{...common,account_id:v.toAccountId,type:"transfer_in",description:"Account transfer"}];
  if(v.fee>0){const{data:other}=await db.from("expense_categories").select("id").eq("profile_id",DEFAULT_PROFILE_ID).eq("name","Other").single();rows.push({...common,account_id:v.fromAccountId,type:"expense",description:"Transfer fee",original_amount:v.fee,amount_pkr:feeConverted.amountPkr,amount_usd:feeConverted.amountUsd,expense_category_id:other?.id} as typeof rows[number]);}
  const {error:txError}=await db.from("transactions").insert(rows);
  if(txError){await db.from("transfers").delete().eq("id",transfer.id);return {error:txError.message};}
  revalidatePath("/","layout"); return {ok:true};
}

export async function payTax(_:ActionState, form:FormData):Promise<ActionState>{
  await requireSession(); const parsed=taxPaymentSchema.safeParse({liabilityId:text(form,"liabilityId"),accountId:text(form,"accountId"),amount:text(form,"amount"),date:text(form,"date"),notes:text(form,"notes")});
  if(!parsed.success)return{error:parsed.error.issues[0]?.message??"Check the payment"};
  const db=getSupabaseAdmin(); const {data:settings}=await db.from("app_settings").select("usd_to_pkr_rate").eq("profile_id",DEFAULT_PROFILE_ID).single();
  if(!settings?.usd_to_pkr_rate)return{error:"No exchange rate is available"};
  const {error}=await db.rpc("record_tax_payment",{p_profile_id:DEFAULT_PROFILE_ID,p_liability_id:parsed.data.liabilityId,p_account_id:parsed.data.accountId,p_amount:parsed.data.amount,p_currency:"PKR",p_rate:settings.usd_to_pkr_rate,p_date:parsed.data.date,p_notes:parsed.data.notes??null});
  if(error)return{error:error.message}; revalidatePath("/","layout"); return{ok:true};
}

export async function saveAccount(_:ActionState,form:FormData):Promise<ActionState>{
  await requireSession(); const parsed=accountSchema.safeParse({id:text(form,"id")||undefined,name:text(form,"name"),type:text(form,"type"),currency:text(form,"currency"),openingBalance:text(form,"openingBalance"),icon:text(form,"icon"),notes:text(form,"notes")});
  if(!parsed.success)return{error:parsed.error.issues[0]?.message??"Check the account"}; const v=parsed.data;
  const row={profile_id:DEFAULT_PROFILE_ID,name:v.name,account_type:v.type,default_currency:v.currency,opening_balance:v.openingBalance,icon:v.icon||null,notes:v.notes||null};
  const q=v.id?getSupabaseAdmin().from("accounts").update(row).eq("id",v.id):getSupabaseAdmin().from("accounts").insert(row); const{error}=await q;
  if(error)return{error:error.message};revalidatePath("/","layout");return{ok:true};
}

export async function saveSettings(_:ActionState,form:FormData):Promise<ActionState>{
  await requireSession(); const parsed=settingsSchema.safeParse({appName:text(form,"appName"),defaultCurrency:text(form,"defaultCurrency"),taxPercentage:text(form,"taxPercentage"),dateFormat:text(form,"dateFormat"),allowNegativeBalances:form.get("allowNegativeBalances")==="on",theme:text(form,"theme")});
  if(!parsed.success)return{error:parsed.error.issues[0]?.message??"Check the settings"};const v=parsed.data;
  const{error}=await getSupabaseAdmin().from("app_settings").update({app_name:v.appName,default_currency:v.defaultCurrency,tax_percentage:v.taxPercentage,date_format:v.dateFormat,allow_negative_balances:v.allowNegativeBalances,theme:v.theme}).eq("profile_id",DEFAULT_PROFILE_ID);
  if(error)return{error:error.message};revalidatePath("/","layout");return{ok:true};
}

export async function saveCategory(_:ActionState,form:FormData):Promise<ActionState>{
  await requireSession();const id=text(form,"id");const name=text(form,"name").trim();if(!name||name.length>80)return{error:"Enter a category name"};
  const row={profile_id:DEFAULT_PROFILE_ID,name,icon:text(form,"icon")||"Shapes"};const q=id?getSupabaseAdmin().from("expense_categories").update(row).eq("id",id).eq("profile_id",DEFAULT_PROFILE_ID):getSupabaseAdmin().from("expense_categories").insert(row);const{error}=await q;
  if(error)return{error:error.message};revalidatePath("/settings");return{ok:true};
}

export async function saveSource(_:ActionState,form:FormData):Promise<ActionState>{
  await requireSession();const id=text(form,"id");const name=text(form,"name").trim();if(!name||name.length>80)return{error:"Enter a source name"};
  const row={profile_id:DEFAULT_PROFILE_ID,name};const q=id?getSupabaseAdmin().from("income_sources").update(row).eq("id",id).eq("profile_id",DEFAULT_PROFILE_ID):getSupabaseAdmin().from("income_sources").insert(row);const{error}=await q;
  if(error)return{error:error.message};revalidatePath("/settings");return{ok:true};
}

export async function archiveEntity(table:"accounts"|"expense_categories"|"income_sources",id:string){
  await requireSession();await getSupabaseAdmin().from(table).update({is_archived:true}).eq("id",id).eq("profile_id",DEFAULT_PROFILE_ID);revalidatePath("/settings");
}

export async function logout(){await requireSession();redirect("/api/auth/logout");}
