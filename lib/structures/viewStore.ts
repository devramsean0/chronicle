import { Store } from "@sapphire/pieces";
import { View } from "./view";
import { ViewLoaderStrategy } from "./viewLoaderStrategy";
1
export class ViewStore extends Store<View, 'views'> {
    public constructor() {
        super(View, { name: 'views', strategy: new ViewLoaderStrategy() });
    }
}