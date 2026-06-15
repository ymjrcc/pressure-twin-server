-- CreateTable
CREATE TABLE "InspectionChecklistItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deviceCode" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL
);
CREATE INDEX "InspectionChecklistItem_deviceCode_sortOrder_idx" ON "InspectionChecklistItem"("deviceCode", "sortOrder");
CREATE UNIQUE INDEX "InspectionChecklistItem_deviceCode_itemId_key" ON "InspectionChecklistItem"("deviceCode", "itemId");

-- CreateTable
CREATE TABLE "InspectionReport" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME NOT NULL,
    "submittedAt" DATETIME NOT NULL,
    "deviceCount" INTEGER NOT NULL,
    "normalItemCount" INTEGER NOT NULL,
    "abnormalItemCount" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "InspectionReportDeviceRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reportId" INTEGER NOT NULL,
    "deviceCode" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "checkedAt" DATETIME,
    "abnormalItemCount" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    CONSTRAINT "InspectionReportDeviceRecord_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "InspectionReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InspectionReportItemResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deviceRecordId" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    CONSTRAINT "InspectionReportItemResult_deviceRecordId_fkey" FOREIGN KEY ("deviceRecordId") REFERENCES "InspectionReportDeviceRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "InspectionReport_submittedAt_idx" ON "InspectionReport"("submittedAt");

-- CreateIndex
CREATE INDEX "InspectionReportDeviceRecord_reportId_sortOrder_idx" ON "InspectionReportDeviceRecord"("reportId", "sortOrder");

-- CreateIndex
CREATE INDEX "InspectionReportDeviceRecord_deviceCode_idx" ON "InspectionReportDeviceRecord"("deviceCode");

-- CreateIndex
CREATE INDEX "InspectionReportItemResult_deviceRecordId_sortOrder_idx" ON "InspectionReportItemResult"("deviceRecordId", "sortOrder");
