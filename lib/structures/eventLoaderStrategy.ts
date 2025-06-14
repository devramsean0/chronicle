import { LoaderStrategy } from "@sapphire/pieces";
import type { Event } from "./event";
import type { EventStore } from "./eventStore";

export class EventLoaderStrategy extends LoaderStrategy<Event> {
    public override onLoad(_store: EventStore, piece: Event) {
        console.log(`Loading event: ${piece.name}`);
        app.event(piece.event ?? piece.name, async ({event, client, logger}) => {
            try {
                await piece.run(event, client, logger);
            } catch (error) {
                logger.error(`Error while handling event ${piece.event ?? piece.name}:`, error);
            }
        })
    }
}