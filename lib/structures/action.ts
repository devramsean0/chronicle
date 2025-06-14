import { Piece } from "@sapphire/pieces";

export class Action<Options extends Action.Options = Action.Options> extends Piece<Options, 'actions'> {
    public constructor(context: Action.LoaderContext, options: Action.Options) {
        super(context, options);
    }
}

export interface ActionOptions extends Piece.Options {
}

export namespace Action {
    export type Options = ActionOptions;
    export type LoaderContext = Piece.LoaderContext<'actions'>;
}