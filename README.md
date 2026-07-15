# Ledgerly

Ledgerly is a private, mobile-first personal expense tracker for PKR and USD. It combines account balances, income, expenses, transfers, configurable income-tax reserves, reports, and CSV export in a single Next.js application designed for Vercel and Supabase.

## Features

- PIN login with a signed, HTTP-only, expiring session cookie and basic failed-attempt throttling.
- Dashboard with dual-currency balance, monthly cash flow, account balances, tax totals, category spending, and recent activity.
- Income and expense ledgers with search, month filters, categories/sources, editing-safe calculated balances, and soft deletion.
- PKR/USD original values, automatic 12-hour USD→PKR refreshes, per-transaction rate overrides, and approximate converted values.
- Tax liabilities generated from taxable income at a configurable percentage; partial/full tax payments reduce the selected account only when paid.
- Account-to-account transfers that do not count as income or expenses, with balance checks and optional negative balances.
- Accounts, categories, income sources, general financial rules, theme preference, and security controls in Settings.
- Responsive report table and authenticated CSV export.
- Mobile bottom navigation and compact desktop sidebar, dark system theme, touch-friendly controls, empty states, and toast feedback.

## Local development

Requirements: Node.js 20+ and a Supabase project.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Never commit `.env` or `.env.local`.

## Environment variables

| Variable | Purpose | Exposure |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Browser-safe, although this app uses it server-side |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Reserved for a future Supabase Auth integration | Browser-safe; not used for writes |
| `SUPABASE_SERVICE_ROLE_KEY` | Server database access | Secret; never exposed to Client Components |
| `APP_LOGIN_PIN` | Private unlock PIN | Secret; compared only on the server |
| `SESSION_SECRET` | HS256 session signing key, at least 32 characters | Secret |

Generate the session secret with `openssl rand -base64 48`. The repository's original `.env` was not in `KEY=value` form; replace it with a valid `.env.local` based on `.env.example`.

## Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor → New query**.
3. Paste and run [`supabase/schema.sql`](supabase/schema.sql).
4. Copy the project URL, anon key, and service-role key from Project Settings into `.env.local`.
5. Restart the Next.js development server after changing environment variables.

The schema enables RLS but deliberately creates no browser roles/policies. All access goes through the service-role client in server-only modules. Never place the service key in a variable prefixed with `NEXT_PUBLIC_`.

The migration seeds one future-compatible profile plus Cash, HBL, Payoneer, JazzCash, thirteen expense categories, and five income sources. All financial tables carry `profile_id` so Supabase Auth and multiple users can be added later.

## Authentication

The login Route Handler receives a PIN, hashes both values with SHA-256, and performs a timing-safe comparison against `APP_LOGIN_PIN`. On success it signs a two-week JWT stored in the `ledgerly_session` cookie with `HttpOnly`, `SameSite=Lax`, and `Secure` in production. Middleware performs an early cookie-presence redirect, while the protected layout cryptographically verifies the token.

Five failed attempts from the same forwarded IP trigger a 15-minute best-effort in-memory lock. Because Vercel functions are distributed and ephemeral, connect this counter to Vercel KV or Upstash for strict cross-instance enforcement.

To change the PIN, update `APP_LOGIN_PIN` locally or in Vercel and restart/redeploy. Existing signed sessions remain active until logout/expiry; rotate `SESSION_SECRET` to invalidate all of them.

## Financial model

Money is stored as PostgreSQL `numeric(20,4)` and exchange rates as `numeric(20,6)`. JavaScript calculations use Decimal.js—never binary floating point for persisted conversion or tax values.

The server reads USD→PKR from `https://api.exchangerate.fun/latest?base=USD`. Next.js caches the provider response for 12 hours, and each successful changed value is persisted to `app_settings.usd_to_pkr_rate`. The last stored value is used if the provider is temporarily unavailable. The API is never called from the browser and does not need a key.

Each transaction stores its original amount/currency, applied USD→PKR rate, `amount_pkr`, and `amount_usd`. A PKR transaction divides by the rate for USD; a USD transaction multiplies by it for PKR. The current live rate pre-fills forms, but it can be overridden for the actual settled rate. Historical transactions are never silently repriced. Converted UI values are marked approximate.

Account balance is a database view:

```text
opening balance
+ income + transfer in + opening-balance credits
- expenses - transfer out - tax payments - debit adjustments
```

The current balance is never directly editable. Opening balance is an account property. Soft-deleted transactions leave the calculation automatically.

### Tax

Taxable income creates a liability linked one-to-one to its income transaction. At the default 5%, PKR 100,000 creates PKR 5,000 tax due. Creating that liability does not move account cash. The `record_tax_payment` PostgreSQL function locks the liability, rejects overpayment, inserts the payment transaction, and derives `unpaid`, `partial`, or `paid` status atomically. Only an actual payment debits its selected account.

### Transfers

A transfer has a parent record and linked debit/credit transaction rows. Those rows affect source/destination balances but are excluded from income and expense totals. Source and destination must differ. The server checks calculated source balance unless negative balances are enabled. An optional transfer fee creates a linked expense in the default “Other” category.

## Verification

```bash
npm test
npm run lint
npm run build
```

The finance unit tests cover exact conversion, configurable tax, signed ledger direction, and decimal summation.

## Vercel deployment

1. Push the project to a Git provider and import it in Vercel.
2. Set all five environment variables for Production and Preview.
3. Confirm `supabase/schema.sql` ran in the matching Supabase project.
4. Keep the default Framework Preset (Next.js), install command (`npm install`), and build command (`npm run build`).
5. Deploy, visit `/login`, and verify a small income/expense/transfer before importing real records.

No persistent filesystem, background server, paid currency API, or custom long-running process is required.

## Current limitations

- Receipt fields store a URL/reference; Supabase Storage upload UI is not included yet.
- Login throttling is process-local until a distributed rate-limit store is connected.
- Settings supports add/archive for categories and sources; drag-and-drop ordering and inline renaming are not yet exposed in the UI (the schema supports both).
- A full multi-tenant switch requires Supabase Auth and profile-scoped RLS policies; the schema is prepared but the app intentionally remains single-user.

See [`MEMORY.md`](MEMORY.md) for implementation invariants and continuation guidance.
