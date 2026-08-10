import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { chromium } from "npm:playwright@1.52.0";

/* ── Types ── */

interface TariffItem {
  minUnits: number | null;
  maxUnits: number | null;
  ratePerKWh: number;
  fixedCharges: number | null;
  rawUnitText: string;
}

interface TariffResult {
  protected: TariffItem[];
  unprotected: TariffItem[];
  source: "live" | "fallback";
  fetchedAt: string;
  warning?: string;
}

interface ExtractionResponse {
  error?: string;
  protected: TariffItem[];
  unprotected: TariffItem[];
  warnings: string[];
}

/* ── February 2026 Fallback Tariff (IESCO A-1 Residential) ── */

const FALLBACK_DATA: TariffResult = {
  protected: [
    { minUnits: 0, maxUnits: 50, ratePerKWh: 3.95, fixedCharges: null, rawUnitText: "Up to 50 Units - Life Line" },
    { minUnits: 1, maxUnits: 100, ratePerKWh: 7.74, fixedCharges: null, rawUnitText: "01 - 100 Units - Life Line" },
    { minUnits: 1, maxUnits: 100, ratePerKWh: 10.54, fixedCharges: 200, rawUnitText: "001 - 100 Units" },
    { minUnits: 101, maxUnits: 200, ratePerKWh: 13.01, fixedCharges: 300, rawUnitText: "101 - 200 Units" },
  ],
  unprotected: [
    { minUnits: 1, maxUnits: 100, ratePerKWh: 22.44, fixedCharges: 275, rawUnitText: "1- 100 Units" },
    { minUnits: 101, maxUnits: 200, ratePerKWh: 28.91, fixedCharges: 300, rawUnitText: "101 - 200 Units" },
    { minUnits: 201, maxUnits: 300, ratePerKWh: 33.1, fixedCharges: 350, rawUnitText: "201 - 300 Units" },
    { minUnits: 301, maxUnits: 400, ratePerKWh: 36.46, fixedCharges: 400, rawUnitText: "301 - 400 Units" },
    { minUnits: 401, maxUnits: 500, ratePerKWh: 38.95, fixedCharges: 500, rawUnitText: "401 - 500 Units" },
    { minUnits: 501, maxUnits: 600, ratePerKWh: 40.22, fixedCharges: 675, rawUnitText: "501 - 600 Units" },
    { minUnits: 601, maxUnits: 700, ratePerKWh: 41.85, fixedCharges: 675, rawUnitText: "601 - 700 Units" },
    { minUnits: 701, maxUnits: null, ratePerKWh: 47.2, fixedCharges: 675, rawUnitText: "Above 700 Units" },
  ],
  source: "fallback",
  fetchedAt: new Date().toISOString(),
};

/* ── Validation ── */

function validateResult(result: ExtractionResponse): string | null {
  if (result.protected.length === 0 && result.unprotected.length === 0) {
    return "No tariff items extracted from any section";
  }
  // Each item must have a valid rate
  for (const item of [...result.protected, ...result.unprotected]) {
    if (typeof item.ratePerKWh !== "number" || isNaN(item.ratePerKWh)) {
      return `Invalid rate in item: ${item.rawUnitText}`;
    }
  }
  return null;
}

/* ── Bright Data scraper ── */

