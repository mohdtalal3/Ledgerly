"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { saveTransfer, type ActionState } from "@/app/actions";
import type { Account, Settings } from "@/lib/data";

export function TransferForm({ accounts, settings }: { accounts: Account[]; settings: Settings }) {
  const [state, action, pending] = useActionState(saveTransfer, {} as ActionState);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(settings.default_currency);
  const [feeMode, setFeeMode] = useState<"fixed" | "percent">("fixed");
  const [fee, setFee] = useState("0");
  const router = useRouter();

  const calculatedFee = useMemo(() => {
    const amountValue = Number(amount);
    const feeValue = Number(fee);
    if (!Number.isFinite(amountValue) || !Number.isFinite(feeValue)) return 0;
    return feeMode === "percent" ? amountValue * feeValue / 100 : feeValue;
  }, [amount, fee, feeMode]);

  useEffect(() => {
    if (state.ok) {
      toast.success("Transfer recorded");
      router.refresh();
    }
  }, [state.ok, router]);

  return <form action={action} className="card form-card form-grid two">
    <div className="field"><label>FROM ACCOUNT</label><select name="fromAccountId" required defaultValue=""><option value="" disabled>Select source</option>{accounts.map(a => <option value={a.id} key={a.id}>{a.name} · {a.current_balance} {a.default_currency}</option>)}</select></div>
    <div className="field"><label>TO ACCOUNT</label><select name="toAccountId" required defaultValue=""><option value="" disabled>Select destination</option>{accounts.map(a => <option value={a.id} key={a.id}>{a.name}</option>)}</select></div>
    <div className="field"><label>AMOUNT</label><input name="amount" type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} required /></div>
    <div className="field"><label>CURRENCY</label><select name="currency" value={currency} onChange={event => setCurrency(event.target.value as "PKR" | "USD")}><option>PKR</option><option>USD</option></select></div>
    <div className="field"><label>DATE</label><input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></div>
    <div className="field"><label>USD → PKR RATE</label><input name="exchangeRate" type="number" min="0.000001" step="any" defaultValue={settings.usd_to_pkr_rate} required /></div>
    <div className="field"><label>FEE METHOD</label><select name="feeMode" value={feeMode} onChange={event => setFeeMode(event.target.value as "fixed" | "percent")}><option value="fixed">Fixed amount</option><option value="percent">Percentage</option></select></div>
    <div className="field"><label>{feeMode === "percent" ? "FEE PERCENTAGE" : "FEE AMOUNT"}</label><input name="fee" type="number" min="0" max={feeMode === "percent" ? "100" : undefined} step="0.01" value={fee} onChange={event => setFee(event.target.value)} /></div>
    <div className="chip span-2" style={{ justifySelf: "start" }}>Fee charged: {new Intl.NumberFormat("en-PK", { style: "currency", currency, maximumFractionDigits: currency === "PKR" ? 2 : 4 }).format(Math.max(0, calculatedFee || 0))}</div>
    <div className="field span-2"><label>NOTES</label><input name="notes" /></div>
    {state.error && <div className="form-message span-2">{state.error}</div>}
    <button className="btn primary span-2" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" size={18} /> : <ArrowRight size={18} />}Move money</button>
  </form>;
}
