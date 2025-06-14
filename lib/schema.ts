import { sql } from "drizzle-orm"
import {boolean, integer, pgTable, uuid, varchar } from "drizzle-orm/pg-core"

export const ticketsTable = pgTable("tickets", {
    id: uuid().primaryKey().defaultRandom(),
    originalMessageTS: varchar("original_message_ts", { length: 64 }).notNull(),
    airtableId: varchar("airtable_id", { length: 64 }).notNull().unique(),
    assignedTo: varchar("assigned_to", { length: 100}).array(2).notNull().default(sql`ARRAY[]::text[]`),
    status: integer("status").notNull().default(0),
})

export const assigneesTable = pgTable("assignees", {
    id: uuid().primaryKey().defaultRandom(),
    airtableId: varchar("airtable_id", { length: 64 }).notNull().unique(),
    slackId: varchar("slack_id", { length: 64 }).notNull().unique(),
    active: boolean("active").notNull().default(true),
});