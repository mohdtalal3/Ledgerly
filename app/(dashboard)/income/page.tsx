import Link from "next/link";
import { Plus } from "lucide-react";
import { Money } from "@/components/currency";
import { Pagination } from "@/components/pagination";
import { TransactionList } from "@/components/transaction-list";
import { getAccounts, getPeriodSummary, getTransactionsPage } from "@/lib/data";

export const metadata={title:"Income"};
export default async function Income({searchParams}:{searchParams:Promise<{month?:string;search?:string;account?:string;page?:string}>}){
  const q=await searchParams;const month=q.month??new Date().toISOString().slice(0,7);const page=Math.max(1,Number(q.page)||1);
  const[ledger,summary,accounts]=await Promise.all([getTransactionsPage({type:"income",month,search:q.search,accountId:q.account,page}),getPeriodSummary(month),getAccounts(true)]);
  return <><header className="page-header"><div><div className="eyebrow">Money in</div><h1>Income</h1><p className="muted">Gross earnings, sources and tax-ready records.</p></div><Link className="btn primary icon" href="/transactions/new?type=income"><Plus/></Link></header>
    <div className="grid summary-grid"><div className="card summary-card wide"><span className="muted">Income this period</span><Money value={summary.income} className="large"/><span className="small">{summary.incomeCount} entries</span></div><div className="card summary-card"><span className="muted small">Average entry</span><Money value={summary.incomeCount?summary.income/summary.incomeCount:0} className="medium"/></div><div className="card summary-card"><span className="muted small">Largest entry</span><Money value={summary.incomeMax} className="medium"/></div></div>
    <div className="section toolbar"><form><input aria-label="Search income" name="search" placeholder="Search income…" defaultValue={q.search}/><input aria-label="Month" name="month" type="month" defaultValue={month}/><select name="account" aria-label="Account" defaultValue={q.account??""}><option value="">All accounts</option>{accounts.map(account=><option key={account.id} value={account.id}>{account.name}</option>)}</select><button className="btn">Filter</button></form></div>
    <TransactionList transactions={ledger.items} editable editReturnTo="/income"/><Pagination page={ledger.page} total={ledger.count} pathname="/income" query={{month,search:q.search,account:q.account}}/>
  </>
}
