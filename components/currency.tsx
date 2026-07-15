import type {Currency} from "@/lib/constants";
import {formatMoney} from "@/lib/finance";
export function Money({value,currency="PKR",className=""}:{value:string|number;currency?:Currency;className?:string}){return <span className={`amount ${className}`}>{formatMoney(value,currency)}</span>}
export function DualMoney({pkr,usd,className=""}:{pkr:string|number;usd:string|number;className?:string}){return <span className={`dual ${className}`}><Money value={pkr} currency="PKR"/><span className="approx">≈ {formatMoney(usd,"USD")}</span></span>}
