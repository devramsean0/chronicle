import { Piece } from "@sapphire/pieces";
import type { KnownEventFromType } from "@slack/bolt";
import { WebClient, type Logger } from "@slack/web-api";

export class Event<Options extends Event.Options = Event.Options> extends Piece<Options, 'events'> {
    public readonly event: string | undefined;

    public constructor(context: Event.LoaderContext, options: Event.Options) {
        super(context, options);
        this.event = options.event ?? options.name;
    }

    public run(event: unknown, client: WebClient, logger: Logger) {
        logger.debug(`Event ${this.event} received, but no handler is defined.`);
    }
}

export interface EventOptions extends Piece.Options {
    event: string | null;
}

export namespace Event {
    export type Options = EventOptions;
    export type LoaderContext = Piece.LoaderContext<'events'>;
}