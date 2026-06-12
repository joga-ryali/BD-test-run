// Server-side SEC EDGAR data access.
// SEC requires a descriptive User-Agent or it returns 403.
const SEC_USER_AGENT = "BD-test joga@numici.com";

// us-gaap revenue concepts, in order of preference. Companies tag revenue
// differently; the post-2018 standard is RevenueFromContractWithCustomer...,
// while older / different filers use Revenues or SalesRevenueNet.
const REVENUE_CONCEPTS = [
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "RevenueFromContractWithCustomerIncludingAssessedTax",
  "Revenues",
  "SalesRevenueNet",
];

export type RevenueResult = {
  ticker: string;
  companyName: string;
  cik: string; // 10-digit zero-padded
  concept: string;
  value: number;
  unit: string;
  fiscalYear: number;
  fiscalPeriod: string; // e.g. "FY"
  periodStart: string;
  periodEnd: string;
  form: string; // e.g. "10-K"
  filed: string;
  accession: string;
  filingUrl: string; // EDGAR filing index page
  // Prior fiscal year (from the same company-facts dataset) for YoY growth.
  priorValue: number | null;
  priorFiscalYear: number | null;
  priorPeriodEnd: string | null;
  yoyGrowth: number | null; // fractional change vs. prior FY, e.g. 0.18 = +18%
};

type TickerEntry = { cik_str: number; ticker: string; title: string };

async function secFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: {
      "User-Agent": SEC_USER_AGENT,
      Accept: "application/json",
    },
    // SEC data updates daily; cache for an hour to be a good citizen.
    next: { revalidate: 3600 },
  });
}

// Resolve a ticker symbol to a zero-padded 10-digit CIK.
async function resolveCik(
  ticker: string
): Promise<{ cik: string; companyName: string }> {
  const res = await secFetch("https://www.sec.gov/files/company_tickers.json");
  if (!res.ok) {
    throw new Error(`SEC ticker lookup failed (HTTP ${res.status}).`);
  }
  const data = (await res.json()) as Record<string, TickerEntry>;
  const target = ticker.trim().toUpperCase();
  const match = Object.values(data).find(
    (e) => e.ticker.toUpperCase() === target
  );
  if (!match) {
    throw new Error(`Ticker "${target}" not found in SEC's company list.`);
  }
  return {
    cik: String(match.cik_str).padStart(10, "0"),
    companyName: match.title,
  };
}

type FactPoint = {
  start?: string;
  end: string;
  val: number;
  accn: string;
  fy: number;
  fp: string;
  form: string;
  filed: string;
  frame?: string;
};

// Build the EDGAR filing-index URL from a CIK and accession number.
function edgarFilingUrl(cik: string, accession: string): string {
  const cikNoZeros = String(Number(cik)); // drop leading zeros
  const accnNoDashes = accession.replace(/-/g, "");
  return `https://www.sec.gov/Archives/edgar/data/${cikNoZeros}/${accnNoDashes}/${accession}-index.htm`;
}

export async function getLatestAnnualRevenue(
  ticker: string
): Promise<RevenueResult> {
  const { cik, companyName } = await resolveCik(ticker);

  const res = await secFetch(
    `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`
  );
  if (!res.ok) {
    throw new Error(`SEC company-facts fetch failed (HTTP ${res.status}).`);
  }
  const facts = (await res.json()) as {
    facts?: { "us-gaap"?: Record<string, { units?: Record<string, FactPoint[]> }> };
  };
  const usGaap = facts.facts?.["us-gaap"];
  if (!usGaap) {
    throw new Error(`No us-gaap facts available for ${companyName}.`);
  }

  for (const concept of REVENUE_CONCEPTS) {
    const usd = usGaap[concept]?.units?.["USD"];
    if (!usd || usd.length === 0) continue;

    // Annual figures: full-year 10-K entries. "frame" present and without a
    // quarter marker (Q1..Q4) indicates an annual aggregate. We also require
    // fp === "FY" and roughly a 12-month span to exclude quarterly points.
    const annual = usd.filter((p) => {
      if (p.fp !== "FY") return false;
      if (p.form !== "10-K" && p.form !== "10-K/A") return false;
      if (!p.start) return false;
      const months =
        (new Date(p.end).getTime() - new Date(p.start).getTime()) /
        (1000 * 60 * 60 * 24 * 30);
      return months >= 10 && months <= 14;
    });
    if (annual.length === 0) continue;

    // A 10-K reports the current year plus prior-year comparatives, and a
    // given fiscal year can appear in several filings (originals + restatements).
    // Dedupe by period end, keeping the most recently filed value for each,
    // then take the two most recent distinct years for YoY.
    const byEnd = new Map<string, FactPoint>();
    for (const p of annual) {
      const existing = byEnd.get(p.end);
      if (!existing || p.filed > existing.filed) byEnd.set(p.end, p);
    }
    const distinct = [...byEnd.values()].sort((a, b) =>
      a.end < b.end ? 1 : a.end > b.end ? -1 : 0
    );

    const latest = distinct[0];
    const prior = distinct[1] ?? null;
    const yoyGrowth =
      prior && prior.val !== 0 ? (latest.val - prior.val) / prior.val : null;

    // SEC's `fy` is the *filing's* fiscal year, so prior-year comparatives carry
    // the same `fy` as the latest filing. Derive the year from the period end
    // date instead, which is correct and distinct across years.
    const fyOf = (endDate: string) => new Date(endDate).getUTCFullYear();

    return {
      ticker: ticker.trim().toUpperCase(),
      companyName,
      cik,
      concept,
      value: latest.val,
      unit: "USD",
      fiscalYear: fyOf(latest.end),
      fiscalPeriod: latest.fp,
      periodStart: latest.start ?? "",
      periodEnd: latest.end,
      form: latest.form,
      filed: latest.filed,
      accession: latest.accn,
      filingUrl: edgarFilingUrl(cik, latest.accn),
      priorValue: prior?.val ?? null,
      priorFiscalYear: prior ? fyOf(prior.end) : null,
      priorPeriodEnd: prior?.end ?? null,
      yoyGrowth,
    };
  }

  throw new Error(
    `No annual revenue concept found for ${companyName}. Tried: ${REVENUE_CONCEPTS.join(", ")}.`
  );
}
