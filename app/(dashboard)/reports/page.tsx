import Link from "next/link";
import { Download } from "lucide-react";
import { ExpenseCategoryChart, IncomeExpenseChart } from "@/components/charts";
import { Money } from "@/components/currency";
import { Pagination } from "@/components/pagination";
import { getPeriodSummary, getTransactionsPage } from "@/lib/data";

export const metadata={title:"Reports"};
export default async function Reports({searchParams}:{searchParams:Promise<{month?:string;page?:string;view?:string}>}){
  const q=await searchParams;const month=q.month??new Date().toISOString().slice(0,7);const grouped=q.view==="category";const[summary,expenses]=await Promise.all([getPeriodSummary(month),getTransactionsPage({type:"expense",month,page:Math.max(1,Number(q.page)||1)})]);
  return <><header className="page-header"><div><div className="eyebrow">Analytics & export</div><h1>Reports</h1><p className="muted">Patterns you can act on, with raw data when you need it.</p></div><Link className="btn" href={`/api/export?month=${month}`}><Download size={17}/>Export CSV</Link></header>
    <div className="toolbar"><form>{grouped&&<input type="hidden" name="view" value="category"/>}<input name="month" type="month" defaultValue={month}/><button className="btn">View report</button></form></div>
    <section className="grid summary-grid"><Card label="Income" value={summary.income}/><Card label="Expenses" value={summary.expenses}/><Card label="Savings" value={summary.income-summary.expenses}/><Card label="Daily spend" value={summary.expenses/Math.max(1,new Date().getDate())}/></section>
    <section className="section card"><div className="section-title"><h2>Income vs expenses</h2><span className="chip">{month}</span></div><IncomeExpenseChart income={summary.income} expenses={summary.expenses}/></section>
    <section className="section card"><div className="section-title"><div><h2>Detailed expenses</h2><span className="muted small">{grouped?`${summary.categories.length} categories`:`${expenses.count} records`}</span></div><div style={{display:"flex",gap:8}}><Link className={`btn${grouped?"":" primary"}`} href={`/reports?month=${month}`}>Transactions</Link><Link className={`btn${grouped?" primary":""}`} href={`/reports?month=${month}&view=category`}>By category</Link></div></div>{grouped?<><ExpenseCategoryChart categories={summary.categories}/>{summary.categories.length>0&&<div className="table-wrap"><table className="data-table"><thead><tr><th>Category</th><th>Total expense</th><th>Share of expenses</th></tr></thead><tbody>{summary.categories.map(category=><tr key={category.name}><td>{category.name}</td><td><Money value={category.value}/></td><td>{summary.expenses>0?(category.value/summary.expenses*100).toFixed(1):"0.0"}%</td></tr>)}</tbody></table></div>}</>:<><div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Account</th><th>Original</th><th>PKR value</th></tr></thead><tbody>{expenses.items.map(t=><tr key={t.id}><td>{t.transaction_date}</td><td>{t.merchant||t.description}</td><td>{t.expense_categories?.name}</td><td>{t.accounts?.name}</td><td><Money value={t.original_amount} currency={t.original_currency}/></td><td><Money value={t.amount_pkr}/></td></tr>)}</tbody></table></div><Pagination page={expenses.page} total={expenses.count} pathname="/reports" query={{month}}/></>}</section>
  </>
}
function Card({label,value}:{label:string;value:number}){return <div className="card summary-card"><span className="muted small">{label}</span><Money value={value} className="medium"/></div>}
