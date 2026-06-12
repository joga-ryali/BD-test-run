# SEC Revenue Lookup

A minimal Next.js (TypeScript) app for a deploy-lifecycle dry run. Enter a stock
ticker → the server resolves it to a CIK via SEC EDGAR, fetches the latest
annual revenue from the SEC XBRL company-facts API, and shows the figure with a
**source receipt** (value, fiscal period, and a link to the filing on EDGAR).

## How it works

All data fetching happens **server-side** ([lib/sec.ts](lib/sec.ts)):

1. `ticker → CIK` via `https://www.sec.gov/files/company_tickers.json`
2. Annual revenue from `https://data.sec.gov/api/xbrl/companyfacts/CIK{10-digit}.json`,
   trying the us-gaap revenue concept variants in order
   (`RevenueFromContractWithCustomerExcludingAssessedTax`,
   `RevenueFromContractWithCustomerIncludingAssessedTax`, `Revenues`,
   `SalesRevenueNet`) and picking the latest full-year 10-K figure.

SEC requires a descriptive `User-Agent` header (set in `lib/sec.ts`) or it
returns 403.

## Optional: Claude summary

If `ANTHROPIC_API_KEY` is set, the app adds a one-sentence plain-English summary
of the revenue using Claude (`claude-haiku-4-5`). Without the key, the app works
fine — the SEC receipt is the core feature.

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000
# optional: ANTHROPIC_API_KEY=sk-ant-... npm run dev
```

## Deploy on Vercel

1. Push to GitHub (already wired to `origin`).
2. Vercel → Add New → Project → Import this repo → Deploy.
3. (Optional) Settings → Environment Variables → add `ANTHROPIC_API_KEY` → Redeploy.
