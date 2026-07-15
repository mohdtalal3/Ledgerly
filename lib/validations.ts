import { z } from "zod";
import { CURRENCIES } from "@/lib/constants";

const money = z.coerce.number().positive().max(1_000_000_000_000);
const uuid = z.string().uuid();
const currency = z.enum(CURRENCIES);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const pinSchema = z.object({ pin: z.string().min(4).max(64) });

export const transactionSchema = z.object({
  id: uuid.optional(),
  type: z.enum(["income", "expense"]),
  amount: money,
  currency,
  accountId: uuid,
  date,
  description: z.string().trim().min(1).max(160),
  notes: z.string().trim().max(1000).optional().default(""),
  exchangeRate: money,
  categoryId: uuid.optional(),
  sourceId: uuid.optional(),
  merchant: z.string().trim().max(120).optional().default(""),
  reference: z.string().trim().max(500).optional().default(""),
  taxable: z.coerce.boolean().optional().default(false),
}).superRefine((data, ctx) => {
  if (data.type === "expense" && !data.categoryId) ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Choose a category" });
  if (data.type === "income" && !data.sourceId) ctx.addIssue({ code: "custom", path: ["sourceId"], message: "Choose an income source" });
});

export const transferSchema = z.object({
  fromAccountId: uuid,
  toAccountId: uuid,
  amount: money,
  currency,
  date,
  exchangeRate: money,
  fee: z.coerce.number().min(0).max(1_000_000_000).default(0),
  notes: z.string().trim().max(1000).optional().default(""),
}).refine((v) => v.fromAccountId !== v.toAccountId, { path: ["toAccountId"], message: "Choose a different destination" });

export const accountSchema = z.object({
  id: uuid.optional(), name: z.string().trim().min(1).max(80), type: z.enum(["cash", "bank", "wallet"]),
  currency, openingBalance: z.coerce.number().min(0), icon: z.string().max(40).optional(), notes: z.string().max(500).optional(),
});

export const settingsSchema = z.object({
  appName: z.string().trim().min(1).max(60), defaultCurrency: currency,
  taxPercentage: z.coerce.number().min(0).max(100), dateFormat: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]),
  allowNegativeBalances: z.coerce.boolean(), theme: z.enum(["light", "dark", "system"]),
});

export const taxPaymentSchema = z.object({ liabilityId: uuid, accountId: uuid, amount: money, date, notes: z.string().max(500).optional() });
