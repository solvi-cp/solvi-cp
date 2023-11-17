import React, {useState, useMemo, useRef, useEffect, useCallback, useLayoutEffect} from 'react';
import {Slate, Editable, ReactEditor, withReact, useSlate} from 'slate-react';
import {Editor, Transforms, Text, createEditor, Node, Range} from 'slate';
import {css} from '@emotion/css';
import {withHistory} from 'slate-history';

import {Button, Icon, Menu, Portal} from '../components/text/Components';
import {
    getAttributeByReducerId,
    getAttributeValue, getAttributeValueObject, getConstraintParts, getConstraintsOriginators,
    getDirectInstances, getDirectPutIntoObjects, getReducers, getRelationshipByReducerId, getRelationshipRelated,
    getSourceObject,
    getSourceObjectConnectedTypeIds,
    walkTree
} from "../../utils/api";

import {changeAttributeName, changeType, changeTypeAttribute, changeValue} from "../../api/things/methods";

import i18n from 'meteor/universe:i18n';
import {Things} from "../../api/things/collection";

const andJoin = array => array.reduce((acc, cur, index, array) => {
    if (index < array.length - 2) {
        return acc + ', ' + cur;
    } else {
        return acc + ' and ' + cur;
    }
});

const boundText = (lower, upper) => {
    if (lower < 0 || (upper >= 0 && lower > upper)) {
        return [
            {text: 'invalid', context: true}
        ]
    } else if (lower >= 0 && upper >= 0 && lower === upper) {
        return [
            {text: 'exactly ', context: true},
            {text: lower.toString(), context: true}
        ]
    } else if (lower > 0 && upper < 0) {
        return [
            {text: 'at least ', context: true},
            {text: lower.toString(), context: true}
        ]
    } else if (lower === 0 && upper > 0) {
        return [
            {text: 'at most ', context: true},
            {text: upper.toString(), context: true}
        ]
    } else if (lower === 0 && upper < 0) {
        return [
            {text: 'any number of', context: true}
        ]
    } else {
        return [
            {text: 'between ', context: true},
            {text: lower.toString(), context: true},
            {text: ' and ', context: true},
            {text: upper.toString(), context: true}
        ]
    }
}

export const operatorReversal = (text) => {
    switch (text) {
        case 'greaterThan':
            return 'lessThan';
        case 'greaterThanEqual':
            return 'lessThanEqual';
        case 'lessThan':
            return 'greaterThan';
        case 'lessThanEqual':
            return 'greaterThanEqual';
        case 'equals':
            return 'equals';
        case 'notEqual':
            return 'notEqual';
        case 'and':
            return 'and';
        case 'or':
            return 'or';
        case 'not':
            return 'not';
        default:
            return undefined;
    }
}

export const mathText = (text) => {
    switch (text) {
        case 'plus':
            return 'plus';
        case 'minus':
            return 'minus';
        case 'times':
            return 'multiplied by';
        case 'divide':
            return 'divided by';
        case 'greaterThan':
            return 'greater than';
        case 'greaterThanEqual':
            return 'greater than or equal to';
        case 'lessThan':
            return 'less than';
        case 'lessThanEqual':
            return 'less than or equal to';
        case 'equals':
            return 'equal to';
        case 'notEqual':
            return 'not equal to';
        case 'and':
            return 'and';
        case 'or':
            return 'or';
        case 'not':
            return 'not';
        case 'implication':
            return 'implies';
        case 'maximise':
            return 'maximised';
        case 'minimise':
            return 'minimised';
        case 'sum':
            return 'sum';
        case 'max':
            return 'maximum';
        case 'min':
            return 'minimum';
        case 'count':
            return 'count';
        case 'allDiff':
            return 'all different';
        default:
            return text;
    }
}

const getAttributeSources = sources => sources.map(el => {
    const obj = Things.findOne(el);
    return obj?.typeAttributes?.name;
});

