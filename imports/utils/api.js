import {Connections} from "../api/connections/collection";
import {Things} from "../api/things/collection";
import {Random} from 'meteor/random';

export const walkTree = (id, getDownstreamNodeArray, getUpstreamNodeArray, runner, downstreamTtl = 128,
                         upstreamTtl = 128, sideBranches = true, visited = [],
                         initial = true, lastId = null) => {
    // getDownstreamNodeArray -> function that returns an array/cursor of downstream node ids
    // getUpstreamNodeArray -> function that return an array/cursor of upstream node ids
    // runner -> function to run for each node
    // downstreamTtl -> how far to follow graph along arrows
    // upstreamTtl -> how far to follow graph against arrows
    // sideBranches -> if related branches at the same level should be traversed

    let count = 0;
    visited.push(id);
    // outgoings
    if (downstreamTtl > 0) {
        getDownstreamNodeArray(id)
            ?.forEach(downstreamId => {
                if (!visited.includes(downstreamId)) {
                    count += walkTree(downstreamId, getDownstreamNodeArray, getUpstreamNodeArray, runner,
                        downstreamTtl - 1, sideBranches ? upstreamTtl + 1 : upstreamTtl,
                        sideBranches, visited, false, id);
                }
            });
    }
    //incomings
    if (upstreamTtl > 0) {
        getUpstreamNodeArray(id)
            ?.forEach(upstreamId => {
                if (!visited.includes(upstreamId)) {
                    count += walkTree(upstreamId, getDownstreamNodeArray, getUpstreamNodeArray, runner,
                        sideBranches ? downstreamTtl + 1 : downstreamTtl, upstreamTtl - 1,
                        sideBranches, visited, false, id);
                }
            });
    }
    runner(id, initial, count, downstreamTtl, upstreamTtl, lastId);
    return count + 1;
};

export const walkTreeWithData = (id, getDownstreamNodeArray, getUpstreamNodeArray, runner, downstreamTtl = 128,
                                 upstreamTtl = 128, sideBranches = true, visited = [],
                                 initial = true, lastId = null, data = {}) => {
    // getDownstreamNodeArray -> function that returns an array/cursor of downstream node ids
    // getUpstreamNodeArray -> function that return an array/cursor of upstream node ids
    // runner -> function to run for each node
    // downstreamTtl -> how far to follow graph along arrows
    // upstreamTtl -> how far to follow graph against arrows
    // sideBranches -> if related branches at the same level should be traversed

    const newData = runner(id, initial, data, downstreamTtl, upstreamTtl, lastId);
    visited.push(id);
    // outgoings
    if (downstreamTtl > 0) {
        getDownstreamNodeArray(id)
            ?.forEach(downstreamId => {
                if (!visited.includes(downstreamId)) {
                    walkTreeWithData(downstreamId, getDownstreamNodeArray, getUpstreamNodeArray, runner,
                        downstreamTtl - 1, sideBranches ? upstreamTtl + 1 : upstreamTtl,
                        sideBranches, visited, false, id, newData);
                }
            });
    }
    //incomings
    if (upstreamTtl > 0) {
        getUpstreamNodeArray(id)
            ?.forEach(upstreamId => {
                if (!visited.includes(upstreamId)) {
                    walkTreeWithData(upstreamId, getDownstreamNodeArray, getUpstreamNodeArray, runner,
                        sideBranches ? downstreamTtl + 1 : downstreamTtl, upstreamTtl - 1,
                        sideBranches, visited, false, id, newData);
                }
            });
    }
};

export const getPutIntoObjects = (objectId) => {
    const objects = new Set();
    walkTree(objectId, id =>
            Connections
                .find({sourceId: id, type: 'putInto'})
                .map(el => el.destinationId),
        id =>
            Connections
                .find({destinationId: id, type: 'putInto'})
                .map(el => el.sourceId),
        (el, initial, count) => {
            if (!initial) {
                objects.add(Things.findOne(el));
            }
        }, 0, undefined, false);
    return objects;
}

