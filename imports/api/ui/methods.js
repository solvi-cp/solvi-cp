import {ValidatedMethod} from 'meteor/mdg:validated-method';
import SimpleSchema from 'simpl-schema';

import {Ui} from './collection';

export const setViewbox = new ValidatedMethod({
    name: 'Ui.setViewbox',
    validate: new SimpleSchema({
        x: Number,
        y: Number
    }).validator(),
    run({x, y}) {
        Ui.upsert({}, {$set: {'viewbox.x': x, 'viewbox.y': y}});
    }
});

export const setZoom = new ValidatedMethod({
    name: 'Ui.setZoom',
    validate: new SimpleSchema({
        zoom: Number
    }).validator(),
    run({zoom}) {
        Ui.upsert({}, {$set: {'viewbox.zoom': zoom}});
    }
});

export const setMode = new ValidatedMethod({
    name: 'Ui.setMode',
    validate: new SimpleSchema({
        mode: {type: String}
    }).validator(),
    run({mode}) {
        const uiObject = Ui.findOne({});
        if (uiObject?.mode) {
            Ui.upsert({}, {$set: {previousMode: uiObject?.mode}});
        }
        Ui.upsert({}, {$set: {mode: mode}});
    }
});

export const revertMode = new ValidatedMethod({
    name: 'Ui.revertMode',
    validate: null,
    run() {
        const uiObject = Ui.findOne({});
        if (uiObject?.previousMode) {
            Ui.upsert({}, {$set: {mode: uiObject?.previousMode, previousMode: uiObject?.mode}});
        }
    }
});

export const setPane = new ValidatedMethod({
    name: 'Ui.setPane',
    validate: new SimpleSchema({
        width: {type: Number},
        height: {type: Number}
    }).validator(),
    run({width, height}) {
        Ui.upsert({}, {$set: {pane: {width: width, height: height}}});
    }
});

export const setPalette = new ValidatedMethod({
    name: 'Ui.setPalette',
    validate: new SimpleSchema({
        paletteAngle: {type: Number}
    }).validator(),
    run({paletteAngle}) {
        Ui.upsert({}, {$set: {paletteAngle: paletteAngle}});
    }
});

export const setPaletteVersion = new ValidatedMethod({
    name: 'Ui.setPaletteVersion',
    validate: new SimpleSchema({
        version: {type: String}
    }).validator(),
    run({version}) {
        Ui.upsert({}, {$set: {paletteVersion: version}});
    }
});