import "dotenv/config";
import { $ } from "bun";
import fs from "fs/promises";

const AIRTABLE_VIEWS: string[] = [
    "viwIGANXxBqjC6v0L",
    "viw9adRITL0iJdI0M"
];

const airtableApiKey = process.env.AIRTABLE_API_KEY;
const airtableBaseId = process.env.AIRTABLE_BASE_ID;

if (!airtableApiKey) {
  throw new Error("AIRTABLE_API_KEY is not set in the environment variables.");
}

if (!airtableBaseId) {
  throw new Error("AIRTABLE_BASE_ID is not set in the environment variables.");
}

AIRTABLE_VIEWS.forEach(async (view) => {
    await $`AIRTABLE_API_KEY=${airtableApiKey} AIRTABLE_BASE_ID=${airtableBaseId} AIRTABLE_VIEW_IDS=${view} bunx airtable-ts-codegen`
    fs.rename(`${airtableBaseId}.ts`, `generated/airtable/${view}.ts`)
})