-- Apply after Prisma migration generated all tables.
-- PostgreSQL enforces no simultaneous active allocations for one vehicle.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "VehicleAllocation" ADD CONSTRAINT "vehicle_allocation_period_valid"
  CHECK ("endsAt" > "startsAt");
ALTER TABLE "VehicleAllocation" ADD CONSTRAINT "vehicle_no_overlapping_allocations"
  EXCLUDE USING gist (
    "vehicleId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  ) WHERE ("status" IN ('HELD','CONFIRMED','INSTALLING','ACTIVE','REMOVING'));
ALTER TABLE "CampaignCityTarget" ADD CONSTRAINT "target_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "PackageCityPrice" ADD CONSTRAINT "package_price_positive" CHECK ("priceAmd" > 0);
ALTER TABLE "DriverRate" ADD CONSTRAINT "driver_rate_nonnegative" CHECK ("amountAmd" >= 0);
ALTER TABLE "CampaignCost" ADD CONSTRAINT "cost_nonnegative" CHECK ("amountAmd" >= 0);
ALTER TABLE "StockAlertRule" ADD CONSTRAINT "alert_minimum_nonnegative" CHECK ("minimumAvailable" >= 0);
