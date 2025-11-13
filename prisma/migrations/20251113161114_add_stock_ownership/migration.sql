-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OptionPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "wheelCycleName" TEXT,
    "continueExistingWheel" BOOLEAN NOT NULL DEFAULT false,
    "openDate" DATETIME NOT NULL,
    "stockTicker" TEXT NOT NULL,
    "expiration" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "contracts" INTEGER NOT NULL,
    "strike" REAL NOT NULL,
    "premium" REAL NOT NULL,
    "ownsStock" BOOLEAN NOT NULL DEFAULT false,
    "stockCostBasis" REAL,
    "assigned" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'open',
    "openFees" REAL,
    "closeDate" DATETIME,
    "premiumPaidToClose" REAL,
    "closeFees" REAL,
    "notes" TEXT,
    "realizedPL" REAL,
    "unrealizedPL" REAL
);
INSERT INTO "new_OptionPosition" ("assigned", "closeDate", "closeFees", "continueExistingWheel", "contracts", "createdAt", "expiration", "id", "notes", "openDate", "openFees", "premium", "premiumPaidToClose", "realizedPL", "status", "stockTicker", "strike", "type", "unrealizedPL", "updatedAt", "wheelCycleName") SELECT "assigned", "closeDate", "closeFees", "continueExistingWheel", "contracts", "createdAt", "expiration", "id", "notes", "openDate", "openFees", "premium", "premiumPaidToClose", "realizedPL", "status", "stockTicker", "strike", "type", "unrealizedPL", "updatedAt", "wheelCycleName" FROM "OptionPosition";
DROP TABLE "OptionPosition";
ALTER TABLE "new_OptionPosition" RENAME TO "OptionPosition";
CREATE INDEX "OptionPosition_stockTicker_idx" ON "OptionPosition"("stockTicker");
CREATE INDEX "OptionPosition_status_idx" ON "OptionPosition"("status");
CREATE INDEX "OptionPosition_wheelCycleName_idx" ON "OptionPosition"("wheelCycleName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
