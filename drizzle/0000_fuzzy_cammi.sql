CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"original_message_ts" varchar(64) NOT NULL,
	"assigned_to" varchar(64)[2] DEFAULT ARRAY[]::text[] NOT NULL,
	"status" integer DEFAULT 0 NOT NULL
);
