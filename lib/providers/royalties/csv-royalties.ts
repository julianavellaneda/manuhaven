import type { RoyaltyRecord, RoyaltySource } from "./types";

// ---------------------------------------------------------------------------
// Simple CSV parsing helpers (no external dependency)
// ---------------------------------------------------------------------------

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (line.trim() === "") continue;
    // Handle quoted fields (supports commas inside quotes)
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          fields.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
    }
    fields.push(current.trim());
    rows.push(fields);
  }
  return rows;
}

function csvToObjects(text: string): Record<string, string>[] {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? "";
    });
    return obj;
  });
}

// ---------------------------------------------------------------------------
// Static exchange rates (approximate) for converting to USD
// ---------------------------------------------------------------------------

const EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  GBP: 1.27,
  EUR: 1.09,
  CAD: 0.74,
  AUD: 0.66,
  JPY: 0.0067,
  INR: 0.012,
  BRL: 0.2,
  MXN: 0.058,
  SEK: 0.095,
  NOK: 0.094,
  DKK: 0.146,
  CHF: 1.13,
  NZD: 0.62,
  PLN: 0.25,
  CZK: 0.044,
};

function toUSD(amount: number, currency: string): number {
  const rate = EXCHANGE_RATES[currency.toUpperCase()] ?? 1;
  return Math.round(amount * rate * 100) / 100;
}

// ---------------------------------------------------------------------------
// Marketplace → territory mapping for KDP
// ---------------------------------------------------------------------------

const KDP_MARKETPLACE_MAP: Record<string, string> = {
  "Amazon.com": "US",
  "Amazon.co.uk": "GB",
  "Amazon.de": "DE",
  "Amazon.fr": "FR",
  "Amazon.es": "ES",
  "Amazon.it": "IT",
  "Amazon.nl": "NL",
  "Amazon.co.jp": "JP",
  "Amazon.in": "IN",
  "Amazon.ca": "CA",
  "Amazon.com.au": "AU",
  "Amazon.com.br": "BR",
  "Amazon.com.mx": "MX",
};

// ---------------------------------------------------------------------------
// Month helpers
// ---------------------------------------------------------------------------

// Report dates are calendar dates, so every Date here is UTC midnight and the
// upload route stores `toISOString()`'s date part. Local-time dates would shift
// a period into the neighbouring month on servers east or west of UTC.

function firstOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function lastOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

