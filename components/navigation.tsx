"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, FileChartColumn, HandCoins, LayoutDashboard, LogOut, Menu, Plus, ReceiptText, Repeat2, Settings, ShieldCheck, WalletCards, X } from "lucide-react";

const bottom=[
  {href:"/dashboard",label:"Dashboard",icon:LayoutDashboard},
  {href:"/income",label:"Income",icon:ArrowDownLeft},
  {href:"/transactions/new",label:"Add",icon:Plus,add:true},
  {href:"/expenses",label:"Expenses",icon:ArrowUpRight},
  {href:"/settings",label:"Settings",icon:Settings},
];
const side=[
  ...bottom.slice(0,2),
  {href:"/expenses",label:"Expenses",icon:ArrowUpRight},
  {href:"/transactions",label:"Transactions",icon:ReceiptText},
  {href:"/transfers",label:"Transfers",icon:Repeat2},
  {href:"/loans",label:"Loans",icon:HandCoins},
  {href:"/tax",label:"Tax",icon:ShieldCheck},
  {href:"/reports",label:"Reports",icon:FileChartColumn},
  {href:"/settings",label:"Settings",icon:Settings},
];
const more=side.slice(3);

export function Navigation(){
  const path=usePathname();const[open,setOpen]=useState(false);const active=(href:string)=>path===href||path.startsWith(`${href}/`);
  useEffect(()=>setOpen(false),[path]);
  return <>
    <header className="mobile-topbar"><Link href="/dashboard" className="brand"><span className="brand-mark"><WalletCards size={19}/></span>Ledgerly</Link><button className="btn mobile-menu-button" type="button" aria-expanded={open} aria-controls="mobile-more-menu" onClick={()=>setOpen(value=>!value)}>{open?<X size={19}/>:<Menu size={19}/>}More</button></header>
    {open&&<><button className="mobile-sheet-backdrop" aria-label="Close menu" onClick={()=>setOpen(false)}/><section className="mobile-sheet" id="mobile-more-menu" role="dialog" aria-modal="true" aria-label="More navigation"><div className="section-title"><div><div className="eyebrow">Navigate</div><h2>More</h2></div><button className="btn icon" type="button" aria-label="Close menu" onClick={()=>setOpen(false)}><X size={19}/></button></div><nav className="mobile-sheet-grid">{more.map(({href,label,icon:Icon})=><Link className={`sheet-link ${active(href)?"active":""}`} href={href} key={href}><span className="tx-icon"><Icon size={20}/></span>{label}</Link>)}</nav><form action="/api/auth/logout" method="post"><button className="btn danger mobile-logout"><LogOut size={18}/>Log out</button></form></section></>}
    <aside className="sidebar"><Link href="/dashboard" className="brand"><span className="brand-mark"><WalletCards size={20}/></span>Ledgerly</Link><nav>{side.map(({href,label,icon:Icon})=><Link className={`side-link ${active(href)?"active":""}`} href={href} key={href}><Icon size={19}/>{label}</Link>)}</nav><form className="side-bottom" action="/api/auth/logout" method="post"><button className="side-link" style={{border:0,width:"100%",background:"transparent"}}><LogOut size={19}/>Log out</button></form></aside>
    <nav className="bottom-nav">{bottom.map(({href,label,icon:Icon,add})=><Link className={`nav-item ${add?"nav-add":""} ${active(href)?"active":""}`} href={href} key={href}><span><Icon size={add?25:21}/></span><span>{label}</span></Link>)}</nav>
  </>
}
