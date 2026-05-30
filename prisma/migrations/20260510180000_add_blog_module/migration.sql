-- CreateEnum
CREATE TYPE "BlogStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BlogCategory" AS ENUM ('TRAVEL_GUIDE', 'NEWS', 'TIPS', 'DESTINATION', 'HOW_TO');

-- CreateTable
CREATE TABLE "Blog" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" VARCHAR(500) NOT NULL,
    "content" TEXT NOT NULL,
    "contentImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bannerImage" TEXT NOT NULL,
    "thumbnailImage" TEXT NOT NULL,
    "ogImage" TEXT,
    "author" TEXT NOT NULL,
    "category" "BlogCategory" NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "BlogStatus" NOT NULL DEFAULT 'DRAFT',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "readingMinutes" INTEGER,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "seoKeywords" TEXT,
    "canonicalUrl" TEXT,
    "schema" TEXT,
    "createdById" INTEGER,
    "modifiedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Blog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Blog_slug_key" ON "Blog"("slug");

-- CreateIndex
CREATE INDEX "Blog_status_idx" ON "Blog"("status");

-- CreateIndex
CREATE INDEX "Blog_category_idx" ON "Blog"("category");

-- CreateIndex
CREATE INDEX "Blog_publishedAt_idx" ON "Blog"("publishedAt");

-- CreateIndex
CREATE INDEX "Blog_isFeatured_idx" ON "Blog"("isFeatured");

-- AddForeignKey
ALTER TABLE "Blog" ADD CONSTRAINT "Blog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blog" ADD CONSTRAINT "Blog_modifiedById_fkey" FOREIGN KEY ("modifiedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

