import { Store } from "@sapphire/pieces";
import { Event } from "./event";
import { EventLoaderStrategy } from "./eventLoaderStrategy";

export class EventStore extends Store<Event, 'events'> {
    public constructor() {
        super(Event, { name: 'events', strategy: new EventLoaderStrategy() });
    }
}