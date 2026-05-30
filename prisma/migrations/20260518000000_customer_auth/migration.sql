-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "password" TEXT;

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "customerId" INTEGER,
ALTER COLUMN "staffId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "RefreshToken_customerId_idx" ON "RefreshToken"("customerId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
