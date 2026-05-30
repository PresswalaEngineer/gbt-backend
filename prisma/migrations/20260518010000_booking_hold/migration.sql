-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "holdExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Booking_status_holdExpiresAt_idx" ON "Booking"("status", "holdExpiresAt");
