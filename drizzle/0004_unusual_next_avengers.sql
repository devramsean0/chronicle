ALTER TABLE "tickets" ALTER COLUMN "assigned_to" SET DATA TYPE varchar(100)[2];--> statement-breakpoint
ALTER TABLE "tickets" ALTER COLUMN "assigned_to" SET DEFAULT ARRAY[]::text[];