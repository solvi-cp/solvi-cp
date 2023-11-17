import {ValidatedMethod} from 'meteor/mdg:validated-method';
import SimpleSchema from "simpl-schema";

import {Random} from 'meteor/random';

import {Things} from "./collection";
import {Connections} from "../connections/collection";

import {
    getDirectInstances,
    propagateAttributes,
    updateConnectedAmountMinimums
} from "../../utils/api";
import {connectObjects, deleteConnector} from "../connections/methods";
import {saveUndo} from "../undo/methods";
import {constants} from "../../ui/helpers/shared";

export const createThings = new ValidatedMethod({
    name: 'Things.createThings',
    validate: new SimpleSchema({
        paths: Array,
        'paths.$': Array,
        'paths.$.$': Array,
        'paths.$.$.$': SimpleSchema.oneOf(Number, String),
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({paths, noUndo}) {
        if (!noUndo) saveUndo.call();
        Things.insert({
            type: 'object',
            createTime: new Date(),
            updateTime: new Date(),
            instancesExpanded: false,
            typeAttributes: {
                name: `${Random.id(2)}`,
                amount: 1,
                ordered: false,
                repeated: false,
                typeRepeated: false,
                circular: false,
                capacity: [0, -1]
            },
            typeAttributesOrder: [
                'name',
            ],
            attributes: [],
            pickedRelationships: [],
            x: null,
            y: null,
            paths,
            priority: 1,
            reverseConnectors: false,
            inConnections: {},
            outConnections: {}
        });
    }
});

export const createInstances = new ValidatedMethod({
    name: 'Things.createInstance',
    validate: new SimpleSchema({
        id: String,
        x: Number,
        y: Number,
        width: Number,
        height: Number,
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({id, x, y, width, height, noUndo}) {
        if (!noUndo) saveUndo.call();
        const object = Things.findOne(id);
        const amount = object.typeAttributes.amount;
        let newX = x - width * 1.5;
        let newY = y + height;
        for (let i = 0; i < amount; i++) {
            Things.insert({
                type: 'object',
                createTime: new Date(),
                updateTime: new Date(),
                instancesExpanded: false,
                typeAttributes: {
                    name: `${object.typeAttributes.name} ${i + 1}`,
                    amount: 1,
                    ordered: object.typeAttributes.ordered,
                    repeated: object.typeAttributes.repeated,
                    circular: object.typeAttributes.circular,
                    capacity: [Math.floor(object.typeAttributes.capacity[0] / amount),
                        object.typeAttributes.capacity[1] === -1 ?
                            -1 : Math.floor(object.typeAttributes.capacity[1] / amount)]
                },
                typeAttributesOrder: [
                    'name',
                ],
                attributes: object.attributes.filter(el => el.initial).map(el => ({...el, attributeId: Random.id(2)})),
                pickedRelationships: [],
                x: newX,
                y: newY + (height * i),
                paths: object.paths,
                priority: 1,
                reverseConnectors: false,
                inConnections: {},
                outConnections: {}
            }, (err, newId) => {
                if (err) {
                    console.error(err);
                    return;
                }
                if (object.type.includes('container')) {
                    changeType.call({id: newId, type: 'container', noUndo: true});
                }
                connectObjects.call({
                    sourceId: newId,
                    destinationId: id,
                    sourcePosition: 4,
                    destinationPosition: 3,
                    type: 'instanceOf',
                    group: 'instance',
                    noUndo: true
                });
                if (object.attributesAndValuesToLoad?.length) {
                    const attributesHeader = Object.keys(object.attributesAndValuesToLoad[0]);
                    const valueMap = object.attributesAndValuesToLoad[i];
                    const instance = Things.findOne(newId);
                    attributesHeader.forEach(el => {
                        if (el === 'name') {
                            changeTypeAttribute.call({
                                id: newId,
                                value: valueMap.name.toString(),
                                typeAttributeName: "name",
                                noUndo: true
                            })
                        } else {
                            const targetAttribute = instance.attributes.filter(attr => attr.key === el)?.[0];
                            if (targetAttribute) {
                                const attributeIndex = instance.attributes.findIndex(el => el === targetAttribute);
                                const valueToSet = valueMap[el]
                                if (/^\d+$/.test(valueToSet)) {
                                    createAndConnectValue.call({
                                        x: newX - 150,
                                        y: newY + (height * i) + 100 + 50 * attributeIndex,
                                        startValue: parseInt(valueToSet),
                                        destinationId: targetAttribute.attributeId,
                                        noUndo: true
                                    });
                                } else {
                                    createAndConnectText.call({
                                        x: newX - 150,
                                        y: newY + (height * i) + 100 + 50 * attributeIndex,
                                        startValue: valueToSet.toString(),
                                        destinationId: targetAttribute.attributeId,
                                        noUndo: true
                                    });
                                }
                            }
                        }
                    });
                }
            });
        }
    }
});

export const createSelector = new ValidatedMethod({
    name: 'Things.createSelector',
    validate: new SimpleSchema({
        id: String,
        x: Number,
        y: Number,
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({id, x, y, noUndo}) {
        if (!noUndo) saveUndo.call();
        const object = Things.findOne(id);
        Things.insert({
            type: 'selector',
            createTime: new Date(),
            updateTime: new Date(),
            typeAttributes: {
                name: `${Random.id(2)}`
            },
            typeAttributesOrder: [
                'name',
            ],
            selectorType: 'any',
            selectorTypeRange: [1, -1],
            pickedAttributes: [],
            pickedRelationships: [],
            x,
            y,
            inConnections: {},
            outConnections: {}
        }, (err, newId) => {
            if (err) {
                console.error(err);
                return;
            }
            if (object.type === 'representative') {
                connectObjects.call({
                    sourceId: id,
                    destinationId: newId,
                    sourcePosition: 4,
                    destinationPosition: 0,
                    type: 'selector',
                    group: 'prototype',
                    noUndo: true
                });
            } else {
                connectObjects.call({
                    sourceId: id,
                    destinationId: newId,
                    sourcePosition: 6,
                    destinationPosition: 0,
                    type: 'selector',
                    group: 'prototype',
                    noUndo: true
                });
            }
            createRepresentative.call({id: newId, x: x + 200, y, noUndo: true});
        });
    }
});

export const createRepresentative = new ValidatedMethod({
    name: 'Things.createRepresentative',
    validate: new SimpleSchema({
        id: String,
        x: Number,
        y: Number,
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({id, x, y, noUndo}) {
        if (!noUndo) saveUndo.call();
        const object = Things.findOne(id);
        Things.insert({
            type: 'representative',
            createTime: new Date(),
            updateTime: new Date(),
            pickedAttributes: [],
            pickedRelationships: [],
            x,
            y,
            inConnections: {},
            outConnections: {}
        }, (err, newId) => {
            if (err) {
                console.error(err);
                return;
            }
            connectObjects.call({
                sourceId: id,
                destinationId: newId,
                sourcePosition: 2,
                destinationPosition: 0,
                type: 'representative',
                group: 'prototype',
                noUndo: true
            });
        });
    }
});

export const changeSelectorType = new ValidatedMethod({
    name: 'Things.changeSelectorType',
    validate: new SimpleSchema({
        id: String,
        type: String,
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({id, type, noUndo}) {
        if (!noUndo) saveUndo.call();
        Things.update({
            _id: id
        }, {
            $set: {
                updateTime: new Date(),
                selectorType: type
            }
        }, {
            multi: true
        })
    }
});

export const changeRepeatedLevels = new ValidatedMethod({
    name: 'Things.changeRepeatedLevels',
    validate: new SimpleSchema({
        id: String,
        repeatedLevels: {
            type: Array
        },
        'repeatedLevels.$': {
            type: Boolean,
            optional: true
        },
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({id, repeatedLevels, noUndo}) {
        if (!noUndo) saveUndo.call();
        Things.update({
            _id: id
        }, {
            $set: {
                updateTime: new Date(),
                repeatedLevels: repeatedLevels
            }
        }, {
            multi: true
        })
    }
});

export const changeSelectorTypeRange = new ValidatedMethod({
    name: 'Things.changeSelectorTypeRange',
    validate: new SimpleSchema({
        id: String,
        value: Array,
        'value.$': SimpleSchema.Integer,
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({id, value, noUndo}) {
        if (!noUndo) saveUndo.call();
        Things.update({
            _id: id
        }, {
            $set: {
                updateTime: new Date(),
                selectorTypeRange: value
            }
        }, {
            multi: true
        });
    }
});

export const addPickedAttribute = new ValidatedMethod({
    name: 'Things.addPickedAttribute',
    validate: new SimpleSchema({
        id: String,
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({id, noUndo}) {
        if (!noUndo) saveUndo.call();
        Things.update({_id: id}, {
            $set: {
                updateTime: new Date(),
            },
            $push: {
                pickedAttributes: {
                    attributeId: Random.id(),
                    parentAttributeId: ''
                }
            }
        });
    }
});

export const changePickedAttribute = new ValidatedMethod({
    name: 'Things.changePickedAttribute',
    validate: new SimpleSchema({
        attributeId: String,
        parentAttributeId: String,
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({attributeId, parentAttributeId, noUndo}) {
        if (!noUndo) saveUndo.call();
        Things.update({
            'pickedAttributes.attributeId': attributeId
        }, {
            $set: {
                updateTime: new Date(),
                'pickedAttributes.$.parentAttributeId': parentAttributeId
            }
        }, {
            multi: true
        })
    }
});

export const addPickedRelationships = new ValidatedMethod({
    name: 'Things.addPickedRelationships',
    validate: new SimpleSchema({
        id: String,
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({id, noUndo}) {
        if (!noUndo) saveUndo.call();
        Things.update({_id: id}, {
            $set: {
                updateTime: new Date(),
            },
            $push: {
                pickedRelationships: {
                    relationshipAttributeId: Random.id(),
                    relationshipAttribute: '',
                    relationshipAttributeRange: [1, -1]
                }
            }
        });
    }
});

export const changePickedRelationships = new ValidatedMethod({
    name: 'Things.changePickedRelationships',
    validate: new SimpleSchema({
        relationshipAttributeId: String,
        relationshipAttribute: String,
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({relationshipAttributeId, relationshipAttribute, noUndo}) {
        if (!noUndo) saveUndo.call();
        Things.update({
            'pickedRelationships.relationshipAttributeId': relationshipAttributeId
        }, {
            $set: {
                updateTime: new Date(),
                'pickedRelationships.$.relationshipAttribute': relationshipAttribute.trim()
            }
        }, {
            multi: true
        })
    }
});

export const changePickedRelationshipsRange = new ValidatedMethod({
    name: 'Things.changePickedRelationshipsRange',
    validate: new SimpleSchema({
        relationshipAttributeId: String,
        relationshipAttributeRange: Array,
        'relationshipAttributeRange.$': SimpleSchema.Integer,
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({relationshipAttributeId, relationshipAttributeRange, noUndo}) {
        if (!noUndo) saveUndo.call();
        Things.update({
            'pickedRelationships.relationshipAttributeId': relationshipAttributeId
        }, {
            $set: {
                updateTime: new Date(),
                'pickedRelationships.$.relationshipAttributeRange': relationshipAttributeRange
            }
        }, {
            multi: true
        });
    }
});

export const moveThings = new ValidatedMethod({
    name: 'Things.moveThings',
    validate: new SimpleSchema({
        id: String,
        x: Number,
        y: Number,
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({id, x, y, noUndo}) {
        if (!noUndo) saveUndo.call();
        Things.update({
                _id: id
            },
            {
                $set: {
                    updateTime: new Date(),
                    x,
                    y
                }
            });
    }
});

export const changeType = new ValidatedMethod({
    name: 'Things.changeType',
    validate: new SimpleSchema({
        id: String,
        type: String,
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({id, type, noUndo}) {
        if (!noUndo) saveUndo.call();
        switch (type) {
            case 'object':
                Things.update({_id: id}, {
                    $set: {
                        updateTime: new Date(),
                        type
                    }
                });
                Things.update({_id: id}, {
                    $set: {
                        updateTime: new Date(),
                    },
                    $pullAll: {
                        typeAttributesOrder: ['ordered', 'circular', 'capacity', 'repeated', 'typeRepeated', 'amount']
                    }
                });
                break;
            case 'object_type':
                Things.update({_id: id}, {
                    $set: {
                        updateTime: new Date(),
                        type
                    },
                    $addToSet: {
                        typeAttributesOrder: {$each: ['amount']}
                    }
                });
                Things.update({_id: id}, {
                    $set: {
                        updateTime: new Date(),
                    },
                    $pullAll: {
                        typeAttributesOrder: ['ordered', 'circular', 'capacity', 'repeated', 'typeRepeated']
                    }
                });
                break;
            case 'container':
                Things.update({_id: id}, {
                    $set: {
                        updateTime: new Date(),
                        type
                    },
                    $addToSet: {
                        typeAttributesOrder: {$each: ['ordered', 'circular', 'capacity', 'repeated']}
                    }
                });
                Things.update({_id: id}, {
                    $set: {
                        updateTime: new Date(),
                    },
                    $pullAll: {
                        typeAttributesOrder: ['amount', 'typeRepeated']
                    }
                });
                break;
            case 'container_type':
                Things.update({_id: id}, {
                    $set: {
                        updateTime: new Date(),
                        type
                    },
                    $addToSet: {
                        typeAttributesOrder: {$each: ['amount', 'ordered', 'circular', 'capacity', 'typeRepeated']}
                    }
                });
                Things.update({_id: id}, {
                    $set: {
                        updateTime: new Date(),
                    },
                    $pullAll: {
                        typeAttributesOrder: ['repeated',]
                    }
                });
                break;
        }
    }
});

export const reverseConnectors = new ValidatedMethod({
    name: 'Things.reverseConnectors',
    validate: new SimpleSchema({
        id: String,
        reverseConnectors: Boolean,
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({id, reverseConnectors, noUndo}) {
        if (!noUndo) saveUndo.call();
        Things.update(
            {
                _id: id
            },
            {
                $set: {
                    updateTime: new Date(),
                    reverseConnectors
                }
            });
    }
});

export const changeTypeAttribute = new ValidatedMethod({
    name: 'Things.changeTypeAttribute',
    validate: new SimpleSchema({
        id: String,
        typeAttributeName: String,
        value: SimpleSchema.oneOf(String, Boolean, Array, SimpleSchema.Integer),
        'value.$': {
            type: SimpleSchema.Integer,
            optional: true
        },
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({id, typeAttributeName, value, noUndo}) {
        if (!noUndo) saveUndo.call();
        Things.update(
            {
                _id: id
            },
            {
                $set: {
                    updateTime: new Date(),
                    [`typeAttributes.${typeAttributeName}`]: typeof value === 'string' ? value.trim() : value
                }
            });
        if (typeAttributeName === 'amount') {
            updateConnectedAmountMinimums(id);
        } else if (typeAttributeName === 'ordered' || typeAttributeName === 'circular') {
            const thing = Things.findOne(id);
            if (thing.type === 'container_type' &&
                Object.keys(thing?.inConnections?.instanceOf ?? {}).length > 0) {
                Object.keys(thing?.inConnections?.instanceOf ?? {}).forEach(el => {
                    Things.update(
                        {
                            _id: el
                        },
                        {
                            $set: {
                                updateTime: new Date(),
                                [`typeAttributes.${typeAttributeName}`]: typeof value === 'string' ?
                                    value.trim() : value
                            }
                        });
                });
            }
        }
    }
});

export const copyTypeAttribute = new ValidatedMethod({
    name: 'Things.copyTypeAttribute',
    validate: new SimpleSchema({
        id: String,
        copyName: String,
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({id, copyName, noUndo}) {
        if (!noUndo) saveUndo.call();
        const baseObj = Things.findOne(id);
        const typeObj = Object.keys(baseObj.outConnections?.instanceOf ?? {}).map(el => {
            const obj = Things.findOne(el);
            if (obj.type.includes('type')) {
                return Things.findOne(obj);
            }
        });
        typeObj.forEach(obj => Object.keys(obj?.inConnections?.instanceOf ?? {}).forEach(el => {
                Things.update(
                    {
                        _id: el
                    },
                    {
                        $set: {
                            [`typeAttributes.${copyName}`]: baseObj.typeAttributes[copyName]
                        }
                    });
            })
        )
    }
});

export const toggleInstancesExpansion = new ValidatedMethod({
    name: 'Things.toggleInstancesExpansion',
    validate: new SimpleSchema({
        id: String,
        instancesExpanded: Boolean,
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({id, instancesExpanded, noUndo}) {
        if (!noUndo) saveUndo.call();
        Things.update(
            {
                _id: id
            },
            {
                $set: {
                    updateTime: new Date(),
                    instancesExpanded
                }
            });
    }
});

// export const removeAllAttributes = new ValidatedMethod({
//     name: 'Things.removeAllAttributes',
//     validate: new SimpleSchema({
//         id: String,
//     }).validator(),
//     run({id}) {
//         return
//         // Need to add way of disconnecting values and maybe deleting connected values and propagated attributes
//         Things.update({_id: id}, {
//             $set: {
//                 updateTime: new Date(),
//                 attributes: []
//             }
//         });
//     }
// })

export const addAttribute = new ValidatedMethod({
    name: 'Things.addAttribute',
    validate: new SimpleSchema({
        id: String,
        noUndo: {
            type: Boolean,
            optional: true
        },
        attributeName: {
            type: String,
            optional: true
        }
    }).validator(),
    run({id, noUndo, attributeName}) {
        if (!noUndo) saveUndo.call();

        Things.update({_id: id}, {
            $set: {
                updateTime: new Date(),
            },
            $push: {
                attributes: {
                    attributeId: Random.id(),
                    key: attributeName ? attributeName : `attribute ${Random.id(2)}`,
                    parentAttributeId: Random.id(),
                    initial: true,
                    sourceObj: [id]
                }
            }
        }, (err, num) => {
            if (!err && num > 0) {
                propagateAttributes(id);
            }
        });
    }
});

export const batchAddAttributeAndValues = new ValidatedMethod({
    name: 'Things.batchAddAttributeAndValues',
    validate: new SimpleSchema({
        parentId: String,
        noUndo: {
            type: Boolean,
            optional: true
        },
        attributeName: {
            type: String
        },
        values: {
            type: Array,
        },
        'values.$': {
            type: SimpleSchema.oneOf(Number, String)
        },
        sketchHeight: {
            type: Number
        },
    }).validator(),
    run({parentId, noUndo, attributeName, values, sketchHeight}) {
        if (!noUndo) saveUndo.call();

        const directInstances = [...getDirectInstances(parentId)];
        const targetId = directInstances.length > 0 ? directInstances[0]._id : parentId._id;
        const parentAttributeId = Random.id();
        Things.update({_id: targetId}, {
            $set: {
                updateTime: new Date(),
            },
            $push: {
                attributes: {
                    attributeId: Random.id(),
                    key: attributeName,
                    parentAttributeId: parentAttributeId,
                    initial: true,
                    sourceObj: [parentId]
                }
            }
        }, (err, num) => {
            if (!err && num > 0) {
                propagateAttributes(targetId);
                const directInstancesUpdated = [...getDirectInstances(parentId)];
                directInstancesUpdated.forEach((el, i) => {
                    const targetAttribute = el.attributes
                        .filter(attr => attr.parentAttributeId === parentAttributeId)?.[0];
                    if (targetAttribute) {
                        const attributeIndex = el.attributes.findIndex(el => el === targetAttribute);
                        const valueToSet = values[i]
                        if (/^\d+$/.test(valueToSet)) {
                            createAndConnectValue.call({
                                x: el.x - 150,
                                y: el.y + 100 + sketchHeight + 50 * attributeIndex,
                                startValue: parseInt(valueToSet),
                                destinationId: targetAttribute.attributeId,
                                noUndo: true
                            });
                        } else {
                            createAndConnectText.call({
                                x: el.x - 150,
                                y: el.y + 100 + sketchHeight + 50 * attributeIndex,
                                startValue: valueToSet.toString(),
                                destinationId: targetAttribute.attributeId,
                                noUndo: true
                            });
                        }
                    }
                });
            }
        });
    }
});

export const addAttributesAndValuesToLoad = new ValidatedMethod({
    name: 'Things.addAttributesAndValuesToLoad',
    validate: new SimpleSchema({
        id: String,
        noUndo: {
            type: Boolean,
            optional: true
        },
        attributesAndValuesToLoad: {
            type: Array
        },
        'attributesAndValuesToLoad.$': {
            type: Object,
            blackbox: true,
            optional: true
        },
    }).validator(),
    run({id, noUndo, attributesAndValuesToLoad}) {
        if (!noUndo) saveUndo.call();
        Things.update({_id: id}, {
            $set: {
                updateTime: new Date(),
                attributesAndValuesToLoad: attributesAndValuesToLoad
            }
        });
    }
});

export const changeAttributeName = new ValidatedMethod({
    name: 'Things.changeAttributeName',
    validate: new SimpleSchema({
        attributeId: String,
        value: String,
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({attributeId, value, noUndo}) {
        if (!noUndo) saveUndo.call();
        let object = Things.findOne({
            'attributes.attributeId': attributeId
        });
        let attribute = object?.attributes?.find(el => el.attributeId === attributeId);
        if (attribute?.parentAttributeId) {
            Things.update({
                'attributes.parentAttributeId': attribute.parentAttributeId
            }, {
                $set: {
                    updateTime: new Date(),
                    'attributes.$.key': value.trim()
                }
            }, {
                multi: true
            })
        } else {
            Things.update({
                'attributes.attributeId': attributeId
            }, {
                $set: {
                    updateTime: new Date(),
                    'attributes.$.key': value.trim()
                }
            }, {
                multi: true
            })
        }
    }
});

export const connectTasks = new ValidatedMethod({
    name: 'Things.connectTasks',
    validate: new SimpleSchema({
        sourceId: String,
        destinationId: String,
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({sourceId, destinationId, noUndo}) {
        if (!noUndo) saveUndo.call();
        const sourceObject = Things.findOne(sourceId);
        const destinationObject = Things.findOne(destinationId);
        const link = Connections.findOne({sourceId: sourceId, destinationId: destinationId});
        switch (link?.type) {
            case 'putInto':
                /*
                    0) Assumes that connection has been made.
                    1) If destination is object -> container, object_type -> container_type
                    2) Propagate attribute of source downstream
                    3) Get inherited attributes of destination and apply to source
                */
                if (!(sourceObject?.typeAttributes && destinationObject?.typeAttributes)) return;

                if (destinationObject?.type === 'object') {
                    changeType.call({id: destinationId, type: 'container'});
                } else if (destinationObject?.type === 'object_type') {
                    changeType.call({id: destinationId, type: 'container_type'});
                }

                propagateAttributes(sourceId, destinationId);
                break;
            case 'instanceOf':
                if (destinationObject && destinationObject.type.includes('type')) {
                    Things.update({_id: destinationId}, {
                        $set: {
                            updateTime: new Date(),
                            instancesExpanded: true
                        }
                    });
                    propagateAttributes(sourceId, destinationId);
                    updateConnectedAmountMinimums(destinationId);
                    ['ordered', 'circular'].forEach(el => {
                        const value = destinationObject?.typeAttributes?.[el];
                        Things.update(
                            {
                                _id: sourceId
                            },
                            {
                                $set: {
                                    updateTime: new Date(),
                                    [`typeAttributes.${el}`]: typeof value === 'string' ?
                                        value.trim() : value
                                }
                            });
                    })
                }
                break;
            default:
                break;
        }
    }
});

export const createValue = new ValidatedMethod({
    name: 'Things.createValue',
    validate: new SimpleSchema({
        x: Number,
        y: Number,
        noUndo: {
            type: Boolean,
            optional: true
        },
        startValue: {
            type: Number,
            optional: true
        }
    }).validator(),
    run({x, y, noUndo, startValue}) {
        if (!noUndo) saveUndo.call();
        Things.insert({
            type: 'value',
            createTime: new Date(),
            updateTime: new Date(),
            x: x,
            y: y,
            value: startValue === undefined ? 0 : startValue,
            priority: 1,
            reverseConnectors: false
        });
    }
});

export const createAndConnectValue = new ValidatedMethod({
    name: 'Things.createAndConnectValue',
    validate: new SimpleSchema({
        x: Number,
        y: Number,
        noUndo: {
            type: Boolean,
            optional: true
        },
        startValue: {
            type: Number,
            optional: true
        },
        destinationId: String
    }).validator(),
    run({x, y, noUndo, startValue, destinationId}) {
        if (!noUndo) saveUndo.call();
        return Things.insert({
            type: 'value',
            createTime: new Date(),
            updateTime: new Date(),
            x: x,
            y: y,
            value: startValue === undefined ? 0 : startValue,
            priority: 1,
            reverseConnectors: false,
        }, (err, newId) => {
            if (err) {
                console.error(err);
                return;
            }
            connectObjects.call({
                sourceId: newId,
                destinationId: destinationId,
                sourcePosition: 2,
                destinationPosition: 0,
                type: 'assignment',
                group: 'value',
                noUndo: true
            });
        });
    }
});

export const changeValue = new ValidatedMethod({
    name: 'Things.changeValue',
    validate: new SimpleSchema({
        id: String,
        value: Number,
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({id, value, noUndo}) {
        if (!noUndo) saveUndo.call();
        let valueFloat = parseFloat(value);
        if (isNaN(valueFloat)) return;
        Things.update({_id: id}, {
            $set: {
                updateTime: new Date(),
                value: valueFloat
            }
        });
    }
});

export const createText = new ValidatedMethod({
    name: 'Things.createText',
    validate: new SimpleSchema({
        x: Number,
        y: Number,
        noUndo: {
            type: Boolean,
            optional: true
        },
        startValue: {
            type: String,
            optional: true
        }
    }).validator(),
    run({x, y, noUndo, startValue}) {
        if (!noUndo) saveUndo.call();
        Things.insert({
            type: 'text',
            createTime: new Date(),
            updateTime: new Date(),
            x: x,
            y: y,
            value: startValue === undefined ? 'blank text' : startValue,
            priority: 1,
            reverseConnectors: false
        });
    }
});

export const createAndConnectText = new ValidatedMethod({
    name: 'Things.createAndConnectText',
    validate: new SimpleSchema({
        x: Number,
        y: Number,
        noUndo: {
            type: Boolean,
            optional: true
        },
        startValue: {
            type: String,
            optional: true
        },
        destinationId: String
    }).validator(),
    run({x, y, noUndo, startValue, destinationId}) {
        if (!noUndo) saveUndo.call();
        return Things.insert({
            type: 'text',
            createTime: new Date(),
            updateTime: new Date(),
            x: x,
            y: y,
            value: startValue === undefined ? 'blank text' : startValue,
            priority: 1,
            reverseConnectors: false,
        }, (err, newId) => {
            if (err) {
                console.error(err);
                return;
            }
            connectObjects.call({
                sourceId: newId,
                destinationId: destinationId,
                sourcePosition: 2,
                destinationPosition: 0,
                type: 'assignment',
                group: 'value',
                noUndo: true
            });
        });
    }
});

export const changeText = new ValidatedMethod({
    name: 'Things.changeText',
    validate: new SimpleSchema({
        id: String,
        text: String,
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({id, text, noUndo}) {
        if (!noUndo) saveUndo.call();
        Things.update({_id: id}, {
            $set: {
                updateTime: new Date(),
                value: text.trim()
            }
        });
    }
});

export const createIcon = new ValidatedMethod({
    name: 'Things.createIcon',
    validate: new SimpleSchema({
        icon: String,
        x: Number,
        y: Number,
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({icon, x, y, noUndo}) {
        if (!noUndo) saveUndo.call();
        Things.insert({
            type: "icon",
            createTime: new Date(),
            updateTime: new Date(),
            icon,
            x,
            y,
            priority: 1,
            reverseConnectors: false
        });
    }
});

export const deleteThing = new ValidatedMethod({
    name: 'Things.deleteThing',
    validate: new SimpleSchema({
        id: String,
        noUndo: {
            type: Boolean,
            optional: true
        }
    }).validator(),
    run({id, noUndo}) {
        if (!noUndo) saveUndo.call();
        const connections = Connections.find({
            $or: [{
                sourceId: id
            }, {
                destinationId: id
            }]
        }).forEach(el => deleteConnector.call({id: el._id, noUndo: true}))
        const thing = Things.findOne({_id: id});
        if (thing.attributes) {
            thing.attributes.forEach(el => {
                const attributesConnections = Connections.find({
                    $or: [{
                        sourceId: el.attributeId
                    }, {
                        destinationId: el.attributeId
                    }]
                }).forEach(el => deleteConnector.call({id: el._id, noUndo: true}))
            });
        }
        if (thing.pickedRelationships) {
            thing.pickedRelationships.forEach(el => {
                const attributesConnections = Connections.find({
                    $or: [{
                        sourceId: el.relationshipAttributeId
                    }, {
                        destinationId: el.relationshipAttributeId
                    }]
                }).forEach(el => deleteConnector.call({id: el._id, noUndo: true}))
            });
        }
        if (thing.pickedAttributes) {
            thing.pickedAttributes.forEach(el => {
                const attributesConnections = Connections.find({
                    $or: [{
                        sourceId: el.attributeId
                    }, {
                        destinationId: el.attributeId
                    }]
                }).forEach(el => deleteConnector.call({id: el._id, noUndo: true}))
            });
        }
        Things.remove({_id: id});
    }
});