export const getTypeInstances = (objectId) => {
    const objects = new Set();
    walkTree(objectId, id =>
            Connections
                .find({sourceId: id, type: 'instanceOf'})
                .map(el => el.destinationId),
        id =>
            Connections
                .find({destinationId: id, type: 'instanceOf'})
                .map(el => el.sourceId),
        (el, initial, count) => {
            if (!initial) {
                objects.add(Things.findOne(el));
            }
        }, 0, undefined, false);
    return objects;
}

export const getTypePrototypes = (objectId) => {
    const objects = new Set();
    walkTree(objectId, id =>
            Connections
                .find({sourceId: id, type: 'prototype'})
                .map(el => el.destinationId),
        id =>
            Connections
                .find({destinationId: id, type: 'prototype'})
                .map(el => el.sourceId),
        (el, initial, count) => {
            if (!initial) {
                objects.add(Things.findOne(el));
            }
        }, 1, 0, false);
    return objects;
}

export const getAllConnectedUpstream = (objectId) => {
    const object = Things.findOne(objectId);
    const selectorRepresentative = new Set();
    walkTree(objectId, id =>
            Connections
                .find({sourceId: id, type: 'prototype'})
                .map(el => el.destinationId),
        id =>
            Connections
                .find({destinationId: id, type: 'prototype'})
                .map(el => el.sourceId),
        (el, initial, count) => {
            if (!initial) {
                selectorRepresentative.add(Things.findOne(el));
            }
        }, undefined, 0, false);
    const upStream = new Set();
    walkTree(objectId, id =>
            Connections
                .find({sourceId: id})
                .map(el => el.destinationId),
        id =>
            Connections
                .find({destinationId: id})
                .map(el => el.sourceId),
        (el, initial, count) => {
            if (!initial) {
                upStream.add(Things.findOne(el));
            }
        }, 0, undefined, false);
    return [...object.attributes.map(el => getAttributeValueObject(el.attributeId)?._id),
        ...(Array.from(selectorRepresentative).map(el => el._id)),
        ...(Array.from(upStream).map(el => el._id)),
        ...(Array.from(upStream)).flatMap(el =>
            el.attributes.map(el => getAttributeValueObject(el.attributeId)?._id)
        )];
}

export const getSourceObject = (objectId) => {
    const objects = new Set();
    walkTree(objectId, id =>
            Connections
                .find({sourceId: id, group: 'prototype'})
                .map(el => el.destinationId),
        id =>
            Connections
                .find({destinationId: id, group: 'prototype'})
                .map(el => el.sourceId),
        (el, initial, count) => {
            if (!initial) {
                objects.add(Things.findOne(el));
            }
        }, 0, undefined, false);
    if (objects.size > 0) {
        return (Array.from(objects))[0];
    }
}

export const getSourceObjectConnectedTypeIds = (objectId) => {
    const objects = new Set();
    walkTree(objectId, id =>
            Connections
                .find({sourceId: id, group: 'prototype'})
                .map(el => el.destinationId),
        id =>
            Connections
                .find({destinationId: id, group: 'prototype'})
                .map(el => el.sourceId),
        (el, initial, count) => {
            if (!initial) {
                objects.add(Things.findOne(el));
            }
        }, 0, undefined, false);
    if (objects.size > 0) {
        const sourceObject = (Array.from(objects))[0];
        return Object.keys(sourceObject?.inConnections?.putInto ?? {});
    }
}

export const getDirectInstances = (objectId) => {
    const objects = new Set();
    walkTree(objectId, id =>
            Connections
                .find({sourceId: id, type: 'instanceOf'})
                .map(el => el.destinationId),
        id =>
            Connections
                .find({destinationId: id, type: 'instanceOf'})
                .map(el => el.sourceId),
        (el, initial, count) => {
            if (!initial) {
                objects.add(Things.findOne(el));
            }
        }, 0, 1, false);
    return objects;
}

