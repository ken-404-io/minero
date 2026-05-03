-- CreateTable (idempotent — table may already exist from a prior db push)
CREATE TABLE IF NOT EXISTS "ProblemReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissedAt" TIMESTAMP(3),
    "dismissedBy" TEXT,

    CONSTRAINT "ProblemReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProblemReport_status_createdAt_idx" ON "ProblemReport"("status", "createdAt");

-- AddForeignKey (skip if constraint already exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProblemReport_userId_fkey'
  ) THEN
    ALTER TABLE "ProblemReport"
      ADD CONSTRAINT "ProblemReport_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Add mediaUrl column if the table already existed without it
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ProblemReport' AND column_name = 'mediaUrl'
  ) THEN
    ALTER TABLE "ProblemReport" ADD COLUMN "mediaUrl" TEXT;
  END IF;
END $$;
