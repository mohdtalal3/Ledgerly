import Decimal from "decimal.js";
import type { Currency } from "@/lib/constants";

Decimal.set({ precision: 32, rounding: Decimal.ROUND_HALF_UP });

export type ConvertedMoney = { amountPkr: string; amountUsd: string };

export function decimal(value: Decimal.Value) {
  return new Decimal(value || 0);
}

export function convertMoney(amount: Decimal.Value, currency: Currency, usdToPkr: Decimal.Value): ConvertedMoney {
  const value = decimal(amount);
  const rate = decimal(usdToPkr);
  if (value.lte(0)) throw new Error("Amount must be greater than zero");
  if (rate.lte(0)) throw new Error("Exchange rate must be greater than zero");
  return currency === "USD"
    ? { amountUsd: value.toFixed(4), amountPkr: value.mul(rate).toFixed(4) }
    : { amountPkr: value.toFixed(4), amountUsd: value.div(rate).toFixed(4) };
}

export function calculateTax(amount: Decimal.Value, percentage: Decimal.Value) {
  return decimal(amount).mul(decimal(percentage)).div(100).toFixed(4);
}

export function sum(values: Decimal.Value[]) {
  return Decimal.sum(0, ...values).toFixed(4);
}

export function formatMoney(value: Decimal.Value, currency: Currency, compact = false) {
  const number = decimal(value).toNumber();
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: currency === "PKR" ? 0 : 2,
  }).format(number);
}

export function signedAmount(type: string, amount: Decimal.Value) {
  const credit = ["income", "transfer_in", "opening_balance"].includes(type);
  return decimal(amount).mul(credit ? 1 : -1);
}