export const getDirectPutIntoObjects = (objectId) => {
    const objects = new Set();
    walkTree(objectId, id =>
            Connections
                .find({sourceId: id, type: 'putInto'})
                .map(el => el.destinationId),
        id =>
            Connections
                .find({destinationId: id, type: 'putInto'})
                .map(el => el.sourceId),
        (el, initial, count) => {
            if (!initial) {
                objects.add(Things.findOne(el));
            }
        }, 0, 1, false);
    return objects;
}

export const getTypeInstancesOf = (objectId) => {
    const objects = new Set();
    walkTree(objectId, id =>
            Connections
                .find({sourceId: id, type: 'instanceOf'})
                .map(el => el.destinationId),
        id =>
            Connections
                .find({destinationId: id, type: 'instanceOf'})
                .map(el => el.sourceId),
        (el, initial, count) => {
            if (!initial) {
                objects.add(Things.findOne(el));
            }
        }, undefined, 0, false);
    return objects;
}

export const getAttributeValue = (attributeId) => {
    const chain = [];
    if (attributeId) {
        walkTree(attributeId, id =>
                Connections
                    .find({sourceId: id})
                    .map(el => el.destinationId),
            id =>
                Connections
                    .find({destinationId: id})
                    .map(el => el.sourceId),
            (el, initial, count) => {
                if (!initial) {
                    chain.push(Things.findOne(el));
                }
            }, 0, 1, false);
    }
    if (chain.length === 1 && ['value', 'text'].includes(chain[0].type)) {
        return chain[0].value;
    }
    return null;
}

export const getAttributeValueObject = (attributeId) => {
    const chain = [];
    if (attributeId) {
        walkTree(attributeId, id =>
                Connections
                    .find({sourceId: id})
                    .map(el => el.destinationId),
            id =>
                Connections
                    .find({destinationId: id})
                    .map(el => el.sourceId),
            (el, initial, count) => {
                if (!initial) {
                    chain.push(Things.findOne(el));
                }
            }, 0, 1, false);
    }
    if (chain.length === 1 && ['value', 'text'].includes(chain[0].type)) {
        return chain[0];
    }
    return null;
}

export const getAttributeReducers = (attributeId) => {
    const reducers = [];
    walkTree(attributeId, id =>
            Connections
                .find({sourceId: id})
                .map(el => el.destinationId),
        id =>
            Connections
                .find({destinationId: id})
                .map(el => el.sourceId),
        (el, initial, count) => {
            if (!initial) {
                reducers.push(Things.findOne(el));
            }
        }, 1, 0, false);
    return reducers;
}

export const getAttributeByReducerId = (reducerId) => {
    const objects = [];
    walkTree(reducerId, id =>
            Connections
                .find({sourceId: id})
                .map(el => el.destinationId),
        id =>
            Connections
                .find({destinationId: id})
                .map(el => el.sourceId),
        (el, initial, count) => {
            if (!initial) {
                const attributeThing = Things.findOne({'attributes.attributeId': el}) ??
                    Things.findOne({'pickedAttributes.attributeId': el});
                objects.push([el, attributeThing]);
            }
        }, 0, 1, false);
    if (objects.length === 1) {
        const attribute = objects[0][1]?.attributes?.filter(el => el.attributeId === objects[0][0]) ??
            objects[0][1]?.pickedAttributes?.filter(el => el.attributeId === objects[0][0]);
        if (attribute?.length) {
            return [attribute[0], objects[0][1]];
        }
    }
    return null;
}

export const getAttributeById = (attributeId) => {
    const attributeThing = Things.findOne({'attributes.attributeId': attributeId}) ??
        Things.findOne({'attributes.parentAttributeId': attributeId});
    if (attributeThing) {
        const attribute = attributeThing?.attributes?.filter(el => el.attributeId === attributeId);
        if (attribute.length) {
            return [attribute[0], attributeThing];
        }
        const parentAttribute = attributeThing?.attributes?.filter(el => el.parentAttributeId === attributeId);
        if (parentAttribute.length) {
            return [parentAttribute[0], attributeThing];
        }
    }
    return null;
}

