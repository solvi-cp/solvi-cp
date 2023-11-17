import {ValidatedMethod} from 'meteor/mdg:validated-method';
import SimpleSchema from "simpl-schema";

import {Connections} from "./collection";
import {Things} from "../things/collection";
import {connectTasks} from "../things/methods";
import {connectionWillBeLoop} from "../../utils/api";
import {saveUndo} from "../undo/methods";

export const connectObjects = new ValidatedMethod({
    name: 'Connections.connectObjects',
    validate: new SimpleSchema({
        sourceId: String,
        destinationId: String,
        sourcePosition: SimpleSchema.Integer,
        destinationPosition: SimpleSchema.Integer,
        type: String,
        group: String,
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({sourceId, destinationId, sourcePosition, destinationPosition, type, group, noUndo}) {
        if (!noUndo) saveUndo.call();
        if (Connections.findOne({sourceId, destinationId})) return;
        if (connectionWillBeLoop(sourceId, destinationId)) {
            throw new Meteor.Error("cyclic-connection",
                "A cyclic connection will be created if the connection is made.");
        }

        const existingSourceConnections = Connections.find({sourceId});
        const sourceObject = Things.findOne({sourceId}) ??
            Things.findOne({'attributes.attributeId': sourceId}) ??
            Things.findOne({'positionAttributes.positionAttributeId': sourceId});
        const existingDestinationConnections = Connections.find({destinationId});
        const destinationObject = Things.findOne({destinationId}) ??
            Things.findOne({'attributes.attributeId': destinationId}) ??
            Things.findOne({'positionAttributes.positionAttributeId': destinationId});

        if (type === 'instanceOf' && destinationObject?.type === 'position') {
            if (existingDestinationConnections.count() > 0) {
                throw new Meteor.Error("already-connected",
                    "Something is already attached");
            }
        }

        let connectorAttributesOrder = [];
        if (type === 'putInto') {
            connectorAttributesOrder = [
                'howMany'
            ];
        }
        Connections.insert({
            createTime: new Date(),
            updateTime: new Date(),
            type,
            group,
            sourceId,
            destinationId,
            sourcePosition,
            destinationPosition,
            connectorAttributes: {
                howMany: [0, -1]
                // before: null,
                // previous: null,
                // next: null,
                // after: null
            },
            connectorAttributesOrder,
            attributesExpanded: false
        }, (err, id) => {
            if (err) console.error(err);
            if (id) {
                Things.update(sourceId, {
                    $set: {
                        [`outConnections.${type}.${destinationId}`]: id
                    }
                });
                Things.update(destinationId, {
                    $set: {
                        [`inConnections.${type}.${sourceId}`]: id
                    }
                });
                connectTasks.call({sourceId, destinationId, noUndo: true});
            }
        });
    }
});

export const changeConnectorAttribute = new ValidatedMethod({
    name: 'Connections.changeConnectorAttribute',
    validate: new SimpleSchema({
        id: String,
        connectorAttributeName: String,
        value: SimpleSchema.oneOf(String, Boolean, SimpleSchema.Integer),
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({id, connectorAttributeName, value, noUndo}) {
        if (!noUndo) saveUndo.call();
        Connections.update(
            {
                _id: id
            },
            {
                $set: {
                    updateTime: new Date(),
                    [`connectorAttributes.${connectorAttributeName}`]: typeof value === 'string' ? value.trim() : value
                }
            });
    }
});

export const toggleConnectorAttributeExpansion = new ValidatedMethod({
    name: 'Connections.toggleConnectorAttributeExpansion',
    validate: new SimpleSchema({
        id: String,
        attributesExpanded: Boolean,
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({id, attributesExpanded, noUndo}) {
        if (!noUndo) saveUndo.call();
        Connections.update(
            {
                _id: id
            },
            {
                $set: {
                    updateTime: new Date(),
                    attributesExpanded
                }
            });
    }
});

export const deleteConnector = new ValidatedMethod({
    name: 'Connections.deleteConnector',
    validate: new SimpleSchema({
        id: String,
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({id, noUndo}) {
        if (!noUndo) saveUndo.call();
        const connection = Connections.findOne(id);
        Things.update(connection.sourceId, {
            $unset: {
                [`outConnections.${connection.type}.${connection.destinationId}`]: ""
            }
        });
        Things.update(connection.destinationId, {
            $unset: {
                [`inConnections.${connection.type}.${connection.sourceId}`]: ""
            }
        });
        Connections.remove({_id: id});
    }
});