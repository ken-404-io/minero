-- Add optional media attachment URL to ProblemReport.
-- Uses IF NOT EXISTS so it is safe to re-run if the column was already added.
ALTER TABLE "ProblemReport" ADD COLUMN IF NOT EXISTS "mediaUrl" TEXT;