export const getConstraintsOriginators = () => {
    const logical = Things.find({
        $or: [
            {type: 'icon', icon: 'greaterThan'},
            {type: 'icon', icon: 'greaterThanEqual'},
            {type: 'icon', icon: 'lessThan'},
            {type: 'icon', icon: 'lessThanEqual'},
            {type: 'icon', icon: 'equals'},
            {type: 'icon', icon: 'notEqual'},
            {type: 'icon', icon: 'and'},
            {type: 'icon', icon: 'or'},
            {type: 'icon', icon: 'xor'},
            {type: 'icon', icon: 'not'},
            {type: 'icon', icon: 'implication'},
            {type: 'icon', icon: 'maximise'},
            {type: 'icon', icon: 'minimise'},
            {type: 'icon', icon: 'allDiff'}

        ]
    }).fetch();
    return logical.filter(el => !el.outConnections);
}

export const getReducers = () => {
    const reducers = Things.find({
        $or: [
            {type: 'icon', icon: 'sum'},
            {type: 'icon', icon: 'max'},
            {type: 'icon', icon: 'min'},
            {type: 'icon', icon: 'count'},
            {type: 'icon', icon: 'avg'},
            {type: 'icon', icon: 'spread'}
        ]
    }).fetch();
    return reducers;
}

export const getCalculatedValues = () => {
    const valueConnectors = Connections.find({type: 'modifier'}).fetch();
    const valueOriginators = [];
    valueConnectors.forEach(el => {
        const sourceObj = Things.findOne(el.sourceId);
        const destinationObj = Things.findOne({'attributes.attributeId': el.destinationId});
        if (sourceObj?.type === 'icon' && destinationObj) {
            valueOriginators.push([el, sourceObj, destinationObj]);
        }
    });
    return valueOriginators;
}

export const getSelectors = () => {
    const selectors = Things.find({
        type: 'selector'
    }).fetch();
    return selectors;
}

export const getConstraintParts = (objectId) => {
    //getLeftOp
    const leftLink = Connections.findOne({destinationId: objectId, destinationPosition: 0});
    const leftObject = leftLink ? Things.findOne(leftLink.sourceId) ?? {_id: leftLink.sourceId} : null;

    //getRightOp
    const rightLink = Connections.findOne({destinationId: objectId, destinationPosition: 1});
    const rightObject = rightLink ? Things.findOne(rightLink.sourceId) ?? {_id: rightLink.sourceId} : null;
    return [leftObject, rightObject];
}

export const getRelationshipRelated = (objectId) => {
    const link = Connections.findOne({destinationId: objectId, destinationPosition: 0});
    const linkedObject = link ? Things.findOne(link.sourceId) ?? {_id: link.sourceId} : null;
    if (linkedObject?.type === 'representative') {
        const selectorId = Object.keys(linkedObject?.inConnections?.representative ?? {})[0] ?? '';
        const selectorObject = selectorId ? Things.findOne(selectorId) ?? {_id: selectorId} : null;
        return selectorObject;
    }
    return linkedObject;
}

export const connectionWillBeLoop = (sourceId, destinationId) => {
    const chain = [];
    walkTree(destinationId, id =>
            Connections
                .find({sourceId: id})
                .map(el => el.destinationId),
        id =>
            Connections
                .find({destinationId: id})
                .map(el => el.sourceId),
        (el, initial, count) => {
            if (!initial) {
                chain.push(el);
            }
        }, undefined, 0, false);
    return chain.includes(sourceId) || sourceId === destinationId;
}

export const getReducerAttributeMap = (reducers) => {
    const reducerMap = {};
    reducers.forEach((r) => {
        const attribute = getAttributeByReducerId(r);
        const reducerObj = Things.findOne(r);
        if (reducerMap[attribute[1]._id]) {
            reducerMap[attribute[1]._id].push([reducerObj, attribute[0]]);
        } else {
            reducerMap[attribute[1]._id] = [[reducerObj, attribute[0]]];
        }
    });
    return reducerMap;
}

