import {WalletCards} from "lucide-react";import {LoginForm} from "@/components/login-form";
export const metadata={title:"Unlock"};
export default function Login(){return <main className="login-page"><section className="card login-card"><div className="brand"><span className="brand-mark"><WalletCards size={20}/></span>Ledgerly</div><h1>Your money,<br/>quietly organized.</h1><p className="muted">Enter your private PIN to open your finance workspace.</p><LoginForm/><p className="muted small" style={{textAlign:"center",marginTop:22}}>Encrypted session · Server-verified PIN</p></section></main>}
