import { Mongo } from 'meteor/mongo';
import SimpleSchema from "simpl-schema";

export const Ui = new Mongo.Collection('Ui');

Ui.deny({
    insert() {
        return true;
    },
    update() {
        return true;
    },
    remove() {
        return true;
    }
});

export const uiSchema = new SimpleSchema({
    viewbox: {
        type: Object,
        optional: true
    },
    'viewbox.x': {
        type: Number
    },
    'viewbox.y': {
        type: Number
    },
    'viewbox.zoom': {
        type: Number,
        defaultValue: 1
    },
    mode: {
        type: String,
        optional: true
    },
    previousMode: {
        type: String,
        optional: true
    },
    pane: {
        type: Object,
        optional: true
    },
    'pane.width': {
        type: Number
    },
    'pane.height': {
        type: Number
    },
    paletteAngle: {
        type: Number,
        optional: true
    },
    paletteVersion: {
        type: String,
        defaultValue: "v1"
    }
});

Ui.attachSchema(uiSchema);