export const hasPutIntos = (objectId) => {
    return Connections.find({destinationId: objectId, type: 'putInto'}).count() > 0;
}

export const hasInstances = (objectId) => {
    return Connections.find({destinationId: objectId, type: 'instanceOf'}).count() > 0;
}

const updateAmountFromDirectInstances = (object) => {
    const directlyConnectedInstances = getDirectInstances(object._id);
    let count = 0;
    directlyConnectedInstances.forEach(el => {
        if (el.type.includes('type')) {
            count += el.typeAttributes.amount;
        } else {
            count++;
        }
    });
    if (object.typeAttributes.amount < count) {
        Things.update(
            {
                _id: object._id
            },
            {
                $set: {
                    updateTime: new Date(),
                    [`typeAttributes.amount`]: count
                }
            });
    }
}

export const updateConnectedAmountMinimums = (objectId) => {
    const instancesBelow = getTypeInstances(objectId);
    instancesBelow.forEach((el) => {
        if (el.type.includes('type')) {
            updateAmountFromDirectInstances(el);
        }
    });
    const object = Things.findOne(objectId);
    updateAmountFromDirectInstances(object);
    const instancesAbove = getTypeInstancesOf(objectId);
    (Array.from(instancesAbove)).reverse().forEach((el) => {
        if (el.type.includes('type')) {
            updateAmountFromDirectInstances(el);
        }
    });
}