async function scrapeLiveTariffs(brightDataEndpoint: string): Promise<TariffResult> {
  const browser = await chromium.connectOverCDP(brightDataEndpoint);
  try {
    const context = browser.contexts()[0] || await browser.newContext();
    const page = await context.newPage();

    await page.goto("https://iesco.com.pk/tariff-guide", {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    // Extract the DOM in one evaluate call — plain JS runs in the browser.
    // Verified against the inspected DOM (spec §6/§7/§10):
    //   - div.custom-subheader "A-1 GENERAL SUPPLY TARIFF - RESIDENTIAL" is the table's previousElementSibling
    //   - "Protected" / "Un-Protected" are <td> label rows (exact text)
    //   - unit/range = td index 1, fixed/kW = td index 3, rate = last td (index 5)
    //   - stop at first tr th.custom-fs (A-2 boundary)
    const extraction: ExtractionResponse = await page.evaluate(() => {
      const parseUnitRange = (text) => {
        const trimmed = text.trim();
        const upToMatch = trimmed.match(/^Up\s+to\s+(\d+)/i);
        if (upToMatch) return { minUnits: 0, maxUnits: parseInt(upToMatch[1], 10) };
        const aboveMatch = trimmed.match(/^Above\s+(\d+)/i);
        if (aboveMatch) return { minUnits: parseInt(aboveMatch[1], 10) + 1, maxUnits: null };
        const rangeMatch = trimmed.match(/(\d+)\s*-\s*(\d+)/);
        if (rangeMatch) {
          return { minUnits: parseInt(rangeMatch[1], 10), maxUnits: parseInt(rangeMatch[2], 10) };
        }
        return { minUnits: null, maxUnits: null };
      };

      const extractItems = (rows) => {
        const items = [];
        const warnings = [];
        for (const row of rows) {
          if (!row.isData || row.cells.length < 6) continue;
          const rawRate = (row.cells[5] || "").trim();
          const rate = parseFloat(rawRate);
          if (isNaN(rate)) continue;
          const rawUnit = (row.cells[1] || "").trim();
          const range = parseUnitRange(rawUnit);
          const rawFixed = (row.cells[3] || "").trim();
          const fixedCharges = (rawFixed === "-" || rawFixed === "" || rawFixed === "&nbsp;")
            ? null
            : parseFloat(rawFixed);
          if (range.minUnits === null && rawUnit.toLowerCase().indexOf("above") === -1) {
            warnings.push("Could not parse unit range: " + rawUnit);
          }
          items.push({ minUnits: range.minUnits, maxUnits: range.maxUnits, ratePerKWh: rate, fixedCharges, rawUnitText: rawUnit });
        }
        return { items, warnings };
      };

      // Find the table
      const table = document.querySelector("table.table.table-striped");
      if (!table) return { error: "Table not found", protected: [], unprotected: [], warnings: [] };

      // Verify the A-1 residential heading directly precedes the table
      const prevEl = table.previousElementSibling;
      const headingText = prevEl ? (prevEl.textContent || "").trim() : "";
      if (headingText.indexOf("A-1 GENERAL SUPPLY TARIFF - RESIDENTIAL") === -1) {
        return { error: "A-1 residential heading not found before table", protected: [], unprotected: [], warnings: [] };
      }

      const allRows = Array.from(table.querySelectorAll("tbody tr"));
      if (allRows.length === 0) return { error: "No tbody rows found", protected: [], unprotected: [], warnings: [] };

      // Stop at the first th.custom-fs separator (A-2 category boundary)
      let a1Boundary = allRows.length;
      for (let i = 0; i < allRows.length; i++) {
        if (allRows[i].querySelector("th.custom-fs")) { a1Boundary = i; break; }
      }
      const a1Rows = allRows.slice(0, a1Boundary);

      const warnings = [];
      let protectedItems = [];
      let unprotectedItems = [];
      let currentSection = "none"; // "none" | "protected" | "unprotected"
      let pendingRows = [];

      const flushSection = () => {
        const result = extractItems(pendingRows);
        if (currentSection === "protected") protectedItems = protectedItems.concat(result.items);
        else if (currentSection === "unprotected") unprotectedItems = unprotectedItems.concat(result.items);
        warnings.push(...result.warnings);
        pendingRows = [];
      };

      for (const row of a1Rows) {
        if (row.querySelector("th.custom-fs")) break;
        const cellTexts = Array.from(row.querySelectorAll("td")).map((c) => (c.textContent || "").trim());

        // Exact-text label rows for the two buckets (not positional!)
        if (cellTexts.length >= 2 && cellTexts[1] === "Protected") {
          flushSection();
          currentSection = "protected";
          continue;
        }
        if (cellTexts.length >= 2 && cellTexts[1] === "Un-Protected") {
          flushSection();
          currentSection = "unprotected";
          continue;
        }

        // Skip sub-category label rows: a) / b) / c) and their description cells
        const fc = cellTexts[0] || "";
        const sc = cellTexts[1] || "";
        if (fc === "a)" || fc === "b)" || fc === "c)" || /^(For Sanctioned load|Pre-paid|Time Of Use)/i.test(sc)) {
          continue;
        }

        // Data row: last cell is numeric and we are inside a known section
        if (cellTexts.length >= 6) {
          const lastCell = cellTexts[cellTexts.length - 1];
          if (/^\d+(\.\d+)?$/.test(lastCell) && currentSection !== "none") {
            pendingRows.push({ cells: cellTexts.slice(), isData: true });
          }
        }
      }
      flushSection();

      return { protected: protectedItems, unprotected: unprotectedItems, warnings };
    });

    if (extraction.error) {
      throw new Error(extraction.error);
    }

    const validationError = validateResult(extraction);
    if (validationError) {
      throw new Error(validationError);
    }

    await page.close();

    return {
      protected: extraction.protected,
      unprotected: extraction.unprotected,
      source: "live",
      fetchedAt: new Date().toISOString(),
      ...(extraction.warnings.length > 0 ? { warning: extraction.warnings.join("; ") } : {}),
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

/* ── CORS headers ── */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

/* ── HTTP handler ── */

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const brightDataEndpoint = Deno.env.get("BRIGHTDATA_WSS_ENDPOINT");
  if (!brightDataEndpoint) {
    console.warn("[fetch-tariffs] BRIGHTDATA_WSS_ENDPOINT not configured — returning fallback");
    return new Response(JSON.stringify({
      ...FALLBACK_DATA,
      fetchedAt: new Date().toISOString(),
      warning: "Live scraping unavailable (endpoint not configured)",
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    console.log("[fetch-tariffs] Connecting to Bright Data CDP...");
    const result = await scrapeLiveTariffs(brightDataEndpoint);
    console.log(`[fetch-tariffs] Live scrape succeeded: ${result.protected.length} protected, ${result.unprotected.length} unprotected items`);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.warn(`[fetch-tariffs] Live scrape failed: ${error.message}`);
    // Fallback: return February 2026 tariff data
    return new Response(JSON.stringify({
      ...FALLBACK_DATA,
      fetchedAt: new Date().toISOString(),
      warning: `Live scrape failed (${error.message}) — using fallback tariff data`,
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
