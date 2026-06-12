import Anthropic from "@anthropic-ai/sdk";
import type { RevenueResult } from "./sec";

// Optional: a one-sentence plain-English summary of the revenue figure,
// written by Claude. Returns null when no API key is configured so the app
// still works without one (the SEC receipt is the core feature).
export async function summarizeRevenue(
  r: RevenueResult
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  const usd = r.value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  const growthLine =
    r.yoyGrowth !== null
      ? `\nYoY growth: ${(r.yoyGrowth * 100).toFixed(1)}% vs FY${r.priorFiscalYear}`
      : "";

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content:
            `In one sentence, summarize this company's most recent annual revenue ` +
            `for a general audience. Be factual, no preamble.\n\n` +
            `Company: ${r.companyName} (${r.ticker})\n` +
            `Annual revenue: ${usd}\n` +
            `Fiscal year: FY${r.fiscalYear} (ended ${r.periodEnd})${growthLine}\n` +
            `Source: SEC ${r.form} filing.`,
        },
      ],
    });

    const text = message.content.find((b) => b.type === "text");
    return text && text.type === "text" ? text.text.trim() : null;
  } catch {
    // Don't let a summary failure break the page — the receipt is what matters.
    return null;
  }
}