export const propagateAttributes = (sourceId, destinationId = '') => {
    const sourceObject = Things.findOne(sourceId);
    const destinationObject = Things.findOne(destinationId);

    const sourceObjMap = {};

    const sourceAttributesToCopy = sourceObject.attributes;
    const sourceAttributesToCopyParentIds = sourceAttributesToCopy.map(el => el.parentAttributeId);

    const initialLink = Connections.findOne({sourceId: sourceId, destinationId: destinationId});
    const parentType = Object.keys(sourceObject?.outConnections?.instanceOf ?? {})
        .filter(o => Things.findOne(o)?.type?.includes('type'));

    sourceAttributesToCopy.forEach(el => {
        if (el.initial && (initialLink?.type === 'instanceOf' || parentType.length)) {
            const existingSourceFiltered = el.sourceObj.filter(el => el !== sourceId &&
                el !== destinationId && el !== parentType?.[0]);
            sourceObjMap[el.parentAttributeId] = destinationId ?
                [destinationId, ...existingSourceFiltered] : [parentType[0], ...existingSourceFiltered]
        }
    });
    const destinationAttributesToCopy = destinationObject?.attributes
        .filter(el => initialLink.type === 'instanceOf' || !el.initial)
        .filter(el => !sourceAttributesToCopyParentIds.includes(el.parentAttributeId))
        .map((el, index) => ({
            ...el,
            attributeId: Random.id(),
            initial: initialLink?.type === 'instanceOf' ? el.initial : Object.keys(destinationObject?.inConnections
                ?.putInto ?? {})?.filter(x => el.sourceObj.includes(x))?.length
        })) ?? [];

    destinationAttributesToCopy.forEach(el => {
        if (initialLink?.type === 'putInto' && el.initial) {
            sourceObjMap[el.parentAttributeId] = [...el.sourceObj, sourceId]
        }
    });

    const propagate = walkTree(sourceId,
        id =>
            Connections
                .find({$and: [{sourceId: id}, {$or: [{type: 'putInto'}, {type: 'instanceOf'}]}]})
                .map(el => el.destinationId),
        id =>
            Connections
                .find({$and: [{destinationId: id}, {$or: [{type: 'putInto'}, {type: 'instanceOf'}]}]})
                .map(el => el.sourceId),
        (el, initial, count, downstream, upstream, lastId) => {
            if (initial) {
                Things.update({_id: el}, {
                    $set: {
                        updateTime: new Date(),
                    },
                    $push: {
                        attributes: {
                            $each: destinationAttributesToCopy
                        }
                    }
                });

                if (Object.keys(sourceObject?.inConnections?.instanceOf ?? {})?.length) {
                    Object.keys(sourceObject?.inConnections?.instanceOf ?? {})?.forEach(el1 => {
                        Things.update({_id: el1}, {
                            $set: {
                                updateTime: new Date(),
                            },
                            $push: {
                                attributes: {
                                    $each: destinationAttributesToCopy
                                }
                            }
                        });
                    });
                }
            } else {
                const updateObject = Things.findOne(el);
                const lastObject = Things.findOne(lastId);
                const updateObjectAttributeParentIds = updateObject?.attributes
                    ?.map(el => el.parentAttributeId) ?? [];

                const link = Connections.findOne({sourceId: lastId, destinationId: el}) ??
                    Connections.findOne({sourceId: el, destinationId: lastId});

                if (!(upstream === 0 && (initialLink?.type === 'instanceOf' || parentType.length))) {
                    const sourceAttributesToCopyFiltered = sourceAttributesToCopy.filter(el =>
                        !updateObjectAttributeParentIds.includes(el.parentAttributeId)).map(el => ({
                        ...el,
                        attributeId: Random.id(),
                        initial: link?.type === 'putInto' && upstream === 0 ||
                            link?.type === 'putInto' && (initialLink?.type === 'instanceOf' || parentType.length) &&
                            upstream === 1 ||
                            link?.type === 'instanceOf' &&
                            !!lastObject?.attributes.find(a => a.parentAttributeId === el.parentAttributeId)?.initial
                    }));

                    sourceAttributesToCopyFiltered.forEach(a => {
                        if (a.initial && link?.type === 'putInto' && !a.sourceObj.includes(el)) {
                            sourceObjMap[a.parentAttributeId] = sourceObjMap[a.parentAttributeId]?.length ?
                                [...sourceObjMap[a.parentAttributeId], el] : [...a.sourceObj, el]
                        }
                    });

                    Things.update({_id: el}, {
                        $set: {
                            updateTime: new Date(),
                        },
                        $push: {
                            attributes: {
                                $each: sourceAttributesToCopyFiltered
                            }
                        }
                    });

                    if (upstream <= 1 && Object.keys(updateObject?.inConnections?.instanceOf ?? {})?.length) {
                        Object.keys(updateObject?.inConnections?.instanceOf ?? {})?.forEach(el1 => {
                            if (el1 === sourceObject._id) return;
                            const updateSubObject = Things.findOne(el1);
                            const updateSubObjectAttributeParentIds = updateSubObject?.attributes
                                ?.map(el => el.parentAttributeId) ?? [];
                            Things.update({_id: el1}, {
                                $set: {
                                    updateTime: new Date(),
                                },
                                $push: {
                                    attributes: {
                                        $each: sourceAttributesToCopyFiltered.filter(el =>
                                            !updateSubObjectAttributeParentIds.includes(el.parentAttributeId))
                                            .map((el, index) => ({
                                                ...el,
                                                attributeId: Random.id(),
                                            }))
                                    }
                                }
                            });
                        });
                    }
                }
            }
        }, undefined, 0);

    Object.entries(sourceObjMap).forEach(([key, value]) => {
        Things.update({
            'attributes.parentAttributeId': key
        }, {
            $set: {
                'attributes.$.sourceObj': value
            }
        }, {multi: true});
    });
}

export const getObjectOnPosition = (positionAttributeId) => {
    const objects = new Set();
    walkTree(positionAttributeId, id =>
            Connections
                .find({sourceId: id})
                .map(el => el.destinationId),
        id =>
            Connections
                .find({destinationId: id})
                .map(el => el.sourceId),
        (el, initial, count) => {
            if (!initial) {
                objects.add(Things.findOne(el));
            }
        }, 0, 1, false);
    return objects;
}

