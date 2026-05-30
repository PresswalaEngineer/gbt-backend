-- CreateEnum
CREATE TYPE "TourType" AS ENUM ('SINGLE_DAY', 'MULTI_DAY');

-- CreateEnum
CREATE TYPE "TourPricingMode" AS ENUM ('NETT', 'COMMISSIONABLE');

-- CreateEnum
CREATE TYPE "PriceTier" AS ENUM ('ADULT', 'CHILD', 'INFANT', 'SENIOR', 'PAX_1', 'PAX_2', 'PAX_3', 'CHILD_WITH_BED', 'CHILD_WITHOUT_BED');

-- AlterTable
ALTER TABLE "Tour" ADD COLUMN     "commissionPercent" DECIMAL(6,3),
ADD COLUMN     "currency" VARCHAR(3),
ADD COLUMN     "durationDays" INTEGER,
ADD COLUMN     "marginPercent" DECIMAL(6,3),
ADD COLUMN     "pricingMode" "TourPricingMode" NOT NULL DEFAULT 'NETT',
ADD COLUMN     "tourType" "TourType" NOT NULL DEFAULT 'SINGLE_DAY';

-- CreateTable
CREATE TABLE "TourPriceTier" (
    "id" SERIAL NOT NULL,
    "tourId" INTEGER NOT NULL,
    "tier" "PriceTier" NOT NULL,
    "nettPrice" DECIMAL(12,2),
    "grossPrice" DECIMAL(12,2) NOT NULL,
    "originalPrice" DECIMAL(12,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TourPriceTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TourPriceTier_tourId_idx" ON "TourPriceTier"("tourId");

-- CreateIndex
CREATE UNIQUE INDEX "TourPriceTier_tourId_tier_key" ON "TourPriceTier"("tourId", "tier");

-- AddForeignKey
ALTER TABLE "TourPriceTier" ADD CONSTRAINT "TourPriceTier_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE CASCADE ON UPDATE CASCADE;
