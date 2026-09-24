import { readFileSync } from "fs";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CSVRoyaltySource,
  createCSVRoyaltySource,
  SUPPORTED_CSV_RETAILERS,
} from "@/lib/providers/royalties/csv-royalties";
import type { RoyaltyRecord } from "@/lib/providers/royalties/types";

const PROJECT = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const FIXTURES = path.resolve(__dirname, "../fixtures/royalty-csvs");

const fixture = (name: string) => readFileSync(path.join(FIXTURES, name));
const csv = (text: string) => Buffer.from(text, "utf-8");

/** The date part the upload route stores. */
const ymd = (d: Date) => d.toISOString().slice(0, 10);

const parse = (
  retailer: (typeof SUPPORTED_CSV_RETAILERS)[number],
  file: Buffer,
  name = "report.csv",
): Promise<RoyaltyRecord[]> =>
  createCSVRoyaltySource(retailer, PROJECT).parseReport(file, name);

describe("CSVRoyaltySource", () => {
  it("never auto-fetches", async () => {
    const source = new CSVRoyaltySource("amazon", PROJECT);
    expect(source.supportsAutoFetch()).toBe(false);
    await expect(source.fetchRoyalties()).rejects.toThrow(/does not support auto-fetch/);
  });

  it("refuses to parse without a projectId", async () => {
    const source = new CSVRoyaltySource("amazon", "");
    await expect(source.parseReport(csv("Date\n"), "x.csv")).rejects.toThrow(/projectId/);
  });

  it("refuses an unknown retailer", async () => {
    const source = new CSVRoyaltySource("smashwords" as "amazon", PROJECT);
    await expect(source.parseReport(csv("a,b\n1,2"), "x.csv")).rejects.toThrow(
      /No CSV parser available for retailer: smashwords/,
    );
  });

  it("has a parser for every advertised retailer", async () => {
    for (const retailer of SUPPORTED_CSV_RETAILERS) {
      await expect(parse(retailer, csv(""))).resolves.toEqual([]);
    }
  });
});

describe("KDP reports", () => {
  it("parses every row of the fixture", async () => {
    const records = await parse("amazon", fixture("kdp-report.csv"));
    expect(records).toHaveLength(8);
    for (const r of records) {
      expect(r.retailer).toBe("amazon");
      expect(r.projectId).toBe(PROJECT);
    }
  });

  it("maps marketplaces to territories and keeps gross/returned units", async () => {
    const [us, uk, de] = await parse("amazon", fixture("kdp-report.csv"));
    expect(us).toMatchObject({
      territory: "US",
      unitsSold: 42,
      unitsReturned: 2,
      revenue: 139.6,
      currency: "USD",
      revenueUsd: 139.6,
    });
    expect(uk).toMatchObject({ territory: "GB", currency: "GBP", revenue: 47.6 });
    expect(de).toMatchObject({ territory: "DE", currency: "EUR", revenue: 29.88 });
  });

  it("converts foreign currencies to USD rounded to cents", async () => {
    const records = await parse("amazon", fixture("kdp-report.csv"));
    const uk = records[1];
    expect(uk.revenueUsd).toBe(60.45); // 47.60 * 1.27
    const jp = records.find((r) => r.territory === "JP")!;
    expect(jp.revenue).toBe(1750);
    expect(jp.revenueUsd).toBe(11.73); // 1750 * 0.0067 = 11.725
  });

  it("expands the transaction date to its calendar month", async () => {
    const records = await parse("amazon", fixture("kdp-report.csv"));
    expect(ymd(records[0].periodStart)).toBe("2026-01-01");
    expect(ymd(records[0].periodEnd)).toBe("2026-01-31");
    const feb = records[3];
    expect(ymd(feb.periodStart)).toBe("2026-02-01");
    expect(ymd(feb.periodEnd)).toBe("2026-02-28");
  });

  it("keeps an unmapped marketplace name as the territory", async () => {
    const [r] = await parse(
      "amazon",
      csv(
        "Date,Marketplace,Units Sold,Units Returned,Royalty,Currency\n" +
          "04/10/2026,Amazon.se,3,0,9.00,SEK",
      ),
    );
    expect(r.territory).toBe("Amazon.se");
    expect(r.revenueUsd).toBe(0.86); // 9 * 0.095 = 0.855
  });

  it("skips rows with an unparseable date and zeroes non-numeric amounts", async () => {
    const records = await parse(
      "amazon",
      csv(
        "Date,Marketplace,Units Sold,Units Returned,Royalty,Currency\n" +
          "not-a-date,Amazon.com,1,0,1.00,USD\n" +
          "05/01/2026,Amazon.com,abc,,n/a,USD",
      ),
    );
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      unitsSold: 0,
      unitsReturned: 0,
      revenue: 0,
      revenueUsd: 0,
    });
  });

  it("returns no records for a header-only or empty file", async () => {
    expect(
      await parse("amazon", csv("Date,Marketplace,Units Sold,Royalty,Currency\n")),
    ).toEqual([]);
    expect(await parse("amazon", csv(""))).toEqual([]);
    expect(await parse("amazon", csv("\n\n  \n"))).toEqual([]);
  });
});

