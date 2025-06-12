import type { App } from '@slack/bolt';
import type { NodePgClient, nodePgDatabase } from 'drizzle-orm/node-postgres';

declare global {
    var app: App;
    var db: nodePgDatabase<Record<string, never>> & {
        $client: NodePgClient;
    }
}
export { };