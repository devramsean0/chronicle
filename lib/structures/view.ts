import { Piece } from "@sapphire/pieces";

export class View<Options extends View.Options = View.Options> extends Piece<Options, 'views'> {
    public constructor(context: View.LoaderContext, options: View.Options) {
        super(context, options);
    }
}

export interface ViewOptions extends Piece.Options {

}

export namespace View {
    export type Options = ViewOptions;
    export type LoaderContext = Piece.LoaderContext<'views'>;
}