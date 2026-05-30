-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "fxRateToUsd" DECIMAL(18,8),
ADD COLUMN     "usdAmount" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "ExchangeRate" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "syncedAt" TIMESTAMP(3);

