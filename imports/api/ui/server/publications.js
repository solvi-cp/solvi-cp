import {Meteor} from "meteor/meteor";

import {Ui} from "../collection";

Meteor.publish('Ui', () => {
    return Ui.find();
});

Meteor.startup(() => {
    if (!Ui.findOne()) {
        Ui.insert({
            viewbox: {
                x: 0,
                y: 0,
                zoom: 1
            },
            mode: 'pan',
            previousMode: 'pan',
            pane: {
                width: -1,
                height: -1
            },
            paletteAngle: 10,
        });
    }
});
