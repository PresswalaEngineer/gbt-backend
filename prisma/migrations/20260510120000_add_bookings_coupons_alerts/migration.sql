-- CreateEnum
CREATE TYPE "VoucherType" AS ENUM ('PRINTED', 'MOBILE');

-- CreateEnum
CREATE TYPE "MeetingPointType" AS ENUM ('FIXED', 'MULTIPLE', 'CUSTOMISED');

-- CreateEnum
CREATE TYPE "ProductTag" AS ENUM ('MOBILE_VOUCHER', 'PRINTED_VOUCHER', 'WHEELCHAIR', 'AUDIO_GUIDE', 'LIVE_GUIDE', 'MULTI_LANGUAGE');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "CouponEligibility" AS ENUM ('ALL', 'CITY', 'ATTRACTION', 'CATEGORY', 'TOUR');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLATION_REQUESTED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIAL_REFUND');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('BOOKING_CONFIRMATION', 'PAYMENT_FAILURE', 'DAILY_BOOKINGS_REPORT', 'NEW_AGENT_SIGNUP', 'NEW_SUPPLIER_CREATED', 'NEW_COUPON_CREATED', 'COUPON_EXPIRED');

-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Tour" ADD COLUMN     "bookingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "createdById" INTEGER,
ADD COLUMN     "meetingPointType" "MeetingPointType" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "meetingPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "modifiedById" INTEGER,
ADD COLUMN     "productCode" TEXT,
ADD COLUMN     "productSlug" TEXT,
ADD COLUMN     "productTags" "ProductTag"[] DEFAULT ARRAY[]::"ProductTag"[],
ADD COLUMN     "requireAllPaxDetails" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "routeMapUrl" TEXT,
ADD COLUMN     "startTimes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "voucherType" "VoucherType" NOT NULL DEFAULT 'MOBILE';

-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "countryId" INTEGER,
    "notes" TEXT,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "companyName" TEXT,
    "countryId" INTEGER,
    "commissionPercent" DECIMAL(6,3),
    "agentStatus" "AgentStatus" NOT NULL DEFAULT 'PENDING',
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    "discountAmount" DECIMAL(12,2) NOT NULL,
    "minOrderAmount" DECIMAL(12,2),
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "userLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "eligibility" "CouponEligibility" NOT NULL DEFAULT 'ALL',
    "targetCityId" INTEGER,
    "targetAttractionId" INTEGER,
    "targetCategoryId" INTEGER,
    "targetTourId" INTEGER,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "expiredAlertSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" SERIAL NOT NULL,
    "fromCurrency" VARCHAR(3) NOT NULL,
    "toCurrency" VARCHAR(3) NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" SERIAL NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "tourId" INTEGER NOT NULL,
    "tourOptionId" INTEGER,
    "customerId" INTEGER,
    "agentId" INTEGER,
    "supplierId" INTEGER,
    "createdById" INTEGER,
    "leadGuestName" TEXT NOT NULL,
    "leadGuestEmail" TEXT NOT NULL,
    "leadGuestPhone" TEXT,
    "paxCount" INTEGER NOT NULL,
    "paxBreakdown" JSONB NOT NULL,
    "travelDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "voucherSent" BOOLEAN NOT NULL DEFAULT false,
    "currency" VARCHAR(3) NOT NULL,
    "supplierCurrency" VARCHAR(3),
    "nettAmount" DECIMAL(12,2) NOT NULL,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "refundAmount" DECIMAL(12,2),
    "couponId" INTEGER,
    "couponCode" TEXT,
    "externalRef" TEXT,
    "externalSource" "TourApiType" NOT NULL DEFAULT 'NONE',
    "externalPayload" JSONB,
    "cancellationReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingPayment" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "provider" TEXT,
    "providerRef" TEXT,
    "isRefund" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingEvent" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "actorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" SERIAL NOT NULL,
    "alertType" "AlertType" NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "bodyText" TEXT,
    "fromName" TEXT,
    "fromEmail" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "placeholders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER,
    "alertType" "AlertType" NOT NULL,
    "toEmail" TEXT NOT NULL,
    "toName" TEXT,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "errorMessage" TEXT,
    "providerMessageId" TEXT,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertSetting" (
    "id" SERIAL NOT NULL,
    "alertType" "AlertType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_status_idx" ON "Customer"("status");

