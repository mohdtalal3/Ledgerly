"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { saveLoanEntry, type ActionState } from "@/app/actions";
import type { Account, LoanContactSummary, Settings } from "@/lib/data";

export function LoanForm({accounts,contacts,settings}:{accounts:Account[];contacts:LoanContactSummary[];settings:Settings}){
  const[state,action,pending]=useActionState(saveLoanEntry,{} as ActionState);const[type,setType]=useState<"lend"|"repayment">("lend");const[contactId,setContactId]=useState("");const router=useRouter();
  useEffect(()=>{if(state.ok){toast.success(type==="lend"?"Loan recorded":"Repayment recorded");router.refresh()}},[state.ok,type,router]);
  return <form action={action} className="card form-card form-grid two">
    <div className="field span-2"><label>ENTRY TYPE</label><select name="entryType" value={type} onChange={event=>setType(event.target.value as "lend"|"repayment")}><option value="lend">I gave money</option><option value="repayment">Money was returned</option></select></div>
    <div className="field"><label>CHOOSE PERSON</label><select name="contactId" value={contactId} onChange={event=>setContactId(event.target.value)}><option value="">Enter a name instead</option>{contacts.map(contact=><option value={contact.id} key={contact.id}>{contact.name} · PKR {contact.outstandingPkr.toLocaleString()} due</option>)}</select></div>
    <div className="field"><label>{contactId?"PERSON SELECTED":"PERSON NAME"}</label><input name="personName" disabled={Boolean(contactId)} placeholder="e.g. Talal" autoComplete="off" required={!contactId}/></div>
    <div className="field"><label>AMOUNT</label><input name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" required/></div>
    <div className="field"><label>CURRENCY</label><select name="currency" defaultValue={settings.default_currency}><option>PKR</option><option>USD</option></select></div>
    <div className="field"><label>{type==="lend"?"FROM ACCOUNT":"RETURNED TO"}</label><select name="accountId" required defaultValue=""><option value="" disabled>Select account</option>{accounts.map(account=><option value={account.id} key={account.id}>{account.name} · {account.default_currency}</option>)}</select></div>
    <div className="field"><label>DATE</label><input name="date" type="date" defaultValue={new Date().toISOString().slice(0,10)} required/></div>
    <div className="field"><label>USD → PKR RATE</label><input name="exchangeRate" type="number" min="0.000001" step="any" defaultValue={settings.usd_to_pkr_rate} required/></div>
    <div className="field span-2"><label>NOTES</label><textarea name="notes" placeholder="Optional reason or repayment details"/></div>
    {state.error&&<div className="form-message span-2">{state.error}</div>}
    <button className="btn primary span-2" disabled={pending}>{pending?<LoaderCircle className="animate-spin" size={18}/>:type==="lend"?<ArrowUpRight size={18}/>:<ArrowDownLeft size={18}/>} {type==="lend"?"Record money given":"Record returned money"}</button>
  </form>
}
