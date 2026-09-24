export interface RoyaltyRecord {
  retailer: string;
  territory: string;
  unitsSold: number;
  unitsReturned: number;
  revenue: number;
  currency: string;
  revenueUsd: number;
  periodStart: Date;
  periodEnd: Date;
  projectId: string;
}

export interface RoyaltySource {
  retailer: string;

  fetchRoyalties(params: {
    userId: string;
    dateRange: { start: Date; end: Date };
  }): Promise<RoyaltyRecord[]>;

  parseReport(file: Buffer, fileName: string): Promise<RoyaltyRecord[]>;

  supportsAutoFetch(): boolean;
}
