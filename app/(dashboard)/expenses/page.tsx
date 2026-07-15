import Link from "next/link";
import { Plus } from "lucide-react";
import { Money } from "@/components/currency";
import { Pagination } from "@/components/pagination";
import { TransactionList } from "@/components/transaction-list";
import { getPeriodSummary, getTransactionsPage } from "@/lib/data";

export const metadata={title:"Expenses"};
export default async function Expenses({searchParams}:{searchParams:Promise<{month?:string;search?:string;page?:string}>}){
  const q=await searchParams;const month=q.month??new Date().toISOString().slice(0,7);const page=Math.max(1,Number(q.page)||1);const[ledger,summary]=await Promise.all([getTransactionsPage({type:"expense",month,search:q.search,page}),getPeriodSummary(month)]);
  return <><header className="page-header"><div><div className="eyebrow">Money out</div><h1>Expenses</h1><p className="muted">See where your money goes without the noise.</p></div><Link className="btn primary icon" href="/transactions/new"><Plus/></Link></header>
    <div className="grid summary-grid"><div className="card summary-card wide"><span className="muted">Spent this period</span><Money value={summary.expenses} className="large"/><span className="small">{summary.expenseCount} payments</span></div><div className="card summary-card"><span className="muted small">Daily average</span><Money value={summary.expenses/Math.max(1,new Date().getDate())} className="medium"/></div><div className="card summary-card"><span className="muted small">Largest expense</span><Money value={summary.expenseMax} className="medium"/></div></div>
    <div className="section toolbar"><form><input aria-label="Search expenses" name="search" placeholder="Search expenses…" defaultValue={q.search}/><input aria-label="Month" name="month" type="month" defaultValue={month}/><button className="btn">Filter</button></form></div>
    <TransactionList transactions={ledger.items} editable/><Pagination page={ledger.page} total={ledger.count} pathname="/expenses" query={{month,search:q.search}}/>
  </>
}
