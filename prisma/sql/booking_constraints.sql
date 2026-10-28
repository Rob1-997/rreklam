-- Apply after Prisma migration generated all tables.
-- PostgreSQL enforces no simultaneous active allocations for one vehicle.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "VehicleAllocation" ADD CONSTRAINT "vehicle_allocation_period_valid"
  CHECK ("endsAt" > "startsAt");
ALTER TABLE "VehicleAllocation" ADD CONSTRAINT "vehicle_no_overlapping_allocations"
  EXCLUDE USING gist (
    "vehicleId" WITH =,
    tsrange("startsAt", "endsAt", '[)') WITH &&
  ) WHERE ("status" IN ('HELD','CONFIRMED','INSTALLING','ACTIVE','REMOVING'));
ALTER TABLE "CampaignCityTarget" ADD CONSTRAINT "target_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "PackageCityPrice" ADD CONSTRAINT "package_price_positive" CHECK ("priceAmd" > 0);
ALTER TABLE "DriverRate" ADD CONSTRAINT "driver_rate_nonnegative" CHECK ("amountAmd" >= 0);
ALTER TABLE "CampaignCost" ADD CONSTRAINT "cost_nonnegative" CHECK ("amountAmd" >= 0);
ALTER TABLE "StockAlertRule" ADD CONSTRAINT "alert_minimum_nonnegative" CHECK ("minimumAvailable" >= 0);

-- Financial snapshots: reject negative costs, impossible dates and inconsistent totals.
ALTER TABLE "CampaignQuote" ADD CONSTRAINT "quote_period_valid" CHECK ("endsAt" > "startsAt");
ALTER TABLE "CampaignQuote" ADD CONSTRAINT "quote_money_consistent" CHECK (
  "grossPriceAmd" > 0 AND "discountAmd" >= 0 AND "priceAmd" > 0
  AND "grossPriceAmd" = "priceAmd" + "discountAmd"
  AND "driverPayoutAmd" >= 0 AND "manualCostAmd" >= 0 AND "directCostAmd" >= 0
  AND "directCostAmd" = "driverPayoutAmd" + "manualCostAmd"
);
ALTER TABLE "QuoteLine" ADD CONSTRAINT "quote_line_money_valid" CHECK (
  "quantity" > 0 AND "unitPriceAmd" > 0 AND "unitDriverRateAmd" > 0
  AND "totalPriceAmd" = ("quantity"::bigint * "unitPriceAmd")
  AND "totalDriverPayoutAmd" = ("quantity"::bigint * "unitDriverRateAmd")
);
ALTER TABLE "QuoteCost" ADD CONSTRAINT "quote_cost_nonnegative" CHECK ("amountAmd" >= 0);
ALTER TABLE "TariffProposal" ADD CONSTRAINT "tariff_proposal_price_positive" CHECK ("suggestedPriceAmd" > 0);
