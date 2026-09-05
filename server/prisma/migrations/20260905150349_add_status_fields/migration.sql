-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "isRemoved" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "RelatedSystem" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