const objectsToEditorText = (things, connections) => {
    const objectsEditorText = [];
    const processedObjects = [];
    const relationshipContainerMap = {};
    const relationshipSelectorMap = {};
    const relationshipRepresentativeMap = {};
    things.filter(el => el.type === 'object_type').forEach(el => {
        const currentText = [];
        currentText.push(
            {text: 'There is a '},
            {text: i18n.__('types.' + el.type), context: true, editable: true, id: el._id, idType: 'type'},
            {text: ' named '},
            {
                text: el.typeAttributes.name, context: true, editable: true, id: el._id, idType: 'typeAttribute',
                key: 'name'
            },
            {text: '.'}
        );

        el.attributes.filter(el => el.initial).forEach(attribute => {
            const childText = [
                {text: '\n'},
                {text: 'It has an attribute '},
                {text: attribute.key.toString(), context: true, editable: true, id: attribute._id, idType: 'attribute'}
            ]

            const sourceNames = getAttributeSources(attribute.sourceObj);

            if (sourceNames.filter(e => e).length > 0) {
                childText.push(
                    {text: ' from '},
                    {text: andJoin(sourceNames), context: true});
            }

            const attributeValue = getAttributeValueObject(attribute.attributeId);

            if (attributeValue) {
                childText.push(
                    {text: ' with the value of '},
                    {
                        text: attributeValue.value.toString() + '', context: true, editable: true,
                        id: attributeValue._id, idType: 'value'
                    });
            }

            childText.push({text: '.'});
            currentText.push(...childText);
        });

        const instanceObjects = getDirectInstances(el._id);

        if (instanceObjects.size) {
            currentText.push(
                {text: '\n'},
                {text: 'There are '},
                {
                    text: el.typeAttributes.amount.toString(),
                    context: true,
                    editable: true,
                    id: el._id,
                    idType: 'typeAttributes',
                    key: 'amount'
                },
                {text: ' object instances in '},
                {text: el.typeAttributes.name, context: true},
                {text: '.'}
            );
        }

        objectsEditorText.push({
            type: 'paragraph',
            id: el._id,
            children: currentText
        });

        if (instanceObjects.size) {
            instanceObjects.forEach(e => {
                const currentText = [];
                processedObjects.push(e._id);
                currentText.push(
                    {text: 'There is a '},
                    {text: i18n.__('types.' + e.type), context: true, editable: true, id: e._id, idType: 'type'},
                    {text: ' named '},
                    {
                        text: e.typeAttributes.name, context: true, editable: true, id: e._id, idType: 'typeAttribute',
                        key: 'name'
                    },
                    {text: ' in '},
                    {text: el.typeAttributes.name, context: true},
                    {text: '.'}
                );

                e.attributes.filter(ea => ea.initial).forEach(eattribute => {
                    const childText = [
                        {text: '\n'},
                        {text: 'It has an attribute '},
                        {
                            text: eattribute.key.toString(), context: true, editable: true, id: eattribute._id,
                            idType: 'attribute'
                        },
                    ]

                    const sourceNames = getAttributeSources(eattribute.sourceObj);

                    if (sourceNames.filter(e => e).length > 0) {
                        childText.push(
                            {text: ' from '},
                            {text: andJoin(sourceNames), context: true});
                    }

                    const attributeValue = getAttributeValueObject(eattribute.attributeId);

                    if (attributeValue) {
                        childText.push(
                            {text: ' with the value of '},
                            {
                                text: attributeValue.value.toString() + '', context: true, editable: true,
                                id: attributeValue._id, idType: 'value'
                            },
                        )
                    }

                    childText.push({text: '.'});
                    currentText.push(...childText);
                });

                objectsEditorText.push({
                    type: 'paragraph',
                    id: e._id,
                    children: currentText
                });
            });
        }
    });

    things.filter(el => el.type === 'object' && !processedObjects.includes(el._id)).forEach(el => {
        const currentText = [];
        currentText.push(
            {text: 'There is a '},
            {text: i18n.__('types.' + el.type), context: true, editable: true, id: el._id, idType: 'type'},
            {text: ' named '},
            {
                text: el.typeAttributes.name, context: true, editable: true, id: el._id, idType: 'typeAttribute',
                key: 'name'
            },
            {text: '.'}
        );

        el.attributes.filter(el => el.initial).forEach(attribute => {
            const childText = [
                {text: '\n'},
                {text: 'It has an attribute '},
                {text: attribute.key.toString(), context: true, editable: true, id: attribute._id, idType: 'attribute'}
            ]

            const sourceNames = getAttributeSources(attribute.sourceObj);

            if (sourceNames.filter(e => e).length > 0) {
                childText.push(
                    {text: ' from '},
                    {text: andJoin(sourceNames), context: true});
            }

            const attributeValue = getAttributeValueObject(attribute.attributeId);

            if (attributeValue) {
                childText.push(
                    {text: ' with the value of '},
                    {
                        text: attributeValue.value.toString() + '', context: true, editable: true,
                        id: attributeValue._id, idType: 'value'
                    },
                )
            }

            childText.push({text: '.'});

            currentText.push(...childText);
        });

        objectsEditorText.push({
            type: 'paragraph',
            id: el._id,
            children: currentText
        });
    });

    const processedContainers = [];
    things.filter(el => el.type === 'container_type').forEach(el => {

        const countOrigin = [];
        const countOriginDefault = [i18n.__(`selector.contained`)];
        let ordered = false;

        if (el.type === 'container_type') {
            countOrigin.push(el.typeAttributes.name);
        } else {
            ordered = el.typeAttributes?.ordered;
        }
        const sourceConnectedTypeIds = [...getDirectPutIntoObjects(el._id)];
        if (sourceConnectedTypeIds.length === 1) {
            const sourceConnectedType = sourceConnectedTypeIds?.[0];
            countOrigin.push(sourceConnectedType?.typeAttributes?.name);
        } else {
            countOrigin.push(...countOriginDefault);
        }

        const relationshipCount = countOrigin.length ? countOrigin : countOriginDefault

        el.pickedRelationships.forEach(e => {
            if (e.relationshipAttribute) {
                const relationshipTextInitial = () => [
                    {text: 'On '},
                    {text: i18n.__('types.' + el.type), context: true},
                    {text: ' '},
                    {text: el.typeAttributes.name, context: true},
                    {text: ','},
                ]
                if (e.relationshipAttribute === 'count0') {
                    relationshipContainerMap[e.relationshipAttributeId] = [
                        ...relationshipTextInitial(),
                        {text: ' the count of '},
                        {text: relationshipCount[0], context: true},
                        {text: ' is'},
                    ]
                } else if (e.relationshipAttribute === 'count1') {
                    relationshipContainerMap[e.relationshipAttributeId] = [
                        ...relationshipTextInitial(),
                        {text: ' the count of '},
                        {text: relationshipCount[1], context: true},
                        {text: ' is'},
                    ]
                } else if (e.relationshipAttribute === 'contains') {
                    relationshipContainerMap[e.relationshipAttributeId] = (other, negative) => [
                        ...relationshipTextInitial().slice(1),
                        {text: negative ? ' does not contain ' : ' contains '},
                        ...other,
                        ...boundText(e.relationshipAttributeRange[0], e.relationshipAttributeRange[1]),
                        {text: ' times'},
                    ]
                } else if (e.relationshipAttribute === 'contains_all') {
                    relationshipContainerMap[e.relationshipAttributeId] = (other, negative) => [
                        ...relationshipTextInitial().slice(1),
                        {text: negative ? ' does not contain all of' : ' contains all of'},
                        ...other
                    ]
                } else if (e.relationshipAttribute === 'first' || e.relationshipAttribute === 'last') {
                    relationshipContainerMap[e.relationshipAttributeId] = (other, negative) => [
                        ...relationshipTextInitial(),
                        {text: ' the '},
                        {text: e.relationshipAttribute, context: true},
                        {text: negative ? ' item is not' : ' item is'},
                        ...other
                    ]
                } else {
                    let linkedItem = getRelationshipRelated(e.relationshipAttributeId);
                    if (linkedItem?.type === 'representative') {
                        linkedItem = Things.findOne(Object.keys(
                            linkedItem.inConnections?.representative ?? {})?.[0] ?? '');
                    }
                    if (e.relationshipAttribute === 'before' || e.relationshipAttribute === 'after') {
                        relationshipContainerMap[e.relationshipAttributeId] = (other, negative) => [
                            ...relationshipTextInitial(),
                            {text: ' the item '},
                            {text: linkedItem?.typeAttributes?.name ?? '', context: true},
                            {text: negative ? ' is not ' : ' is '},
                            {text: e.relationshipAttribute, context: true},
                            {text: ' the item'},
                            ...other
                        ]
                    } else {
                        relationshipContainerMap[e.relationshipAttributeId] = (other, negative) => [
                            ...relationshipTextInitial(),
                            {text: ' the item '},
                            {text: linkedItem?.typeAttributes?.name ?? '', context: true},
                            {text: negative ? ' is not ' : ' is '},
                            {text: e.relationshipAttribute, context: true},
                            {text: ' to the item '},
                            ...other
                        ]
                    }
                }
            }
        });

        const currentText = [];
        currentText.push(
            {text: 'There is a '},
            {text: i18n.__('types.' + el.type), context: true, editable: true, id: el._id, idType: 'type'},
            {text: ' named '},
            {
                text: el.typeAttributes.name, context: true, editable: true, id: el._id, idType: 'typeAttribute',
                key: 'name'
            },
            {text: '.'}
        );

        const orderText = [
            {text: '\n'},
            {text: 'It is '},
            {text: el.typeAttributes.ordered ? 'ordered' : 'not ordered', context: true},
        ];

        if (el.typeAttributes.ordered) {
            orderText.push({text: ' and '});
            orderText.push(
                {text: el.typeAttributes.circular ? 'circular' : 'not circular', context: true});
        }

        orderText.push({text: '.'});

        currentText.push(...orderText);

        const repeatedLevels = el.repeatedLevels;

        const levelsTree = [];
        const queue = [el];
        let level = 0;
        let first = null;

        while (queue.length) {
            // console.log(queue)
            const current = queue.shift();
            if (current === first) {
                level++;
                first = null;
            }

            if (!levelsTree[level]?.some(el => el._id === current._id)) {
                levelsTree[level] = [...(levelsTree[level] ?? []), current];
            }

            if (current?.inConnections?.putInto) {
                const nextObjects = Object.keys(current?.inConnections?.putInto ?? {}).map(el => Things.findOne(el));
                queue.push(...nextObjects);
                if (nextObjects.length && first === null) {
                    first = nextObjects[0];
                }
            }
        }

        levelsTree.shift();

        currentText.push(
            {text: '\n'},
            {text: 'It can hold '},
            ...boundText(el.typeAttributes.capacity[0], el.typeAttributes.capacity[1]),
            {text: ' things and the items '},
            {
                text: el.typeAttributes.typeRepeated ? 'can be repeated' : 'cannot be repeated',
                context: true
            },
            {text: ' in the container group.'}
        );

        levelsTree.reverse()
            .forEach((levelThings, index) => {
                currentText.push(
                    {text: '\n'},
                    {text: 'Contained items '},
                    {text: andJoin(levelThings.map(el => el.typeAttributes.name))},
                    {
                        text: (repeatedLevels?.[levelsTree.length - index - 1] ?? true) ?
                            ' can be repeated' : ' cannot be repeated'
                    },
                    {text: ' in the container group.'}
                );
            });

        el.attributes.filter(el => el.initial).forEach(attribute => {
            const childText = [
                {text: '\n'},
                {text: 'It has an attribute '},
                {text: attribute.key.toString(), context: true, editable: true, id: attribute._id, idType: 'attribute'}
            ]

            const sourceNames = getAttributeSources(attribute.sourceObj);

            if (sourceNames.length > 0) {
                childText.push(
                    {text: ' from '},
                    {text: andJoin(sourceNames)});
            }

            const attributeValue = getAttributeValueObject(attribute.attributeId);

            if (attributeValue) {
                childText.push(
                    {text: ' with the value of '},
                    {
                        text: attributeValue.value.toString() + '', context: true, editable: true,
                        id: attributeValue._id, idType: 'value'
                    },
                )
            }

            childText.push({text: '.'});

            currentText.push(...childText);
        });


        const instanceContainers = getDirectInstances(el._id);
        if (instanceContainers.size) {
            currentText.push(
                {text: '\n'},
                {text: 'There are '},
                {text: el.typeAttributes.amount.toString(), context: true},
                {text: ' container instances in '},
                {text: el.typeAttributes.name, context: true},
                {text: '.'}
            );
        }

        objectsEditorText.push({
            type: 'paragraph',
            id: el._id,
            children: currentText
        });

        if (instanceContainers.size) {
            instanceContainers.forEach(e => {

                const countOrigin = [];
                const countOriginDefault = [i18n.__(`selector.contained`)];
                let ordered = false;

                if (e.type === 'container_type') {
                    countOrigin.push(e.typeAttributes.name);
                } else {
                    ordered = e.typeAttributes?.ordered;
                }
                const sourceConnectedTypeIds = [...getDirectPutIntoObjects(e._id)];
                if (sourceConnectedTypeIds.length === 1) {
                    const sourceConnectedType = sourceConnectedTypeIds?.[0];
                    countOrigin.push(sourceConnectedType.typeAttributes.name);
                } else {
                    countOrigin.push(...countOriginDefault);
                }

                const relationshipCount = countOrigin.length ? countOrigin : countOriginDefault

                e.pickedRelationships.forEach(e => {
                    if (e.relationshipAttribute) {
                        const relationshipTextInitial = () => [
                            {text: 'On '},
                            {text: i18n.__('types.' + el.type), context: true},
                            {text: ' '},
                            {text: el.typeAttributes.name, context: true},
                            {text: ','},
                        ]

                        if (e.relationshipAttribute === 'count0') {
                            relationshipContainerMap[e.relationshipAttributeId] = [
                                ...relationshipTextInitial(),
                                {text: ' the count of '},
                                {text: relationshipCount[0], context: true},
                                {text: ' is'},
                            ]
                        } else if (e.relationshipAttribute === 'count1') {
                            relationshipContainerMap[e.relationshipAttributeId] = [
                                ...relationshipTextInitial(),
                                {text: ' the count of '},
                                {text: relationshipCount[1], context: true},
                                {text: ' is'},
                            ]
                        } else if (e.relationshipAttribute === 'contains') {
                            relationshipContainerMap[e.relationshipAttributeId] = (other, negative) => [
                                ...relationshipTextInitial().slice(1),
                                {text: negative ? ' does not contain ' : ' contains '},
                                ...other,
                                ...boundText(e.relationshipAttributeRange[0], e.relationshipAttributeRange[1]),
                                {text: ' times'},
                            ]
                        } else if (e.relationshipAttribute === 'contains_all') {
                            relationshipContainerMap[e.relationshipAttributeId] = (other, negative) => [
                                ...relationshipTextInitial().slice(1),
                                {text: negative ? ' does not contain all of' : ' contains all of'},
                                ...other
                            ]
                        } else if (e.relationshipAttribute === 'first' || e.relationshipAttribute === 'last') {
                            relationshipContainerMap[e.relationshipAttributeId] = (other, negative) => [
                                ...relationshipTextInitial(),
                                {text: ' the '},
                                {text: e.relationshipAttribute, context: true},
                                {text: negative ? ' item is not' : ' item is'},
                                ...other
                            ]
                        } else {
                            let linkedItem = getRelationshipRelated(e.relationshipAttributeId);
                            if (linkedItem?.type === 'representative') {
                                linkedItem = Things.findOne(Object.keys(
                                    linkedItem.inConnections?.representative ?? {})?.[0] ?? '');
                            }
                            if (e?.relationshipAttribute === 'before' || e?.relationshipAttribute === 'after') {
                                relationshipContainerMap[e.relationshipAttributeId] = (other, negative) => [
                                    ...relationshipTextInitial(),
                                    {text: ' the item '},
                                    {text: linkedItem?.typeAttributes?.name ?? '', context: true},
                                    {text: negative ? ' is not ' : ' is '},
                                    {text: e.relationshipAttribute, context: true},
                                    {text: ' the item'},
                                    ...other
                                ]
                            } else {
                                relationshipContainerMap[e.relationshipAttributeId] = (other, negative) => [
                                    ...relationshipTextInitial(),
                                    {text: ' the item '},
                                    {text: linkedItem?.typeAttributes?.name ?? '', context: true},
                                    {text: negative ? ' is not ' : ' is '},
                                    {text: e.relationshipAttribute, context: true},
                                    {text: ' to the item '},
                                    ...other
                                ]
                            }
                        }
                    }
                });

                processedContainers.push(e._id);
                const currentText = [];
                currentText.push(
                    {text: 'There is a '},
                    {text: i18n.__('types.' + e.type), context: true, editable: true, id: el._id, idType: 'type'},
                    {text: ' named '},
                    {
                        text: e.typeAttributes.name, context: true, editable: true, id: el._id, idType: 'typeAttribute',
                        key: 'name'
                    },
                    {text: ' in '},
                    {text: el.typeAttributes.name, context: true},
                    {text: '.'}
                );

                const orderText = [
                    {text: '\n'},
                    {text: 'It is '},
                    {text: e.typeAttributes.ordered ? 'ordered' : 'not ordered', context: true},
                ];

                if (e.typeAttributes.ordered) {
                    orderText.push({text: ' and '});
                    orderText.push(
                        {text: e.typeAttributes.circular ? 'circular' : 'not circular', context: true});
                }

                orderText.push({text: '.'});
                currentText.push(...orderText);

                const repeatedLevels = e.repeatedLevels;

                const levelsTree = [];
                const queue = [e];
                let level = 0;
                let first = null;

                while (queue.length) {
                    // console.log(queue)
                    const current = queue.shift();
                    if (current === first) {
                        level++;
                        first = null;
                    }

                    if (!levelsTree[level]?.some(el => el._id === current._id)) {
                        levelsTree[level] = [...(levelsTree[level] ?? []), current];
                    }

                    if (current?.inConnections?.putInto) {
                        const nextObjects = Object.keys(current?.inConnections?.putInto ?? {}).map(el => Things.findOne(el));
                        queue.push(...nextObjects);
                        if (nextObjects.length && first === null) {
                            first = nextObjects[0];
                        }
                    }
                }

                levelsTree.shift();

                currentText.push(
                    {text: '\n'},
                    {text: 'It can hold '},
                    ...boundText(e.typeAttributes.capacity[0], e.typeAttributes.capacity[1]),
                    {text: ' things and the items '},
                    {
                        text: e.typeAttributes.repeated ? 'can be repeated' : 'cannot be repeated',
                        context: true
                    },
                    {text: ' in the container.'}
                );

                levelsTree.reverse()
                    .forEach((levelThings, index) => {
                        currentText.push(
                            {text: '\n'},
                            {text: 'Contained items '},
                            {text: andJoin(levelThings.map(el => el.typeAttributes.name))},
                            {
                                text: (repeatedLevels?.[levelsTree.length - index - 1] ?? true) ?
                                    ' can be repeated' : ' cannot be repeated'
                            },
                            {text: ' in the container.'}
                        );
                    });

                e.attributes.filter(ea => ea.initial).forEach(eattribute => {
                    const childText = [
                        {text: '\n'},
                        {text: 'It has an attribute '},
                        {
                            text: eattribute.key.toString(), context: true, editable: true, id: eattribute._id,
                            idType: 'attribute'
                        }
                    ]

                    const sourceNames = getAttributeSources(eattribute.sourceObj);

                    if (sourceNames.filter(e => e).length > 0) {
                        childText.push(
                            {text: ' from '},
                            {text: andJoin(sourceNames), context: true});
                    }

                    const attributeValue = getAttributeValueObject(eattribute.attributeId);

                    if (attributeValue) {
                        childText.push(
                            {text: ' with the value of '},
                            {
                                text: attributeValue.value.toString() + '', context: true, editable: true,
                                id: attributeValue._id, idType: 'value'
                            },
                        )
                    }

                    childText.push({text: '.'});
                    currentText.push(...childText);
                });

                objectsEditorText.push({
                    type: 'paragraph',
                    id: e._id,
                    children: currentText
                });
            });
        }
    });

    things.filter(el => el.type === 'container' && !processedContainers.includes(el._id)).forEach(el => {

        const countOrigin = [];
        const countOriginDefault = [i18n.__(`selector.contained`)];
        let ordered = false;

        if (el.type === 'container_type') {
            countOrigin.push(el.typeAttributes.name);
        } else {
            ordered = el.typeAttributes?.ordered;
        }
        const sourceConnectedTypeIds = [...getDirectPutIntoObjects(el._id)];
        if (sourceConnectedTypeIds.length === 1) {
            const sourceConnectedType = sourceConnectedTypeIds?.[0];
            countOrigin.push(sourceConnectedType.typeAttributes.name);
        } else {
            countOrigin.push(...countOriginDefault);
        }

        const relationshipCount = countOrigin.length ? countOrigin : countOriginDefault

        el.pickedRelationships.forEach(e => {
            if (e.relationshipAttribute) {
                const relationshipTextInitial = () => [
                    {text: 'On '},
                    {text: i18n.__('types.' + el.type), context: true},
                    {text: ' '},
                    {text: el.typeAttributes.name, context: true},
                    {text: ','},
                ]
                if (e.relationshipAttribute === 'count0') {
                    relationshipContainerMap[e.relationshipAttributeId] = [
                        ...relationshipTextInitial(),
                        {text: ' the count of '},
                        {text: relationshipCount[0], context: true},
                        {text: ' is'},
                    ]
                } else if (e.relationshipAttribute === 'count1') {
                    relationshipContainerMap[e.relationshipAttributeId] = [
                        ...relationshipTextInitial(),
                        {text: ' the count of '},
                        {text: relationshipCount[1], context: true},
                        {text: ' is'},
                    ]
                } else if (e.relationshipAttribute === 'contains') {
                    relationshipContainerMap[e.relationshipAttributeId] = (other, negative) => [
                        ...relationshipTextInitial().slice(1),
                        {text: negative ? ' does not contain ' : ' contains '},
                        ...other,
                        ...boundText(e.relationshipAttributeRange[0], e.relationshipAttributeRange[1]),
                        {text: ' times'},
                    ]
                } else if (e.relationshipAttribute === 'contains_all') {
                    relationshipContainerMap[e.relationshipAttributeId] = (other, negative) => [
                        ...relationshipTextInitial().slice(1),
                        {text: negative ? ' does not contain all of' : ' contains all of'},
                        ...other
                    ]
                } else if (e.relationshipAttribute === 'first' || e.relationshipAttribute === 'last') {
                    relationshipContainerMap[e.relationshipAttributeId] = (other, negative) => [
                        ...relationshipTextInitial(),
                        {text: ' the '},
                        {text: e.relationshipAttribute, context: true},
                        {text: negative ? ' item is not' : ' item is'},
                        ...other
                    ]
                } else {
                    let linkedItem = getRelationshipRelated(e.relationshipAttributeId);
                    if (linkedItem?.type === 'representative') {
                        linkedItem = Things.findOne(Object.keys(
                            linkedItem.inConnections?.representative ?? {})?.[0] ?? '');
                    }
                    if (e.relationshipAttribute === 'before' || e.relationshipAttribute === 'after') {
                        relationshipContainerMap[e.relationshipAttributeId] = (other, negative) => [
                            ...relationshipTextInitial(),
                            {text: ' the item '},
                            {text: linkedItem?.typeAttributes?.name ?? '', context: true},
                            {text: negative ? ' is not ' : ' is '},
                            {text: e.relationshipAttribute, context: true},
                            {text: ' the item'},
                            ...other
                        ]
                    } else {
                        relationshipContainerMap[e.relationshipAttributeId] = (other, negative) => [
                            ...relationshipTextInitial(),
                            {text: ' the item '},
                            {text: linkedItem?.typeAttributes?.name ?? '', context: true},
                            {text: negative ? ' is not ' : ' is '},
                            {text: e.relationshipAttribute, context: true},
                            {text: ' to the item '},
                            ...other
                        ]
                    }
                }
            }
        });

        const currentText = [];
        currentText.push(
            {text: 'There is a '},
            {text: i18n.__('types.' + el.type), context: true, editable: true, id: el._id, idType: 'type'},
            {text: ' named '},
            {
                text: el.typeAttributes.name, context: true, editable: true, id: el._id, idType: 'typeAttribute',
                key: 'name'
            },
            {text: '.'}
        );

        const orderText = [
            {text: '\n'},
            {text: 'It is '},
            {text: el.typeAttributes.ordered ? 'ordered' : 'not ordered', context: true},
        ];

        if (el.typeAttributes.ordered) {
            orderText.push({text: ' and '});
            orderText.push(
                {text: el.typeAttributes.circular ? 'circular' : 'not circular', context: true});
        }

        orderText.push({text: '.'});
        currentText.push(...orderText);

        const repeatedLevels = el.repeatedLevels;

        const levelsTree = [];
        const queue = [el];
        let level = 0;
        let first = null;

        while (queue.length) {
            // console.log(queue)
            const current = queue.shift();
            if (current === first) {
                level++;
                first = null;
            }

            if (!levelsTree[level]?.some(el => el._id === current._id)) {
                levelsTree[level] = [...(levelsTree[level] ?? []), current];
            }

            if (current?.inConnections?.putInto) {
                const nextObjects = Object.keys(current?.inConnections?.putInto ?? {}).map(el => Things.findOne(el));
                queue.push(...nextObjects);
                if (nextObjects.length && first === null) {
                    first = nextObjects[0];
                }
            }
        }

        levelsTree.shift();

        currentText.push(
            {text: '\n'},
            {text: 'It can hold '},
            ...boundText(el.typeAttributes.capacity[0], el.typeAttributes.capacity[1]),
            {text: ' things and the items '},
            {
                text: el.typeAttributes.repeated ? 'can be repeated' : 'cannot be repeated',
                context: true
            },
            {text: ' in the container.'}
        );

        levelsTree.reverse()
            .forEach((levelThings, index) => {
                currentText.push(
                    {text: '\n'},
                    {text: 'Contained items '},
                    {text: andJoin(levelThings.map(el => el.typeAttributes.name))},
                    {
                        text: (repeatedLevels?.[levelsTree.length - index - 1] ?? true) ?
                            ' can be repeated' : ' cannot be repeated'
                    },
                    {text: ' in the container.'}
                );
            });

        el.attributes.filter(el => el.initial).forEach(attribute => {
            const childText = [
                {text: '\n'},
                {text: 'It has an attribute '},
                {text: attribute.key.toString(), context: true, editable: true, id: attribute._id, idType: 'attribute'}
            ]

            const sourceNames = getAttributeSources(attribute.sourceObj);

            if (sourceNames.filter(e => e).length > 0) {
                childText.push(
                    {text: ' from '},
                    {text: andJoin(sourceNames), context: true});
            }

            const attributeValue = getAttributeValueObject(attribute.attributeId);

            if (attributeValue) {
                childText.push(
                    {text: ' with the value of '},
                    {
                        text: attributeValue.value.toString() + '', context: true, editable: true,
                        id: attributeValue._id, idType: 'value'
                    },
                )
            }

            childText.push({text: '.'});
            currentText.push(...childText);
        });

        objectsEditorText.push({
            type: 'paragraph',
            id: el._id,
            children: currentText
        });
    });

    connections.filter(el => el.type === 'putInto').forEach(el => {
        const sourceThing = Things.findOne(el.sourceId);
        const destinationThing = Things.findOne(el.destinationId);
        if (!sourceThing || !destinationThing) return;
        const currentText = [];
        currentText.push(
            {text: 'The '},
            {text: i18n.__('types.' + sourceThing.type), context: true},
            {text: ' named '},
            {text: sourceThing.typeAttributes.name, context: true},
            {text: ' can be put into '},
            {text: i18n.__('types.' + destinationThing.type), context: true},
            {text: ' named '},
            {text: destinationThing.typeAttributes.name, context: true},
            {text: ' '},
            ...boundText(el.connectorAttributes.howMany[0], el.connectorAttributes.howMany[1]),
            {text: ' times.'}
        );

        objectsEditorText.push({
            type: 'paragraph',
            children: currentText
        });
    });

    const constraints = getConstraintsOriginators();

    const reducerMap = {};
    const selectorMap = {};
    const representativeMap = {};
    const reducers = getReducers();

    const constraintWalk = (constraint, reducers, relationships) => {
        switch (constraint.icon) {
            case 'maximise':
            case 'minimise':
                const reducer = getConstraintParts(constraint._id)[0];
                if (reducer?._id in reducers) {
                    return [
                        ...reducers[reducer._id],
                        {text: ' '},
                        {text: mathText(constraint.icon), context: true},
                    ];
                } else {
                    return [];
                }
            default:
                const statement = constraintGen(constraint, reducers, relationships)
                return statement ? statement : [];
        }
    }

    const constraintGen = (node, reducers, relationships) => {
        const parts = getConstraintParts(node._id);

        function shouldBeSecond(part) {
            if (['value', 'text'].includes(part.type)) {
                return true;
            } else if (['object', 'container'].includes(part.type)) {
                return true;
            } else if (['object_type', 'container_type'].includes(part.type)) {
                return true;
            } else if (['selector'].includes(part.type)) {
                return true;
            } else if (['representative'].includes(part.type)) {
                return true;
            } else {
                return false;
            }
        }

        function genPart(part) {
            let side;
            if (part._id in reducers) {
                side = reducers[part._id];
            } else if (part._id in relationships) {
                side = relationships[part._id];
            } else if (['value', 'text'].includes(part.type)) {
                side = [{text: part.value.toString(), context: true}];
            } else if (['object', 'container'].includes(part.type)) {
                side = [{text: part?.typeAttributes?.name, context: true}];
            } else if (['object_type', 'container_type'].includes(part.type)) {
                side = [{text: part?.typeAttributes?.name, context: true}];
            } else if (['selector'].includes(part.type)) {
                side = [{text: part?.typeAttributes?.name, context: true}];
            } else if (['representative'].includes(part.type)) {
                const selectorSource = Things.findOne(Object.keys(
                    part.inConnections?.representative ?? {})?.[0] ?? '');
                side = [{text: selectorSource?.typeAttributes?.name, context: true}];
            } else {
                side = constraintGen(part, reducers, relationships);
            }
            return side;
        }

        let constraint = [];
        if (node.icon === 'not') {
            if (!parts[0]) return;
            const right = genPart(parts[0]);
            const operator = mathText(node.icon);
            if (!operator || right === undefined || right === null) return;
            constraint.push(
                {text: operator, context: true},
                {text: ' '},
                ...right
            );
        } else {
            if (!parts[0] || !parts[1]) return;
            const left = genPart(parts[0]);
            const right = genPart(parts[1]);
            const operator = mathText(node.icon);
            if (left === undefined || left === null || !operator || right === undefined || right === null) return;
            if (shouldBeSecond(parts[0]) && operatorReversal(node.icon)) {
                if (typeof right === 'function') {
                    constraint.push(...right([
                        ...left,
                        {text: ' '},
                    ], node.icon === 'notEqual'));
                } else {
                    constraint.push(
                        ...right,
                        {text: ' '},
                        {text: mathText(operatorReversal(node.icon)), context: true},
                        {text: ' '},
                        ...left
                    );
                }
            } else {
                if (typeof left === 'function') {
                    constraint.push(...left([
                        ...right,
                        {text: ' '},
                    ], node.icon === 'notEqual'));
                } else {
                    constraint.push(
                        ...left,
                        {text: ' '},
                        {text: operator, context: true},
                        {text: ' '},
                        ...right
                    );
                }
            }
        }
        return constraint;
    }

    reducers.forEach(reducer => {
        const reducerAttribute = getAttributeByReducerId(reducer._id);
        if (reducerAttribute?.[1]?.type === 'selector') {
            const el = reducerAttribute[1];
            const representativeSource = Things.findOne(Object.keys(el.inConnections?.selector ?? {})?.[0] ?? '');

            let sourceName;
            let sourceObj;
            let level = 1;

            if (representativeSource?.type === 'representative') {
                level = 2;
                const sourceConnectedTypeIds = getSourceObjectConnectedTypeIds(el._id);
                const sourceObject = getSourceObject(el._id);
                const sourceConnectedType = Things.findOne(sourceConnectedTypeIds?.[0] ?? '');
                if (sourceObject?.type === 'container_type') {
                    if (sourceConnectedTypeIds.length === 1) {
                        sourceName = sourceConnectedType.typeAttributes.name;
                        sourceObj = sourceConnectedType;
                    } else {
                        sourceName = i18n.__(`selector.contained`);
                        sourceObj = sourceConnectedType;
                    }
                } else {
                    sourceName = i18n.__(`selector.invalid`);
                }
            } else {
                level = 1;
                const sourceObject = getSourceObject(el._id);
                sourceName = sourceObject?.typeAttributes?.name;
                if (sourceObject?.type === 'container_type') {
                    sourceName = sourceObject?.typeAttributes?.name;
                    sourceObj = sourceObject;
                } else {
                    if (sourceObject?.type) {
                        const sourceConnectedTypeIds = getSourceObjectConnectedTypeIds(el._id);
                        const sourceConnectedType = Things.findOne(sourceConnectedTypeIds?.[0] ?? '');
                        if (sourceConnectedTypeIds.length === 1) {
                            sourceName = sourceConnectedType.typeAttributes.name;
                            sourceObj = sourceConnectedType;
                        } else if (sourceObject?.type === 'object_type') {
                            sourceName = sourceObject.typeAttributes.name;
                            sourceObj = sourceObject;
                        } else {
                            sourceName = i18n.__(`selector.contained`);
                            sourceObj = sourceConnectedType;
                        }
                    } else {
                        sourceName = i18n.__(`selector.invalid`);
                    }
                }
            }

            const sourceAttribute = sourceObj.attributes
                .find(el => el.parentAttributeId === reducerAttribute[0].parentAttributeId);

            const sourceNames = getAttributeSources(sourceAttribute?.sourceObj ?? []);

            const childText = [
                {text: 'The '},
                {text: mathText(reducer.icon), context: true},
                {text: ' of '},
                {text: sourceAttribute?.key ?? '', context: true},
            ]

            if (sourceNames.length > 0) {
                childText.push(
                    {text: ' from '},
                    {text: andJoin(sourceNames)});
            }

            childText.push(
                {text: ' is'}
            )

            selectorMap[reducerAttribute[1]._id] = {
                ...(selectorMap[reducerAttribute[1]._id] ?? {}),
                [reducer._id]: childText
            }
            return;
        }
        if (reducerAttribute?.[1]?.type === 'representative') {
            const el = reducerAttribute[1];
            const selectorSource = Things.findOne(Object.keys(el.inConnections?.representative ?? {})?.[0] ?? '');
            const representativeSource = Things.findOne(Object.keys(
                selectorSource?.inConnections?.selector ?? {})?.[0] ?? '');
            const selector2Source = Things.findOne(Object.keys(
                representativeSource?.inConnections?.representative ?? {})?.[0] ?? '');

            let sourceName;
            let sourceObj;
            let level = 1;
            let directSourceObj;

            if (representativeSource?.type === 'representative') {
                level = 2;
                const sourceConnectedTypeIds = getSourceObjectConnectedTypeIds(el._id);
                const sourceObject = getSourceObject(el._id);
                directSourceObj = sourceObject;
                const sourceConnectedType = Things.findOne(sourceConnectedTypeIds?.[0] ?? '');
                if (sourceObject?.type === 'container_type') {
                    if (sourceConnectedTypeIds.length === 1) {
                        sourceName = sourceConnectedType.typeAttributes.name;
                        sourceObj = sourceConnectedType;
                    } else {
                        sourceName = i18n.__(`selector.contained`);
                        sourceObj = sourceConnectedType;
                    }
                } else {
                    sourceName = i18n.__(`selector.invalid`);
                }
            } else {
                level = 1;
                const sourceObject = getSourceObject(el._id);
                directSourceObj = sourceObject;
                if (sourceObject?.type === 'container_type') {
                    sourceName = sourceObject?.typeAttributes?.name;
                    sourceObj = sourceObject;
                } else {
                    if (sourceObject?.type) {
                        const sourceConnectedTypeIds = getSourceObjectConnectedTypeIds(el._id);
                        const sourceConnectedType = Things.findOne(sourceConnectedTypeIds?.[0] ?? '');
                        if (sourceConnectedTypeIds.length === 1) {
                            sourceName = sourceConnectedType.typeAttributes.name;
                            sourceObj = sourceConnectedType;
                        } else if (sourceObject?.type === 'object_type') {
                            sourceName = sourceObject.typeAttributes.name;
                            sourceObj = sourceObject;
                        } else {
                            sourceName = i18n.__(`selector.contained`);
                            sourceObj = sourceConnectedType;
                        }
                    } else {
                        sourceName = i18n.__(`selector.invalid`);
                    }
                }
            }

            const sourceAttribute = sourceObj.attributes
                .find(el => el.parentAttributeId === reducerAttribute[0].parentAttributeId);
            const currentReducer = [
                {text: 'In any element from '},
                {text: selectorSource?.typeAttributes?.name, context: true},
                {text: ' (which is selected from '},
                {text: sourceName, context: true},
            ]
            if (level === 2) {
                currentReducer.push({text: ' which is in turn part of '},
                    {text: selector2Source?.typeAttributes?.name, context: true},
                    {text: 'from'},
                    {text: directSourceObj?.typeAttributes?.name, context: true})
            }
            currentReducer.push({text: '), the '},
                {text: mathText(reducer.icon), context: true},
                {text: ' of '},
                {text: sourceAttribute?.key ?? '', context: true}
            );


            const sourceNames = getAttributeSources(sourceAttribute?.sourceObj ?? []);

            if (sourceNames.length > 0) {
                currentReducer.push(
                    {text: ' from '},
                    {text: andJoin(sourceNames)});
            }

            currentReducer.push(
                {text: ' is'}
            );

            representativeMap[reducer._id] = currentReducer;
            return;
        }
        if (reducerAttribute?.length) {

            const childText = [
                {text: 'On '},
                {text: i18n.__(`types.${reducerAttribute[1]?.type}`), context: true},
                {text: ' '},
                {text: reducerAttribute[1]?.typeAttributes?.name, context: true},
                {text: ', the '},
                {text: mathText(reducer.icon), context: true},
                {text: ' of '},
                {text: reducerAttribute[0].key, context: true},
            ]

            const sourceNames = getAttributeSources(reducerAttribute[0].sourceObj);

            if (sourceNames.length > 0) {
                childText.push(
                    {text: ' from '},
                    {text: andJoin(sourceNames)});
            }

            childText.push({text: ' is'});

            reducerMap[reducer._id] = childText;
        }
    });

    constraints.forEach(constraint => {
        const constraintText = constraintWalk(constraint, reducerMap, relationshipContainerMap);
        if (constraintText?.length) {
            objectsEditorText.push({
                type: 'paragraph',
                children: constraintText
            });
        }
    });

    things.filter(el => el.type.includes('selector')).forEach(el => {
        const representativeSource = Things.findOne(Object.keys(el.inConnections?.selector ?? {})?.[0] ?? '');
        const selectorSource = Things.findOne(Object.keys(
            representativeSource?.inConnections?.representative ?? {})?.[0] ?? '');

        let sourceName;
        let sourceObj;
        let level = 1;
        let directSourceObj;

        if (representativeSource?.type === 'representative') {
            level = 2;
            const sourceConnectedTypeIds = getSourceObjectConnectedTypeIds(el._id);
            const sourceObject = getSourceObject(el._id);
            directSourceObj = sourceObject;
            const sourceConnectedType = Things.findOne(sourceConnectedTypeIds?.[0] ?? '');
            if (sourceObject?.type === 'container_type') {
                if (sourceConnectedTypeIds.length === 1) {
                    sourceName = sourceConnectedType.typeAttributes.name;
                    sourceObj = sourceConnectedType;
                } else {
                    sourceName = i18n.__(`selector.contained`);
                    sourceObj = sourceConnectedType;
                }
            } else {
                sourceName = i18n.__(`selector.invalid`);
            }
        } else {
            level = 1;
            const sourceObject = getSourceObject(el._id);
            directSourceObj = sourceObject;
            sourceName = sourceObject?.typeAttributes?.name;
            if (sourceObject?.type === 'container_type') {
                sourceName = sourceObject?.typeAttributes?.name
                sourceObj = sourceObject;
            } else {
                if (sourceObject?.type) {
                    const sourceConnectedTypeIds = getSourceObjectConnectedTypeIds(el._id);
                    const sourceConnectedType = Things.findOne(sourceConnectedTypeIds?.[0] ?? '');
                    if (sourceConnectedTypeIds.length === 1) {
                        sourceName = sourceConnectedType.typeAttributes.name;
                        sourceObj = sourceConnectedType;
                    } else if (sourceObject?.type === 'object_type') {
                        sourceName = sourceObject.typeAttributes.name;
                        sourceObj = sourceObject;
                    } else {
                        sourceName = i18n.__(`selector.contained`);
                        sourceObj = sourceConnectedType;
                    }
                } else {
                    sourceName = i18n.__(`selector.invalid`);
                }
            }
        }

        const countOrigin = [];
        const countOriginDefault = [i18n.__(`selector.contained`)];
        let ordered = false;

        const sourceObject = getSourceObject(el._id);
        const sourceConnectedTypeIds = [...getDirectPutIntoObjects(sourceObject?._id)];
        if (level === 1) {
            if (sourceObject?.type === 'container_type') {
                countOrigin.push(sourceObject.typeAttributes.name);
                if (el.type === 'representative') {
                    ordered = sourceObject.typeAttributes?.ordered;
                }
            }
            if (sourceConnectedTypeIds.length === 1) {
                const sourceConnectedType = sourceConnectedTypeIds?.[0];
                countOrigin.push(sourceConnectedType.typeAttributes.name);
                if (sourceObject?.type === 'container') {
                    ordered = sourceConnectedType.typeAttributes?.ordered;
                }
            } else {
                countOrigin.push(...countOriginDefault);
            }
        } else if (level === 2) {
            if (sourceConnectedTypeIds.length === 1) {
                const sourceConnectedType = sourceConnectedTypeIds?.[0];
                countOrigin.push(i18n.__(`selector.contained`) + ' in ' + sourceConnectedType.typeAttributes.name);
                ordered = sourceConnectedType.typeAttributes?.ordered;
            } else {
                countOrigin.push(i18n.__(`selector.contained`) + ' in ' + i18n.__(`selector.contained`));
                ordered = sourceConnectedTypeIds.every(el => el.typeAttributes?.ordered);
            }
        }

        const relationshipCount = countOrigin.length ? countOrigin : countOriginDefault

        el.pickedRelationships.forEach(e => {
            if (e.relationshipAttribute) {
                if (e.relationshipAttribute === 'count0') {
                    relationshipSelectorMap[e.relationshipAttributeId] = [
                        {text: 'The count of '},
                        {text: relationshipCount[0], context: true},
                        {text: ' is'},
                    ]
                } else if (e.relationshipAttribute === 'count1') {
                    relationshipSelectorMap[e.relationshipAttributeId] = [
                        {text: 'The count of '},
                        {text: relationshipCount[1], context: true},
                        {text: ' is'},
                    ]
                } else if (e.relationshipAttribute === 'contains') {
                    relationshipSelectorMap[e.relationshipAttributeId] = (other, negative) => [
                        {text: 'It'},
                        {text: negative ? ' does not contain ' : ' contains '},
                        ...other,
                        ...boundText(e.relationshipAttributeRange[0], e.relationshipAttributeRange[1]),
                        {text: ' times'},
                    ]
                } else if (e.relationshipAttribute === 'contains_all') {
                    relationshipSelectorMap[e.relationshipAttributeId] = (other, negative) => [
                        {text: 'It'},
                        {text: negative ? ' does not contain all of' : ' contains all of'},
                        ...other
                    ]
                } else if (e.relationshipAttribute === 'first' || e.relationshipAttribute === 'last') {
                    relationshipSelectorMap[e.relationshipAttributeId] = (other, negative) => [
                        {text: 'The '},
                        {text: e.relationshipAttribute, context: true},
                        {text: negative ? ' item is not' : ' item is'},
                        ...other
                    ]
                } else {
                    let linkedItem = getRelationshipRelated(e.relationshipAttributeId);
                    if (linkedItem?.type === 'representative') {
                        linkedItem = Things.findOne(Object.keys(
                            linkedItem.inConnections?.representative ?? {})?.[0] ?? '');
                    }
                    if (e.relationshipAttribute === 'before' || e.relationshipAttribute === 'after') {
                        relationshipSelectorMap[e.relationshipAttributeId] = (other, negative) => [
                            {text: 'The item '},
                            {text: linkedItem?.typeAttributes?.name ?? '', context: true},
                            {text: negative ? ' is not ' : ' is '},
                            {text: e.relationshipAttribute, context: true},
                            {text: ' the item'},
                            ...other
                        ]
                    } else {
                        relationshipSelectorMap[e.relationshipAttributeId] = (other, negative) => [
                            {text: 'The item '},
                            {text: linkedItem?.typeAttributes?.name ?? '', context: true},
                            {text: negative ? ' is not ' : ' is '},
                            {text: e.relationshipAttribute, context: true},
                            {text: ' to the item '},
                            ...other
                        ]
                    }
                }
            }
        });

        el.pickedAttributes.filter(el => el.parentAttributeId).forEach(e => {
            const sourceAttribute = sourceObj?.attributes
                .find(el1 => el1.parentAttributeId === e.parentAttributeId);

            const childText = [
                {text: 'The attribute '},
                {text: sourceAttribute?.key ?? '', context: true}
            ];

            const sourceNames = getAttributeSources(sourceAttribute?.sourceObj ?? []);

            if (sourceNames.filter(e => e).length > 0) {
                childText.push(
                    {text: ' from '},
                    {text: andJoin(sourceNames), context: true});
            }

            childText.push({text: ' is'});

            selectorMap[el._id] = {
                ...(selectorMap[el._id] ?? {}),
                [e.attributeId]: childText
            }
        });

        const currentText = [
            {text: el.typeAttributes.name, context: true},
            {text: ' is the nickname of a subset of '},
            {text: sourceName, context: true}
        ];
        if (level === 2) {
            currentText.push({text: ' (which is in turn subset of '},
                {text: selectorSource?.typeAttributes?.name ?? 'invalid', context: true},
                {text: 'from'},
                {text: directSourceObj?.typeAttributes?.name ?? 'invalid', context: true},
                {text: ')'})
        }
        currentText.push(
            {text: ' where '}
        );
        switch (el.selectorType) {
            case "any":
                currentText.push({text: 'one or more', context: true}, {text: ' of the subset '});
                break;
            case "all":
                currentText.push({text: 'all', context: true}, {text: ' of the subset '});
                break;
            case "none":
                currentText.push({text: 'none', context: true}, {text: ' of the subset '});
                break;
            case "exists":
                currentText.push({text: ' '},
                    ...boundText(el.selectorTypeRange[0], el.selectorTypeRange[1]),
                    {text: ' of the subset '});
                break;
        }

        currentText.push(
            {text: 'has the following the conditions:'},
        );
        const childText = [];
        constraints.forEach(constraint => {
            const constraintText = constraintWalk(constraint, selectorMap[el._id] ?? {},
                _.pick(relationshipSelectorMap, el.pickedRelationships.map(el => el.relationshipAttributeId)));
            if (constraintText?.length) {
                childText.push({text: '\n'}, ...constraintText);
            }
        });

        if (childText.length) {
            currentText.push(...childText);
        } else {
            currentText.push({text: '\nThere are no condition applied.'});
        }
        objectsEditorText.push({
            type: 'paragraph',
            id: el._id,
            children: currentText
        });
    });

    things.filter(el => el.type.includes('representative')).forEach(el => {
        const selectorSource = Things.findOne(Object.keys(el.inConnections?.representative ?? {})?.[0] ?? '');
        const representativeSource = Things.findOne(Object.keys(
            selectorSource?.inConnections?.selector ?? {})?.[0] ?? '');
        const selector2Source = Things.findOne(Object.keys(
            representativeSource?.inConnections?.representative ?? {})?.[0] ?? '');

        let sourceName;
        let sourceObj;
        let level = 1;
        let directSourceObj;

        if (representativeSource?.type === 'representative') {
            level = 2;
            const sourceConnectedTypeIds = getSourceObjectConnectedTypeIds(el._id);
            const sourceObject = getSourceObject(el._id);
            directSourceObj = sourceObject;
            const sourceConnectedType = Things.findOne(sourceConnectedTypeIds?.[0] ?? '');
            if (sourceObject?.type === 'container_type') {
                if (sourceConnectedTypeIds.length === 1) {
                    sourceName = sourceConnectedType.typeAttributes.name;
                    sourceObj = sourceConnectedType;
                } else {
                    sourceName = i18n.__(`selector.contained`);
                    sourceObj = sourceConnectedType;
                }
            } else {
                sourceName = i18n.__(`selector.invalid`);
            }
        } else {
            level = 1;
            const sourceObject = getSourceObject(el._id);
            directSourceObj = sourceObject;
            if (sourceObject?.type === 'container_type') {
                sourceName = sourceObject?.typeAttributes?.name;
                sourceObj = sourceObject;
            } else {
                if (sourceObject?.type) {
                    const sourceConnectedTypeIds = getSourceObjectConnectedTypeIds(el._id);
                    const sourceConnectedType = Things.findOne(sourceConnectedTypeIds?.[0] ?? '');
                    if (sourceConnectedTypeIds.length === 1) {
                        sourceName = sourceConnectedType.typeAttributes.name;
                        sourceObj = sourceConnectedType;
                    } else if (sourceObject?.type === 'object_type') {
                        sourceName = sourceObject.typeAttributes.name;
                        sourceObj = sourceObject;
                    } else {
                        sourceName = i18n.__(`selector.contained`);
                        sourceObj = sourceConnectedType;
                    }
                } else {
                    sourceName = i18n.__(`selector.invalid`);
                }
            }
        }

        const countOrigin = [];
        const countOriginDefault = [i18n.__(`selector.contained`)];
        let ordered = false;

        const sourceObject = getSourceObject(el._id);
        const sourceConnectedTypeIds = [...getDirectPutIntoObjects(sourceObject?._id)];
        if (level === 1) {
            if (sourceObject?.type === 'container_type') {
                countOrigin.push(sourceObject.typeAttributes.name);
                if (el.type === 'representative') {
                    ordered = sourceObject.typeAttributes?.ordered;
                }
            }
            if (sourceConnectedTypeIds.length === 1) {
                const sourceConnectedType = sourceConnectedTypeIds?.[0];
                countOrigin.push(sourceConnectedType.typeAttributes.name);
                if (sourceObject?.type === 'container') {
                    ordered = sourceConnectedType.typeAttributes?.ordered;
                }
            } else {
                countOrigin.push(...countOriginDefault);
            }
        } else if (level === 2) {
            if (sourceConnectedTypeIds.length === 1) {
                const sourceConnectedType = sourceConnectedTypeIds?.[0];
                countOrigin.push(i18n.__(`selector.contained`) + ' in ' + sourceConnectedType.typeAttributes.name);
                ordered = sourceConnectedType.typeAttributes?.ordered;
            } else {
                countOrigin.push(i18n.__(`selector.contained`) + ' in ' + i18n.__(`selector.contained`));
                ordered = sourceConnectedTypeIds.every(el => el.typeAttributes?.ordered);
            }
        }

        const relationshipCount = countOrigin.length ? countOrigin : countOriginDefault

        el.pickedRelationships.forEach(e => {
            if (e.relationshipAttribute) {
                const relationshipTextInitial = () => {
                    const initialPart = [
                        {text: 'In any element from '},
                        {text: selectorSource?.typeAttributes?.name, context: true},
                        {text: ' (which is selected from '},
                        {text: sourceName, context: true},
                    ]
                    if (level === 2) {
                        initialPart.push({text: ' which is in turn part of '},
                            {text: selector2Source?.typeAttributes?.name, context: true},
                            {text: 'from'},
                            {text: directSourceObj?.typeAttributes?.name, context: true})
                    }
                    initialPart.push({text: '),'});
                    return initialPart;
                }
                if (e.relationshipAttribute === 'count0') {
                    relationshipRepresentativeMap[e.relationshipAttributeId] = [
                        ...relationshipTextInitial(),
                        {text: ' the count of '},
                        {text: relationshipCount[0], context: true},
                        {text: ' is'},
                    ]
                } else if (e.relationshipAttribute === 'count1') {
                    relationshipRepresentativeMap[e.relationshipAttributeId] = [
                        ...relationshipTextInitial(),
                        {text: ' the count of '},
                        {text: relationshipCount[1], context: true},
                        {text: ' is'},
                    ]
                } else if (e.relationshipAttribute === 'contains') {
                    relationshipRepresentativeMap[e.relationshipAttributeId] = (other, negative) => [
                        ...relationshipTextInitial(),
                        {text: negative ? ' it does not contain ' : ' it contains '},
                        ...other,
                        ...boundText(e.relationshipAttributeRange[0], e.relationshipAttributeRange[1]),
                        {text: ' times'},
                    ]
                } else if (e.relationshipAttribute === 'contains_all') {
                    relationshipRepresentativeMap[e.relationshipAttributeId] = (other, negative) => [
                        ...relationshipTextInitial(),
                        {text: negative ? ' it does not contain all of' : ' it contains all of'},
                        ...other
                    ]
                } else if (e.relationshipAttribute === 'first' || e.relationshipAttribute === 'last') {
                    relationshipRepresentativeMap[e.relationshipAttributeId] = (other, negative) => [
                        ...relationshipTextInitial(),
                        {text: ' the '},
                        {text: e.relationshipAttribute, context: true},
                        {text: negative ? ' item is not' : ' item is'},
                        ...other
                    ]
                } else {
                    let linkedItem = getRelationshipRelated(e.relationshipAttributeId);
                    if (linkedItem?.type === 'representative') {
                        linkedItem = Things.findOne(Object.keys(
                            linkedItem.inConnections?.representative ?? {})?.[0] ?? '');
                    }
                    if (e.relationshipAttribute === 'before' || e.relationshipAttribute === 'after') {
                        relationshipRepresentativeMap[e.relationshipAttributeId] = (other, negative) => [
                            ...relationshipTextInitial(),
                            {text: ' the item '},
                            {text: linkedItem?.typeAttributes?.name ?? '', context: true},
                            {text: negative ? ' is not ' : ' is '},
                            {text: e.relationshipAttribute, context: true},
                            {text: ' the item'},
                            ...other
                        ]
                    } else {
                        relationshipRepresentativeMap[e.relationshipAttributeId] = (other, negative) => [
                            ...relationshipTextInitial(),
                            {text: ' the item '},
                            {text: linkedItem?.typeAttributes?.name ?? '', context: true},
                            {text: negative ? ' is not ' : ' is '},
                            {text: e.relationshipAttribute, context: true},
                            {text: ' to the item '},
                            ...other
                        ]
                    }
                }
            }
        });
    });

    constraints.forEach(constraint => {
        const constraintText = constraintWalk(constraint, representativeMap, relationshipRepresentativeMap);
        if (constraintText?.length) {
            objectsEditorText.push({
                type: 'paragraph',
                children: constraintText
            });
        }
    });

    if (!objectsEditorText.length) {
        return [{
            type: 'paragraph', children: [{
                text: 'use draw tool from tool wheel to start, change back to pan ' +
                    'to finalise drawing'
            }]
        }]
    }
    return objectsEditorText;
}

