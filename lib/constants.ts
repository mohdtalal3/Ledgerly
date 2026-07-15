export const DEFAULT_PROFILE_ID = "00000000-0000-0000-0000-000000000001";
export const SESSION_COOKIE = "ledgerly_session";
export const CURRENCIES = ["PKR", "USD"] as const;
export const TRANSACTION_TYPES = ["income", "expense", "transfer_in", "transfer_out", "tax_payment", "loan_out", "loan_repayment", "opening_balance", "adjustment"] as const;

export type Currency = (typeof CURRENCIES)[number];
export type TransactionType = (typeof TRANSACTION_TYPES)[number];