describe("Apple reports", () => {
  it("parses units, proceeds and territory", async () => {
    const records = await parse("apple", fixture("apple-report.csv"));
    expect(records).toHaveLength(7);
    expect(records[0]).toMatchObject({
      retailer: "apple",
      territory: "US",
      unitsSold: 35,
      unitsReturned: 0,
      revenue: 104.65,
      currency: "USD",
      revenueUsd: 104.65,
    });
    expect(records[5]).toMatchObject({
      territory: "CA",
      currency: "CAD",
      revenue: 17.94,
      revenueUsd: 13.28, // 17.94 * 0.74 = 13.2756
    });
  });

  it("uses begin and end dates for the period", async () => {
    const records = await parse("apple", fixture("apple-report.csv"));
    expect(ymd(records[3].periodStart)).toBe("2026-02-01");
    expect(ymd(records[3].periodEnd)).toBe("2026-02-28");
  });

  it("skips rows missing either date", async () => {
    const records = await parse(
      "apple",
      csv(
        "Units,Developer Proceeds,Begin Date,End Date,Country Code,Currency of Proceeds\n" +
          "1,2.99,01/01/2026,,US,USD\n" +
          "1,2.99,,01/31/2026,US,USD",
      ),
    );
    expect(records).toEqual([]);
  });
});

describe("Kobo reports", () => {
  it("parses net units, returns and earnings", async () => {
    const records = await parse("kobo", fixture("kobo-report.csv"));
    expect(records).toHaveLength(7);
    expect(records[0]).toMatchObject({
      retailer: "kobo",
      territory: "US",
      unitsSold: 27,
      unitsReturned: 1,
      revenue: 84.63,
      currency: "USD",
    });
    const au = records[6];
    expect(au).toMatchObject({ territory: "AU", currency: "AUD", revenueUsd: 22.59 });
    expect(ymd(au.periodStart)).toBe("2026-03-01");
    expect(ymd(au.periodEnd)).toBe("2026-03-31");
  });

  describe.each(["America/New_York", "Asia/Tokyo"])("with the server in %s", (tz) => {
    const originalTz = process.env.TZ;
    afterEach(() => {
      process.env.TZ = originalTz;
    });

    it("keeps a date on the 1st in its own month", async () => {
      process.env.TZ = tz;
      const [kobo] = await parse(
        "kobo",
        csv("Date,Currency,Returns,Net Sold,Total Earnings,Country\n2026-02-01,USD,0,1,3.00,US"),
      );
      expect(ymd(kobo.periodStart)).toBe("2026-02-01");
      expect(ymd(kobo.periodEnd)).toBe("2026-02-28");

      const [streetlib] = await parse(
        "streetlib",
        csv("Period,Store,Territory,Quantity,Net Revenue,Currency\n2026-02,Kobo,IT,1,2.00,EUR"),
      );
      expect(ymd(streetlib.periodStart)).toBe("2026-02-01");
    });
  });
});

describe("StreetLib reports", () => {
  it("maps stores to retailers", async () => {
    const records = await parse("streetlib", fixture("streetlib-report.csv"));
    expect(records.map((r) => r.retailer)).toEqual([
      "amazon",
      "apple",
      "kobo",
      "bn",
      "amazon",
      "apple",
      "google",
      "amazon",
      "tolino",
    ]);
  });

  it("parses quantity, revenue and YYYY-MM periods", async () => {
    const records = await parse("streetlib", fixture("streetlib-report.csv"));
    const gb = records[5];
    expect(gb).toMatchObject({
      territory: "GB",
      unitsSold: 10,
      unitsReturned: 0,
      revenue: 29.9,
      currency: "GBP",
      revenueUsd: 37.97, // 29.90 * 1.27 = 37.973
    });
    expect(ymd(gb.periodStart)).toBe("2026-02-01");
    expect(ymd(gb.periodEnd)).toBe("2026-02-28");
  });

  it("accepts MM/YYYY periods and slugifies unknown stores", async () => {
    const [r] = await parse(
      "streetlib",
      csv("Period,Store,Territory,Quantity,Net Revenue,Currency\n12/2025,Vivlio Store,FR,2,5.00,EUR"),
    );
    expect(r.retailer).toBe("vivlio_store");
    expect(ymd(r.periodStart)).toBe("2025-12-01");
    expect(ymd(r.periodEnd)).toBe("2025-12-31");
  });

  it("defaults the currency to EUR when the column is missing", async () => {
    const [r] = await parse(
      "streetlib",
      csv("Period,Store,Territory,Quantity,Net Revenue\n2026-01,Kobo,IT,1,10.00"),
    );
    expect(r.currency).toBe("EUR");
    expect(r.revenueUsd).toBe(10.9);
  });
});

describe("CSV parsing", () => {
  it("handles CRLF line endings, quoted commas and escaped quotes", async () => {
    const records = await parse(
      "streetlib",
      csv(
        'Period,Title,Store,Territory,Quantity,Net Revenue,Currency\r\n' +
          '2026-01,"Winter, a ""Garden""",Barnes & Noble,US,3,"1,5",USD\r\n',
      ),
    );
    expect(records).toHaveLength(1);
    // The quoted title's comma must not shift the columns.
    expect(records[0]).toMatchObject({ retailer: "bn", territory: "US", unitsSold: 3 });
    // "1,5" stays one field; parseFloat reads the leading "1".
    expect(records[0].revenue).toBe(1);
  });

  it("treats missing trailing fields as empty and falls back to defaults", async () => {
    const [r] = await parse(
      "amazon",
      csv("Date,Marketplace,Units Sold,Units Returned,Royalty,Currency\n06/20/2026,Amazon.com,4"),
    );
    expect(r).toMatchObject({
      unitsSold: 4,
      unitsReturned: 0,
      revenue: 0,
      revenueUsd: 0,
      // A present-but-empty Currency cell falls back to the default.
      currency: "USD",
    });
  });
});
