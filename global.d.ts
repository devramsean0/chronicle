import type { App } from '@slack/bolt';
import type { AirtableTs } from 'airtable-ts';
import type { NodePgClient, nodePgDatabase } from 'drizzle-orm/node-postgres';

import type { EventStore } from './structures/event';
import type { ActionStore } from './structures/action';
import type { ViewStore } from './lib/structures/viewStore';

declare global {
    var app: App;
    var db: nodePgDatabase<Record<string, never>> & {
        $client: NodePgClient;
    }
    var airtable: AirtableTs;
}
export { };

declare module '@sapphire/pieces' {
	interface StoreRegistryEntries {
		events: EventStore;
        actions: ActionStore;
        views: ViewStore
	}
}