const TextPane = (props) => {

    const textRef = useRef(null);

    const thingsJSON = useMemo(() => {
            if (props.state.loaded) {
                return JSON.stringify(props.state.Things)
            }
        },
        [props.state.Things, props.state.loaded]);

    const connectionsJSON = useMemo(() => {
            if (props.state.loaded) {
                return JSON.stringify(props.state.Connections)
            }
        },
        [props.state.Connections, props.state.loaded]);


    const objectsEditorText = useMemo(() => objectsToEditorText(props.state.Things, props.state.Connections),
        [thingsJSON, connectionsJSON]);

    const withInlineVoid = editor => {
        const {isInline, isVoid} = editor

        editor.isInline = element => {
            return element.type === 'inline' ? true : isInline(element)
        }

        editor.isVoid = element => {
            return element.type === 'void' ? true : isVoid(element)
        }

        return editor
    }

    const Element = useCallback(({attributes, children, element}) => {
        switch (element.type) {
            default:
                let pending = -1;
                return <p
                    onPointerEnter={ev => {
                        if (element.id) {
                            pending = Date.now();
                            setTimeout(() => {
                                if (pending > 0 && (Date.now() - pending) > 800) {
                                    pending = -1;
                                    props.setHighlightObject(element.id);
                                }
                            }, 1000);
                        }
                    }}
                    onPointerLeave={ev => {
                        pending = -1;
                        props.setHighlightObject(null);
                    }}
                    onPointerCancel={ev => {
                        pending = -1;
                        props.setHighlightObject(null);
                    }}
                    style={{
                        outline: element?.id === props.highlightObject ? '2px solid rgba(255,0,0,0.4)' : 'unset',
                        lineHeight: 1.5
                    }}
                    className={element?.id === props.highlightObject ? 'text-highlight' : null}
                    {...attributes}>
                    {children}
                </p>
        }
    }, [props.highlightObject]);

    useLayoutEffect(() => {
        const textNode = textRef.current.parentElement;
        const highlightNode = textRef.current.getElementsByClassName('text-highlight')?.[0];
        const nodeRect = highlightNode?.getBoundingClientRect();
        if (nodeRect && (nodeRect.top < 0 || nodeRect.bottom > textNode.clientHeight)) {
            highlightNode?.scrollIntoView({behavior: 'smooth', block: 'center'});
        }
    }, [props.highlightObject]);

    const Leaf = useCallback(({attributes, children, leaf}) => {
        if (leaf.editable) {
            attributes = {
                ...attributes,
                style: {
                    ...attributes.style,
                    padding: '3px 3px 2px',
                    backgroundColor: '#eee',
                }
            }
        } else if (leaf.context) {
            attributes = {
                ...attributes,
                style: {
                    ...attributes.style,
                    textDecoration: 'underline',
                }
            }
        }

        attributes = {
            ...attributes,
            style: {
                ...attributes.style,
                verticalAlign: 'baseline',
                borderRadius: '4px',
            }
        }

        return <span
            {...attributes}>{children}</span>
    }, []);

    const [value, setValue] = useState([]);

    const editor = useMemo(() => withInlineVoid(withHistory(withReact(createEditor()))), []);

    useEffect(() => {
        setValue(objectsEditorText ? objectsEditorText : []);
        editor.children = objectsEditorText ? objectsEditorText : [];
    }, [objectsEditorText]);

    return (
        <div style={{padding: 10}} ref={textRef}>
            <Slate editor={editor} initialValue={value} onChange={(value) => setValue(value)}>
                <Editable renderElement={props => <Element {...props} />}
                          renderLeaf={props => <Leaf {...props}/>}
                          onKeyDown={ev => {
                              const rangeStart = Range.start(editor.selection);
                              const rangeEnd = Range.end(editor.selection);
                              if (!['Left', 'ArrowLeft',
                                  'Right', 'ArrowRight',
                                  'Up', 'ArrowUp',
                                  'Down', 'ArrowDown'].includes(ev.key)) {
                                  if (!rangeStart.path.every((el, index, array) =>
                                      el === rangeEnd.path[index])) {
                                      ev.preventDefault();
                                      return;
                                  }
                                  if (Editor.leaf(editor, editor.selection)?.[0]?.editable) {
                                      if (ev.key === 'Enter') {
                                          ev.preventDefault();
                                          const changeContext = Editor.leaf(editor, editor.selection)[0];
                                          console.log(changeContext);
                                          switch (changeContext.idType) {
                                              case 'type':
                                                  const normaliseTypeString = text => {
                                                      switch (text) {
                                                          case i18n.__('types.object'):
                                                              return 'object';
                                                          case i18n.__('types.object_type'):
                                                              return 'object_type';
                                                          case i18n.__('types.container'):
                                                              return 'container';
                                                          case i18n.__('types.container_type'):
                                                              return 'container_type';
                                                          default:
                                                              return '';
                                                      }
                                                  }
                                                  const normalisedTypeString = normaliseTypeString(changeContext.text);
                                                  if (normalisedTypeString) {
                                                      changeType.call({
                                                          id: changeContext.id,
                                                          type: normalisedTypeString
                                                      })
                                                  } else {
                                                      editor.undo();
                                                  }
                                                  break;
                                              case 'typeAttribute':
                                                  if (changeContext.key === 'name') {
                                                      changeTypeAttribute.call({
                                                          id: changeContext.id,
                                                          typeAttributeName: 'name',
                                                          value: changeContext.text
                                                      })
                                                  } else if (changeContext.key === 'amount') {
                                                      changeTypeAttribute.call({
                                                          id: changeContext.id,
                                                          typeAttributeName: 'amount',
                                                          value: parseInt(changeContext.text)
                                                      })
                                                  }
                                                  break;
                                              case 'attribute':
                                                  changeAttributeName.call({
                                                      attributeId: changeContext.id,
                                                      value: changeContext.text
                                                  })
                                                  break;
                                              case 'value':
                                                  changeValue.call({
                                                      id: changeContext.id,
                                                      value: parseInt(changeContext.text)
                                                  }, (err, res) => {
                                                      if (err) {
                                                          editor.undo();
                                                      }
                                                  })
                                                  break;
                                          }
                                      } else if (ev.key === 'Backspace' || ev.key === 'Delete') {
                                          const selectionLength = rangeEnd.offset - rangeStart.offset
                                          if (Editor.leaf(editor, editor.selection)?.[0]?.text.length <= selectionLength) {
                                              Transforms.setPoint(editor, {offset: rangeEnd.offset - 1},
                                                  {edge: 'end'});
                                          } else if (Editor.leaf(editor, editor.selection)?.[0]?.text.length === 1) {
                                              ev.preventDefault();
                                          }
                                      }
                                  } else {
                                      ev.preventDefault();
                                  }
                              }
                          }}
                />
            </Slate>
        </div>
    )
}

export default TextPane;