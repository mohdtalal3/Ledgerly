import { Pagination } from "@/components/pagination";
import { TransactionList } from "@/components/transaction-list";
import { TransferForm } from "@/components/transfer-form";
import { getAccounts, getSettings, getTransactionsPage } from "@/lib/data";

export const metadata={title:"Transfers"};
export default async function Transfers({searchParams}:{searchParams:Promise<{page?:string}>}){const q=await searchParams;const[accounts,settings,ledger]=await Promise.all([getAccounts(),getSettings(),getTransactionsPage({type:"transfer_out",page:Math.max(1,Number(q.page)||1)})]);return <><header className="page-header"><div><div className="eyebrow">Between accounts</div><h1>Transfer money</h1><p className="muted">Moves balances without inflating income or spending.</p></div></header><TransferForm accounts={accounts} settings={settings}/><section className="section"><div className="section-title"><h2>Transfer history</h2><span className="muted small">{ledger.count} total</span></div><TransactionList transactions={ledger.items}/><Pagination page={ledger.page} total={ledger.count} pathname="/transfers"/></section></>}
