-- CreateTable
CREATE TABLE "Instrument" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "ProcessFlowStep" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "status" TEXT,
    "title" TEXT NOT NULL,
    "variant" TEXT,
    "sortOrder" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "TelemetryMetricConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deviceCode" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "baseValue" REAL NOT NULL,
    "max" REAL NOT NULL,
    "min" REAL NOT NULL,
    "precision" INTEGER NOT NULL,
    "speed" REAL NOT NULL,
    "unit" TEXT,
    "alarmSuggestion" TEXT,
    "alarmText" TEXT,
    "warningText" TEXT,
    "sortOrder" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "TelemetryMetricThreshold" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "telemetryMetricConfigId" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "value" REAL NOT NULL,
    CONSTRAINT "TelemetryMetricThreshold_telemetryMetricConfigId_fkey" FOREIGN KEY ("telemetryMetricConfigId") REFERENCES "TelemetryMetricConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Instrument_sortOrder_idx" ON "Instrument"("sortOrder");

-- CreateIndex
CREATE INDEX "ProcessFlowStep_sortOrder_idx" ON "ProcessFlowStep"("sortOrder");

-- CreateIndex
CREATE INDEX "TelemetryMetricConfig_deviceCode_sortOrder_idx" ON "TelemetryMetricConfig"("deviceCode", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TelemetryMetricConfig_deviceCode_key_key" ON "TelemetryMetricConfig"("deviceCode", "key");

-- CreateIndex
CREATE UNIQUE INDEX "TelemetryMetricThreshold_telemetryMetricConfigId_direction_level_key" ON "TelemetryMetricThreshold"("telemetryMetricConfigId", "direction", "level");
