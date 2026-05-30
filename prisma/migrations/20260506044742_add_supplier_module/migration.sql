-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('PREPAID', 'POSTPAID');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('CONTRACT', 'RATE_SHEET');

-- AlterTable
ALTER TABLE "Tour" ADD COLUMN     "supplierId" INTEGER;

-- CreateTable
CREATE TABLE "Supplier" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "countryId" INTEGER NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "bookingEmail" TEXT NOT NULL,
    "bankAccountHolder" TEXT,
    "bankAccountNumber" TEXT,
    "bankIfsc" TEXT,
    "bankSwift" TEXT,
    "bankName" TEXT,
    "bankAddress" TEXT,
    "financeContactName" TEXT,
    "financeContactEmail" TEXT,
    "financeContactPhone" TEXT,
    "contractContactName" TEXT,
    "contractContactEmail" TEXT,
    "contractContactPhone" TEXT,
    "paymentMode" "PaymentMode" NOT NULL DEFAULT 'POSTPAID',
    "currency" VARCHAR(3) NOT NULL,
    "hasApi" BOOLEAN NOT NULL DEFAULT false,
    "apiType" "TourApiType" NOT NULL DEFAULT 'NONE',
    "apiKey" TEXT,
    "apiChannelId" TEXT,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierContract" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "type" "ContractType" NOT NULL DEFAULT 'RATE_SHEET',
    "label" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CityToSupplier" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE INDEX "Supplier_countryId_idx" ON "Supplier"("countryId");

-- CreateIndex
CREATE INDEX "Supplier_status_idx" ON "Supplier"("status");

-- CreateIndex
CREATE INDEX "Supplier_hasApi_idx" ON "Supplier"("hasApi");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_countryId_key" ON "Supplier"("name", "countryId");

-- CreateIndex
CREATE INDEX "SupplierContract_supplierId_idx" ON "SupplierContract"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierContract_type_idx" ON "SupplierContract"("type");

-- CreateIndex
CREATE UNIQUE INDEX "_CityToSupplier_AB_unique" ON "_CityToSupplier"("A", "B");

-- CreateIndex
CREATE INDEX "_CityToSupplier_B_index" ON "_CityToSupplier"("B");

-- CreateIndex
CREATE INDEX "Tour_supplierId_idx" ON "Tour"("supplierId");

-- AddForeignKey
ALTER TABLE "Tour" ADD CONSTRAINT "Tour_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierContract" ADD CONSTRAINT "SupplierContract_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CityToSupplier" ADD CONSTRAINT "_CityToSupplier_A_fkey" FOREIGN KEY ("A") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CityToSupplier" ADD CONSTRAINT "_CityToSupplier_B_fkey" FOREIGN KEY ("B") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

