-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "company" TEXT,
    "tags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "bodyText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" DATETIME,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmailRecipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "openedAt" DATETIME,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" DATETIME,
    "errorMsg" TEXT,
    "trackingId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmailRecipient_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "gmailAddress" TEXT NOT NULL DEFAULT '',
    "gmailAppPassword" TEXT NOT NULL DEFAULT '',
    "senderName" TEXT NOT NULL DEFAULT '',
    "dailyLimit" INTEGER NOT NULL DEFAULT 500,
    "delayBetween" INTEGER NOT NULL DEFAULT 2
);

-- CreateIndex
CREATE UNIQUE INDEX "Contact_email_key" ON "Contact"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EmailRecipient_trackingId_key" ON "EmailRecipient"("trackingId");

-- CreateIndex
CREATE INDEX "EmailRecipient_campaignId_idx" ON "EmailRecipient"("campaignId");

-- CreateIndex
CREATE INDEX "EmailRecipient_contactId_idx" ON "EmailRecipient"("contactId");

-- CreateIndex
CREATE INDEX "EmailRecipient_trackingId_idx" ON "EmailRecipient"("trackingId");
