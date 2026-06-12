-- CreateTable
CREATE TABLE "Device" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "thumbnailType" TEXT NOT NULL,
    "positionX" REAL NOT NULL,
    "positionY" REAL NOT NULL,
    "positionZ" REAL NOT NULL,
    "haloPositionX" REAL NOT NULL,
    "haloPositionY" REAL NOT NULL,
    "haloPositionZ" REAL NOT NULL,
    "haloRadius" REAL NOT NULL,
    "sortOrder" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "DeviceParameter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deviceCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "status" TEXT,
    "sortOrder" INTEGER NOT NULL,
    CONSTRAINT "DeviceParameter_deviceCode_fkey" FOREIGN KEY ("deviceCode") REFERENCES "Device" ("code") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DeviceParameter_deviceCode_sortOrder_idx" ON "DeviceParameter"("deviceCode", "sortOrder");
