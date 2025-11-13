-- AlterTable
ALTER TABLE "OptionPosition" ADD COLUMN "premiumRealizedPL" REAL;
ALTER TABLE "OptionPosition" ADD COLUMN "stockAcquisitionDate" DATETIME;
ALTER TABLE "OptionPosition" ADD COLUMN "stockQuantity" INTEGER;
ALTER TABLE "OptionPosition" ADD COLUMN "stockRealizedPL" REAL;
ALTER TABLE "OptionPosition" ADD COLUMN "stockSaleDate" DATETIME;
ALTER TABLE "OptionPosition" ADD COLUMN "stockSalePrice" REAL;
