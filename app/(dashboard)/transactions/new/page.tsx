import { notFound } from "next/navigation";
import { TransactionForm } from "@/components/transaction-form";
import { getAccounts, getCategories, getSettings, getSources, getTransactionForEdit } from "@/lib/data";

export const metadata={title:"Add transaction"};

export default async function NewTransaction({searchParams}:{searchParams:Promise<{type?:string;id?:string;returnTo?:string}>}){
  const q=await searchParams;
  const editing=Boolean(q.id);
  const[accounts,categories,sources,settings,transaction]=await Promise.all([getAccounts(editing),getCategories(editing),getSources(editing),getSettings(),q.id?getTransactionForEdit(q.id):Promise.resolve(null)]);
  if(q.id&&!transaction)notFound();
  const returnTo=["/transactions","/expenses","/income"].includes(q.returnTo??"")?q.returnTo:undefined;
  return <><header className="page-header"><div><div className="eyebrow">{editing?"Edit entry":"New entry"}</div><h1>{editing?"Edit transaction":"Add transaction"}</h1><p className="muted">{editing?"Update the details and save your changes.":"Record it once. Balances and reports update automatically."}</p></div></header><TransactionForm accounts={accounts} categories={categories} sources={sources} settings={settings} initialType={q.type==="income"?"income":"expense"} transaction={transaction} returnTo={returnTo}/></>;
}
