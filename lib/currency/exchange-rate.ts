import Decimal from "decimal.js";

export const EXCHANGE_RATE_REFRESH_MS = 12 * 60 * 60 * 1000;

export function parseUsdToPkrRate(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("rates" in payload)) {
    throw new Error("Exchange-rate provider returned an invalid response");
  }
  const rates = (payload as { rates?: unknown }).rates;
  if (!rates || typeof rates !== "object" || !("PKR" in rates)) {
    throw new Error("Exchange-rate provider did not return a PKR rate");
  }
  const rate = new Decimal(String((rates as { PKR?: unknown }).PKR));
  if (!rate.isFinite() || rate.lte(0)) throw new Error("Exchange-rate provider returned an invalid PKR rate");
  return rate.toFixed(6);
}
