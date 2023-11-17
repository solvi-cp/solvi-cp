import {Mongo} from 'meteor/mongo';
import SimpleSchema from "simpl-schema";

export const Connections = new Mongo.Collection('Connections');

Connections.deny({
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

const connectionAttributeSchema = new SimpleSchema({
    howMany: {
        type: Array,
        optional: true
    },
    'howMany.$': {
        type: SimpleSchema.Integer,
        optional: true
    }
});

export const connectionsSchema = new SimpleSchema({
    sourceId: {
        type: String,
        index: true
    },
    destinationId: {
        type: String,
        index: true
    },
    // main: 0 input a, 1 input b, 2 output; instance: 3 input, 4 output; prototype: 5 input, 6 output
    // reversed affects 0 and 1
    sourcePosition: {
        type: SimpleSchema.Integer
    },
    destinationPosition: {
        type: SimpleSchema.Integer
    },
    type: {
        type: String
    },
    group: {
        type: String
    },
    createTime: {
        type: Date
    },
    updateTime: {
        type: Date
    },
    connectorAttributes: {
        type: connectionAttributeSchema
    },
    connectorAttributesOrder: {
        type: Array
    },
    'connectorAttributesOrder.$': {
        type: String
    },
    attributesExpanded: {
        type: Boolean
    }
});

Connections.attachSchema(connectionsSchema);