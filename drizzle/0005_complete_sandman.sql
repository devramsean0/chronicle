ALTER TABLE "assignees" ADD COLUMN "airtable_id" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "airtable_id" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "assignees" ADD CONSTRAINT "assignees_airtable_id_unique" UNIQUE("airtable_id");--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_airtable_id_unique" UNIQUE("airtable_id");