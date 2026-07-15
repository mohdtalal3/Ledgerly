import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({page,total,pageSize=25,pathname,query={},pageParam="page"}:{page:number;total:number;pageSize?:number;pathname:string;query?:Record<string,string|undefined>;pageParam?:string}){
  const totalPages=Math.max(1,Math.ceil(total/pageSize));if(total===0)return null;const from=(page-1)*pageSize+1,to=Math.min(page*pageSize,total);
  const href=(target:number)=>{const params=new URLSearchParams();Object.entries(query).forEach(([key,value])=>{if(value)params.set(key,value)});params.set(pageParam,String(target));return`${pathname}?${params.toString()}`};
  return <nav className="pagination" aria-label="Pagination"><span className="muted small">Showing {from}–{to} of {total}</span><div className="pagination-actions">{page>1?<Link className="btn icon" href={href(page-1)} aria-label="Previous page"><ChevronLeft size={18}/></Link>:<button className="btn icon" disabled aria-label="Previous page"><ChevronLeft size={18}/></button>}<span className="chip">Page {page} of {totalPages}</span>{page<totalPages?<Link className="btn icon" href={href(page+1)} aria-label="Next page"><ChevronRight size={18}/></Link>:<button className="btn icon" disabled aria-label="Next page"><ChevronRight size={18}/></button>}</div></nav>
}
