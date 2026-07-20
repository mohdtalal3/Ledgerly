"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { saveTransaction, type ActionState } from "@/app/actions";
import type { Account, Category, EditableTransaction, Settings, Source } from "@/lib/data";

const initial: ActionState = {};

export function TransactionForm({
  accounts,
  categories,
  sources,
  settings,
  initialType = "expense",
  transaction,
  returnTo,
}: {
  accounts: Account[];
  categories: Category[];
  sources: Source[];
  settings: Settings;
  initialType?: "income" | "expense";
  transaction?: EditableTransaction | null;
  returnTo?: string;
}) {
  const editing = Boolean(transaction);
  const [type, setType] = useState<"income" | "expense">(transaction?.type ?? initialType);
  const [state, action, pending] = useActionState(saveTransaction, initial);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      toast.success(editing ? "Transaction updated" : "Transaction saved");
      router.push(returnTo ?? (type === "income" ? "/income" : "/expenses"));
      router.refresh();
    }
  }, [state.ok, router, type, editing, returnTo]);

  return <form action={action} className="card form-card form-grid two">
    {transaction && <input type="hidden" name="id" value={transaction.id} />}
    <div className="field span-2"><label>TRANSACTION TYPE</label>{editing?<><input type="hidden" name="type" value={type}/><select value={type} disabled><option value="expense">Expense</option><option value="income">Income</option></select></>:<select name="type" value={type} onChange={event=>setType(event.target.value as typeof type)}><option value="expense">Expense</option><option value="income">Income</option></select>}</div>
    <div className="field"><label>AMOUNT</label><input name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00" defaultValue={transaction?.original_amount} required /></div>
    <div className="field"><label>CURRENCY</label><select name="currency" defaultValue={transaction?.original_currency??settings.default_currency}><option>PKR</option><option>USD</option></select></div>
    <div className="field"><label>ACCOUNT</label><select name="accountId" required defaultValue={transaction?.account_id??""}><option value="" disabled>Select account</option>{accounts.map(account=><option value={account.id} key={account.id}>{account.name} · {account.default_currency}</option>)}</select></div>
    <div className="field"><label>DATE</label><input name="date" type="date" defaultValue={transaction?.transaction_date??new Date().toISOString().slice(0,10)} required /></div>
    {type==="expense"?<div className="field"><label>CATEGORY</label><select name="categoryId" required defaultValue={transaction?.expense_category_id??""}><option value="" disabled>Select category</option>{categories.map(category=><option value={category.id} key={category.id}>{category.name}</option>)}</select></div>:<div className="field"><label>INCOME SOURCE</label><select name="sourceId" required defaultValue={transaction?.income_source_id??""}><option value="" disabled>Select source</option>{sources.map(source=><option value={source.id} key={source.id}>{source.name}</option>)}</select></div>}
    {type==="expense"&&<div className="field"><label>MERCHANT / PAYEE</label><input name="merchant" placeholder="Who was paid?" defaultValue={transaction?.merchant??""}/></div>}
    <div className="field"><label>DESCRIPTION</label><input name="description" placeholder="Optional details" defaultValue={["Expense","Income"].includes(transaction?.description??"")?"":transaction?.description??""} /></div>
    <div className="field"><label>USD → PKR RATE</label><input name="exchangeRate" type="number" step="any" min="0.000001" defaultValue={transaction?.exchange_rate??settings.usd_to_pkr_rate} required /></div>
    <div className="field"><label>RECEIPT REFERENCE</label><input name="reference" placeholder="URL, invoice or file reference" defaultValue={transaction?.reference??""}/></div>
    {type==="income"&&<label className="check span-2"><input name="taxable" type="checkbox" defaultChecked={transaction?transaction.taxable:true}/>Reserve {settings.tax_percentage}% income tax</label>}
    <div className="field span-2"><label>NOTES</label><textarea name="notes" placeholder="Optional context" defaultValue={transaction?.notes??""}/></div>
    {state.error&&<div className="form-message span-2">{state.error}</div>}
    <button className="btn primary span-2" disabled={pending}>{pending?<LoaderCircle className="animate-spin" size={18}/>:<Save size={18}/>}Save {type}</button>
  </form>;
}
