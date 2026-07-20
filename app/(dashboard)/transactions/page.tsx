import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { Pagination } from "@/components/pagination";
import { TransactionList } from "@/components/transaction-list";
import { getAccounts, getTransactionsPage } from "@/lib/data";

export const metadata={title:"Transactions"};
export default async function Transactions({searchParams}:{searchParams:Promise<{month?:string;search?:string;type?:string;account?:string;page?:string}>}){
  const q=await searchParams;const month=q.month??new Date().toISOString().slice(0,7);const[ledger,accounts]=await Promise.all([getTransactionsPage({month,search:q.search,type:q.type,accountId:q.account,page:Math.max(1,Number(q.page)||1)}),getAccounts(true)]);
  return <><header className="page-header"><div><div className="eyebrow">Complete ledger</div><h1>Transactions</h1><p className="muted">Every movement, in one searchable timeline.</p></div><Link className="btn primary icon" href="/transactions/new"><Plus/></Link></header>
    <div className="toolbar"><form><input name="search" placeholder="Search…" defaultValue={q.search}/><input name="month" type="month" defaultValue={month}/><select name="account" aria-label="Account" defaultValue={q.account??""}><option value="">All accounts</option>{accounts.map(account=><option key={account.id} value={account.id}>{account.name}</option>)}</select><select name="type" defaultValue={q.type??""}><option value="">All types</option><option value="income">Income</option><option value="expense">Expense</option><option value="transfer_in">Transfers in</option><option value="transfer_out">Transfers out</option><option value="loan_out">Loans given</option><option value="loan_repayment">Loan repayments</option><option value="tax_payment">Tax payments</option></select><button className="btn">Apply</button></form><Link className="btn" href={`/api/export?month=${month}${q.account?`&account=${q.account}`:""}`}><Download size={16}/>CSV</Link></div>
    <TransactionList transactions={ledger.items} editable/><Pagination page={ledger.page} total={ledger.count} pathname="/transactions" query={{month,search:q.search,type:q.type,account:q.account}}/>
  </>
}