/** Parse a MM/DD/YYYY or YYYY-MM-DD report date as a UTC calendar date. */
function parseReportDate(str: string): Date {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
  if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  const parts = str.split("/");
  if (parts.length !== 3) return new Date(str);
  const [mm, dd, yyyy] = parts;
  return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

function parseKDPReport(
  file: Buffer,
  _fileName: string,
  projectId: string
): RoyaltyRecord[] {
  const text = file.toString("utf-8");
  const rows = csvToObjects(text);
  const records: RoyaltyRecord[] = [];

  for (const row of rows) {
    const dateStr = row["Date"] ?? "";
    const date = parseReportDate(dateStr);
    if (isNaN(date.getTime())) continue;

    const marketplace = row["Marketplace"] ?? "";
    const territory = KDP_MARKETPLACE_MAP[marketplace] ?? marketplace;
    const unitsSold = parseInt(row["Units Sold"] ?? "0", 10) || 0;
    const unitsReturned = parseInt(row["Units Returned"] ?? "0", 10) || 0;
    const revenue = parseFloat(row["Royalty"] ?? "0") || 0;
    const currency = row["Currency"] || "USD";

    records.push({
      retailer: "amazon",
      territory,
      unitsSold,
      unitsReturned,
      revenue,
      currency,
      revenueUsd: toUSD(revenue, currency),
      periodStart: firstOfMonth(date),
      periodEnd: lastOfMonth(date),
      projectId,
    });
  }

  return records;
}

function parseAppleReport(
  file: Buffer,
  _fileName: string,
  projectId: string
): RoyaltyRecord[] {
  const text = file.toString("utf-8");
  const rows = csvToObjects(text);
  const records: RoyaltyRecord[] = [];

  for (const row of rows) {
    const beginDateStr = row["Begin Date"] ?? "";
    const endDateStr = row["End Date"] ?? "";
    const beginDate = parseReportDate(beginDateStr);
    const endDate = parseReportDate(endDateStr);
    if (isNaN(beginDate.getTime()) || isNaN(endDate.getTime())) continue;

    const territory = row["Country Code"] ?? "";
    const units = parseInt(row["Units"] ?? "0", 10) || 0;
    const revenue = parseFloat(row["Developer Proceeds"] ?? "0") || 0;
    const currency = row["Currency of Proceeds"] || "USD";

    records.push({
      retailer: "apple",
      territory,
      unitsSold: units,
      unitsReturned: 0,
      revenue,
      currency,
      revenueUsd: toUSD(revenue, currency),
      periodStart: firstOfMonth(beginDate),
      periodEnd: lastOfMonth(endDate),
      projectId,
    });
  }

  return records;
}

function parseKoboReport(
  file: Buffer,
  _fileName: string,
  projectId: string
): RoyaltyRecord[] {
  const text = file.toString("utf-8");
  const rows = csvToObjects(text);
  const records: RoyaltyRecord[] = [];

  for (const row of rows) {
    const dateStr = row["Date"] ?? "";
    const date = parseReportDate(dateStr);
    if (isNaN(date.getTime())) continue;

    const territory = row["Country"] ?? "";
    const netSold = parseInt(row["Net Sold"] ?? "0", 10) || 0;
    const returns = parseInt(row["Returns"] ?? "0", 10) || 0;
    const revenue = parseFloat(row["Total Earnings"] ?? "0") || 0;
    const currency = row["Currency"] || "USD";

    records.push({
      retailer: "kobo",
      territory,
      unitsSold: netSold,
      unitsReturned: returns,
      revenue,
      currency,
      revenueUsd: toUSD(revenue, currency),
      periodStart: firstOfMonth(date),
      periodEnd: lastOfMonth(date),
      projectId,
    });
  }

  return records;
}

function parseStreetLibReport(
  file: Buffer,
  _fileName: string,
  projectId: string
): RoyaltyRecord[] {
  const text = file.toString("utf-8");
  const rows = csvToObjects(text);
  const records: RoyaltyRecord[] = [];

  // StreetLib Store → retailer mapping
  const storeMap: Record<string, string> = {
    "Amazon Kindle": "amazon",
    "Apple Books": "apple",
    Kobo: "kobo",
    "Barnes & Noble": "bn",
    "Google Play": "google",
    OverDrive: "overdrive",
    Tolino: "tolino",
  };

  for (const row of rows) {
    const periodStr = row["Period"] ?? "";
    // Period format: "YYYY-MM" or "MM/YYYY"
    let date: Date;
    if (periodStr.includes("-")) {
      const [yyyy, mm] = periodStr.split("-");
      date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, 1));
    } else if (periodStr.includes("/")) {
      const parts = periodStr.split("/");
      date = new Date(Date.UTC(Number(parts[1]), Number(parts[0]) - 1, 1));
    } else {
      date = new Date(periodStr);
    }
    if (isNaN(date.getTime())) continue;

    const store = row["Store"] ?? "";
    const retailer = storeMap[store] ?? store.toLowerCase().replace(/\s+/g, "_");
    const territory = row["Territory"] ?? "";
    const quantity = parseInt(row["Quantity"] ?? "0", 10) || 0;
    const revenue = parseFloat(row["Net Revenue"] ?? "0") || 0;
    const currency = row["Currency"] || "EUR";

    records.push({
      retailer,
      territory,
      unitsSold: quantity,
      unitsReturned: 0,
      revenue,
      currency,
      revenueUsd: toUSD(revenue, currency),
      periodStart: firstOfMonth(date),
      periodEnd: lastOfMonth(date),
      projectId,
    });
  }

  return records;
}

// ---------------------------------------------------------------------------
// CSV Royalty Source class implementing the RoyaltySource interface
// ---------------------------------------------------------------------------

type RetailerKey = "amazon" | "apple" | "kobo" | "streetlib";

const PARSER_MAP: Record<
  RetailerKey,
  (file: Buffer, fileName: string, projectId: string) => RoyaltyRecord[]
> = {
  amazon: parseKDPReport,
  apple: parseAppleReport,
  kobo: parseKoboReport,
  streetlib: parseStreetLibReport,
};

export class CSVRoyaltySource implements RoyaltySource {
  retailer: string;
  private projectId: string;

  constructor(retailer: RetailerKey, projectId: string) {
    this.retailer = retailer;
    this.projectId = projectId;
  }

  async fetchRoyalties(): Promise<RoyaltyRecord[]> {
    throw new Error(
      `CSV source for ${this.retailer} does not support auto-fetch. Upload a CSV report instead.`
    );
  }

  async parseReport(file: Buffer, fileName: string): Promise<RoyaltyRecord[]> {
    if (!this.projectId) {
      throw new Error(
        "projectId must be set before parsing a report."
      );
    }
    const parser = PARSER_MAP[this.retailer as RetailerKey];
    if (!parser) {
      throw new Error(`No CSV parser available for retailer: ${this.retailer}`);
    }
    return parser(file, fileName, this.projectId);
  }

  supportsAutoFetch(): boolean {
    return false;
  }
}

// Convenience: create a fresh source for a specific retailer + project
export function createCSVRoyaltySource(
  retailer: RetailerKey,
  projectId: string
): CSVRoyaltySource {
  return new CSVRoyaltySource(retailer, projectId);
}

export const SUPPORTED_CSV_RETAILERS = [
  "amazon",
  "apple",
  "kobo",
  "streetlib",
] as const;

export type SupportedCSVRetailer = (typeof SUPPORTED_CSV_RETAILERS)[number];
