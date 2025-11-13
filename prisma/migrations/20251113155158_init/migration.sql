-- CreateTable
CREATE TABLE "OptionPosition" (
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

-- CreateIndex
CREATE INDEX "OptionPosition_stockTicker_idx" ON "OptionPosition"("stockTicker");

-- CreateIndex
CREATE INDEX "OptionPosition_status_idx" ON "OptionPosition"("status");

-- CreateIndex
CREATE INDEX "OptionPosition_wheelCycleName_idx" ON "OptionPosition"("wheelCycleName");