-- CreateIndex
CREATE INDEX "Customer_countryId_idx" ON "Customer"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_email_key" ON "Agent"("email");

-- CreateIndex
CREATE INDEX "Agent_status_idx" ON "Agent"("status");

-- CreateIndex
CREATE INDEX "Agent_agentStatus_idx" ON "Agent"("agentStatus");

-- CreateIndex
CREATE INDEX "Agent_countryId_idx" ON "Agent"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_status_idx" ON "Coupon"("status");

-- CreateIndex
CREATE INDEX "Coupon_eligibility_idx" ON "Coupon"("eligibility");

-- CreateIndex
CREATE INDEX "Coupon_endDate_idx" ON "Coupon"("endDate");

-- CreateIndex
CREATE INDEX "ExchangeRate_status_idx" ON "ExchangeRate"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_fromCurrency_toCurrency_key" ON "ExchangeRate"("fromCurrency", "toCurrency");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_referenceNumber_key" ON "Booking"("referenceNumber");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_paymentStatus_idx" ON "Booking"("paymentStatus");

-- CreateIndex
CREATE INDEX "Booking_tourId_idx" ON "Booking"("tourId");

-- CreateIndex
CREATE INDEX "Booking_customerId_idx" ON "Booking"("customerId");

-- CreateIndex
CREATE INDEX "Booking_agentId_idx" ON "Booking"("agentId");

-- CreateIndex
CREATE INDEX "Booking_supplierId_idx" ON "Booking"("supplierId");

-- CreateIndex
CREATE INDEX "Booking_travelDate_idx" ON "Booking"("travelDate");

-- CreateIndex
CREATE INDEX "Booking_createdAt_idx" ON "Booking"("createdAt");

-- CreateIndex
CREATE INDEX "BookingPayment_bookingId_idx" ON "BookingPayment"("bookingId");

-- CreateIndex
CREATE INDEX "BookingPayment_status_idx" ON "BookingPayment"("status");

-- CreateIndex
CREATE INDEX "BookingEvent_bookingId_idx" ON "BookingEvent"("bookingId");

-- CreateIndex
CREATE INDEX "BookingEvent_type_idx" ON "BookingEvent"("type");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_alertType_key" ON "EmailTemplate"("alertType");

-- CreateIndex
CREATE INDEX "EmailTemplate_isActive_idx" ON "EmailTemplate"("isActive");

-- CreateIndex
CREATE INDEX "EmailLog_alertType_idx" ON "EmailLog"("alertType");

-- CreateIndex
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");

-- CreateIndex
CREATE INDEX "EmailLog_toEmail_idx" ON "EmailLog"("toEmail");

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlertSetting_alertType_key" ON "AlertSetting"("alertType");

-- CreateIndex
CREATE UNIQUE INDEX "Tour_productSlug_key" ON "Tour"("productSlug");

-- CreateIndex
CREATE INDEX "Tour_bookingCount_idx" ON "Tour"("bookingCount");

-- AddForeignKey
ALTER TABLE "Tour" ADD CONSTRAINT "Tour_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tour" ADD CONSTRAINT "Tour_modifiedById_fkey" FOREIGN KEY ("modifiedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_targetCity_fkey" FOREIGN KEY ("targetCityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_targetAttraction_fkey" FOREIGN KEY ("targetAttractionId") REFERENCES "Attraction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_targetCategory_fkey" FOREIGN KEY ("targetCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_targetTour_fkey" FOREIGN KEY ("targetTourId") REFERENCES "Tour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingPayment" ADD CONSTRAINT "BookingPayment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingEvent" ADD CONSTRAINT "BookingEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

