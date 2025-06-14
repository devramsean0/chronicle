import { Store } from "@sapphire/pieces";
import { Action } from "./action";
import { ActionLoaderStrategy } from "./actionLoaderStrategy";

export class ActionStore extends Store<Action, 'actions'> {
    public constructor() {
        super(Action, { name: 'actions', strategy: new ActionLoaderStrategy() });
    }
}