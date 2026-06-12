import { getLatestAnnualRevenue, type RevenueResult } from "@/lib/sec";
import { summarizeRevenue } from "@/lib/summarize";

export const dynamic = "force-dynamic";

function formatUSD(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatPct(fraction: number): string {
  const pct = fraction * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function Receipt({ r, summary }: { r: RevenueResult; summary: string | null }) {
  return (
    <div className="card">
      <div className="company">
        <strong>{r.companyName}</strong> · {r.ticker}
      </div>
      <p className="value">{formatUSD(r.value)}</p>
      <div className="value-label">
        Annual revenue · FY{r.fiscalYear}
        {r.yoyGrowth !== null && (
          <span
            className={`growth ${r.yoyGrowth >= 0 ? "up" : "down"}`}
            title={`vs. FY${r.priorFiscalYear}: ${formatUSD(r.priorValue ?? 0)}`}
          >
            {formatPct(r.yoyGrowth)} YoY
          </span>
        )}
      </div>

      {summary && <p className="summary">{summary}</p>}

      <div className="receipt">
        <div className="receipt-title">Source receipt</div>
        <div className="receipt-row">
          <span className="k">Value</span>
          <span className="v">
            {r.value.toLocaleString("en-US")} {r.unit}
          </span>
        </div>
        <div className="receipt-row">
          <span className="k">Concept</span>
          <span className="v">{r.concept}</span>
        </div>
        <div className="receipt-row">
          <span className="k">Fiscal period</span>
          <span className="v">
            FY{r.fiscalYear} ({r.periodStart} → {r.periodEnd})
          </span>
        </div>
        {r.yoyGrowth !== null && (
          <div className="receipt-row">
            <span className="k">YoY growth</span>
            <span className="v">
              {formatPct(r.yoyGrowth)} (vs FY{r.priorFiscalYear}:{" "}
              {r.priorValue?.toLocaleString("en-US")} {r.unit})
            </span>
          </div>
        )}
        <div className="receipt-row">
          <span className="k">Form</span>
          <span className="v">{r.form}</span>
        </div>
        <div className="receipt-row">
          <span className="k">Filed</span>
          <span className="v">{r.filed}</span>
        </div>
        <div className="receipt-row">
          <span className="k">CIK</span>
          <span className="v">{r.cik}</span>
        </div>
        <div className="receipt-row">
          <span className="k">Filing</span>
          <span className="v">
            <a href={r.filingUrl} target="_blank" rel="noopener noreferrer">
              {r.accession} ↗
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ ticker?: string }>;
}) {
  const params = await searchParams;
  const ticker = (params.ticker ?? "AAPL").trim().toUpperCase();

  let result: RevenueResult | null = null;
  let summary: string | null = null;
  let error: string | null = null;

  if (ticker) {
    try {
      result = await getLatestAnnualRevenue(ticker);
      summary = await summarizeRevenue(result);
    } catch (e) {
      error = e instanceof Error ? e.message : "Lookup failed.";
    }
  }

  return (
    <main>
      <h1>SEC Revenue Lookup</h1>
      <p className="subtitle">
        Latest annual revenue from SEC XBRL company facts, with a source receipt.
      </p>

      <form method="GET">
        <input
          type="text"
          name="ticker"
          defaultValue={ticker}
          placeholder="AAPL"
          aria-label="Stock ticker"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
        <button type="submit">Look up</button>
      </form>

      {error && <div className="error">{error}</div>}
      {result && <Receipt r={result} summary={summary} />}

      <p className="hint">
        Data: SEC EDGAR (company_tickers.json + XBRL company facts). Figures are
        as-reported in the latest annual (10-K) filing.
      </p>
    </main>
  );
}
