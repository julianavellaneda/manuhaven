import type { RoyaltySource } from "./types";
import {
  CSVRoyaltySource,
  SUPPORTED_CSV_RETAILERS,
} from "./csv-royalties";

const sources = new Map<string, RoyaltySource>();

export function getRoyaltySource(retailer: string): RoyaltySource {
  const source = sources.get(retailer);
  if (!source) {
    throw new Error(`Royalty source for retailer "${retailer}" is not registered.`);
  }
  return source;
}

export function registerRoyaltySource(source: RoyaltySource) {
  sources.set(source.retailer, source);
}

// Register CSV royalty sources for all supported retailers
for (const retailer of SUPPORTED_CSV_RETAILERS) {
  registerRoyaltySource(new CSVRoyaltySource(retailer));
}
