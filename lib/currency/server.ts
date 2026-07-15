import "server-only";
import { DEFAULT_PROFILE_ID } from "@/lib/constants";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { EXCHANGE_RATE_REFRESH_MS, parseUsdToPkrRate } from "@/lib/currency/exchange-rate";

const RATE_ENDPOINT = "https://api.exchangerate.fun/latest?base=USD";

export async function getUsdToPkrRate(storedRate: string) {
  try {
    const response = await fetch(RATE_ENDPOINT, {
      headers: { accept: "application/json" },
      next: { revalidate: EXCHANGE_RATE_REFRESH_MS / 1000 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Exchange-rate provider returned HTTP ${response.status}`);
    const rate = parseUsdToPkrRate(await response.json());
    if (rate !== storedRate) {
      const { error } = await getSupabaseAdmin().from("app_settings").update({
        usd_to_pkr_rate: rate,
      }).eq("profile_id", DEFAULT_PROFILE_ID);
      if (error) console.error("Unable to persist refreshed exchange rate", error.message);
    }
    return rate;
  } catch (error) {
    console.error("Unable to refresh USD to PKR rate; using the last stored rate", error);
    return storedRate;
  }
}
