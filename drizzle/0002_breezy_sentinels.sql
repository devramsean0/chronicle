CREATE TABLE "assignees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slack_id" varchar(64) NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tickets" ALTER COLUMN "assigned_to" SET DATA TYPE varchar(10)[2];--> statement-breakpoint
ALTER TABLE "tickets" ALTER COLUMN "assigned_to" SET DEFAULT ARRAY[]::text[];