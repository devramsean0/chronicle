import type { KnownEventFromType, Logger } from "@slack/bolt";
import { Event } from "../lib/structures/event";
import { WebClient } from "@slack/web-api";

export class MessageEvent extends Event {
    public constructor(context: Event.LoaderContext, options: Event.Options) {
        super(context, {
            ...options,
        })
    }

    public override async run(event: KnownEventFromType<"message">, client: WebClient, logger: Logger) {
        logger.debug(`Message event received: ${JSON.stringify(event)}`);
    }
}