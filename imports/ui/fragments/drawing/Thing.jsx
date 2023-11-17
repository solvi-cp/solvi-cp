import i18n from 'meteor/universe:i18n';
import {_} from 'meteor/underscore';
import interact from 'interactjs';

import {
    changeAttributeName,
    changeText,
    changeType,
    changeTypeAttribute,
    changeValue,
    moveThings,
    reverseConnectors,
    deleteThing,
    changeSelectorType,
    addPickedAttribute,
    addPickedRelationships,
    changePickedRelationships,
    changePickedAttribute,
    changeSelectorTypeRange,
    changePickedRelationshipsRange,
    changeRepeatedLevels,
    createAndConnectValue,
    createAndConnectText,
    addAttributesAndValuesToLoad,
    batchAddAttributeAndValues
} from "../../../api/things/methods";

import {Sketch} from "../../components/drawing/Sketch";
import {constants, hasPointerEvents, typeBoxColor} from "../../helpers/shared";
import {NameValue} from "../../components/drawing/NameValue";
import {
    createBoundingBox,
    createIcon,
    createConnectorAttachments,
    createPlusInCircle,
    createUploadInCircle,
    allowDelete
} from "../../components/drawing/Components";

import {addAttribute} from "../../../api/things/methods";
import {
    getDirectPutIntoObjects,
    getPutIntoObjects,
    getSourceObject,
    getSourceObjectConnectedTypeIds,
    hasInstances,
    hasPutIntos,
    getTypeInstancesOf,
    getDirectInstances
} from "../../../utils/api";
import {Things} from "../../../api/things/collection";
import {connectObjects} from '../../../api/connections/methods';

function typeAttributesFilter(element, index, array) {
    if (element === 'circular') {
        if (!this.typeAttributes?.ordered) {
            return false;
        }
    }
    return true;
}

const createTypeAttributes = (thing, thingObject, draggable) => {

    if (!thing?.typeAttributesOrder?.length) return;

    const typeAttributesObjectBbox = thingObject.group();
    typeAttributesObjectBbox.addClass('type-attributes');
    typeAttributesObjectBbox.addClass('bbox');

    const typeAttributesObject = typeAttributesObjectBbox.group();
    typeAttributesObject.addClass('inner');

    const boundingBox = thingObject.bbox();

    thing.typeAttributesOrder.reverse();

    const typeAttributesHeight = thing.typeAttributesOrder
        .filter(typeAttributesFilter, thing)
        .reduce((accumulator, attribute, index) => {
            const elements = [{
                value: i18n.__(`attributes.${attribute}`),
                readOnly: true
            }, {
                value: ': ',
                readOnly: true
            }];
            if (Array.isArray(thing.typeAttributes[attribute])) {
                elements.push({
                    value: thing.typeAttributes[attribute][0] > -1 ? thing.typeAttributes[attribute][0] : 'unlimited',
                    readOnly: false,
                    type: typeof thing.typeAttributes[attribute][0],
                    callback: (ev, val, nameValue) => {
                        if (Number.isNaN(val)) val = -1;
                        changeTypeAttribute.call({
                            id: nameValue.parent('.bbox').data('parentId'),
                            typeAttributeName: attribute,
                            value: [val, thing.typeAttributes[attribute][1]]
                        })
                    }
                }, {
                    value: ' to ',
                    readOnly: true
                }, {
                    value: thing.typeAttributes[attribute][1] > -1 ? thing.typeAttributes[attribute][1] : 'unlimited',
                    readOnly: false,
                    type: typeof thing.typeAttributes[attribute][1],
                    callback: (ev, val, nameValue) => {
                        if (Number.isNaN(val)) val = -1;
                        changeTypeAttribute.call({
                            id: nameValue.parent('.bbox').data('parentId'),
                            typeAttributeName: attribute,
                            value: [thing.typeAttributes[attribute][0], val]
                        })
                    }
                });
            } else {
                const readOnly = () => {
                    if (thing.type === 'container' &&
                        Object.keys(thing?.outConnections?.instanceOf ?? {}).some(el => {
                            const thing = Things.findOne(el);
                            return ['object', 'container', 'object_type', 'container_type'].includes(thing?.type)
                        })) {
                        if (attribute === 'ordered' || attribute === 'circular') {
                            return true;
                        }
                    }
                    return false;
                };
                elements.push({
                    value: typeof thing.typeAttributes[attribute] === 'number' ?
                        (thing.typeAttributes[attribute] > -1) ? thing.typeAttributes[attribute] : 'unlimited'
                        : thing.typeAttributes[attribute],
                    readOnly: readOnly(),
                    type: typeof thing.typeAttributes[attribute],
                    callback: (ev, val, nameValue) => {
                        if (Number.isNaN(val)) val = -1;
                        changeTypeAttribute.call({
                            id: nameValue.parent('.bbox').data('parentId'),
                            typeAttributeName: attribute,
                            value: val
                        })
                    }
                });
            }
            const typeAttribute = NameValue(undefined, thing._id, typeAttributesObject,
                {
                    x: boundingBox.x + constants.boxPadding,
                    y: boundingBox.y
                },
                elements, draggable);
            typeAttribute.parent('.bbox')
                .dy(accumulator - typeAttribute.parent('.bbox').height() - constants.boxPadding * 2);

            typeAttribute.parent('.bbox').data('type', 'copy');
            typeAttribute.parent('.bbox').data('typeName', attribute);

            return accumulator - typeAttribute.parent('.bbox').height() - constants.boxPadding;
        }, 0);

    const typeOptions = [];

    const objectsConnected = hasPutIntos(thing._id);
    const typesConnected = hasInstances(thing._id);

    if (!objectsConnected) {
        if (!typesConnected) {
            typeOptions.push('object')
        }
        typeOptions.push('object_type');
    }
    if (!typesConnected) {
        typeOptions.push('container');
    }
    typeOptions.push('container_type');

    if (!typeOptions.includes(thing.type)) {
        typeOptions.push(thing.type);
    }

    const typeSelector = NameValue(undefined, thing._id, typeAttributesObject,
        {
            x: boundingBox.x + constants.boxPadding,
            y: boundingBox.y
        },
        [{
            value: thing.type,
            options: typeOptions.map(el => [i18n.__(`types.${el}`), el]),
            readOnly: false,
            type: 'select',
            size: 'large',
            border: typeBoxColor(thing.type),
            italic: thing.type.includes('type'),
            callback: (ev, val, nameValue) => {
                changeType.call({
                    id: nameValue.parent('.bbox').data('parentId'),
                    type: val
                });
            }
        }
        ], draggable);

    typeSelector.parent('.bbox').dy(typeAttributesHeight - typeSelector.parent('.bbox')
        .height() - constants.boxPadding * 2);

    createBoundingBox(typeAttributesObjectBbox, typeAttributesObject.bbox(),
        constants.typeAttributeBboxColor, constants.typeAttributeBboxOpacity);

    return typeAttributesObject;
};

const createRepeatedAttributes = (thing, thingObject, draggable) => {

    const repeatedLevels = thing.repeatedLevels;

    const levelsTree = [];
    const queue = [thing];
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

    if (!levelsTree.length) return;

    const repeatedAttributesObjectBbox = thingObject.group();
    repeatedAttributesObjectBbox.addClass('type-attributes');
    repeatedAttributesObjectBbox.addClass('bbox');

    const repeatedAttributesObject = repeatedAttributesObjectBbox.group();
    repeatedAttributesObject.addClass('inner');

    const boundingBox = thingObject.bbox();

    const typeAttributesHeight = levelsTree.reverse()
        .reduce((accumulator, levelThings, index) => {
            const elements = [{
                value: levelThings.map(el => el.typeAttributes.name).join(', '),
                readOnly: true
            }, {
                value: ': ',
                readOnly: true
            }];
            elements.push({
                value: repeatedLevels?.[levelsTree.length - index - 1] ?? true,
                type: typeof true,
                callback: (ev, val, nameValue) => {
                    const newLevels = [...repeatedLevels ?? []];
                    newLevels[levelsTree.length - index - 1] = val;
                    changeRepeatedLevels.call({id: thing._id, repeatedLevels: newLevels})
                }
            });

            const repeatedAttribute = NameValue(undefined, thing._id, repeatedAttributesObject,
                {
                    x: boundingBox.x + constants.boxPadding,
                    y: boundingBox.y
                },
                elements, draggable);
            repeatedAttribute.parent('.bbox')
                .dy(accumulator - repeatedAttribute.parent('.bbox').height() - constants.boxPadding * 2);

            return accumulator - repeatedAttribute.parent('.bbox').height() - constants.boxPadding;
        }, 0);

    const repeatedTitle = NameValue(undefined, thing._id, repeatedAttributesObject,
        {
            x: boundingBox.x + constants.boxPadding,
            y: boundingBox.y
        },
        [{
            value: 'repeated?',
            readOnly: true,
        }
        ], draggable);

    repeatedTitle.parent('.bbox').dy(typeAttributesHeight - repeatedTitle.parent('.bbox')
        .height() - constants.boxPadding * 2);

    createBoundingBox(repeatedAttributesObjectBbox, repeatedAttributesObject.bbox(),
        constants.typeAttributeBboxColor, constants.typeAttributeBboxOpacity);

    return repeatedAttributesObject;
};

const createObjectAttributes = (thing, thingObject, draggable, addable) => {

    if (!addable && !thing.attributes.length) return;

    const objectAttributesObjectBbox = thingObject.group();
    objectAttributesObjectBbox.addClass('object-attributes');
    objectAttributesObjectBbox.addClass('bbox');

    const objectAttributesObject = objectAttributesObjectBbox.group();
    objectAttributesObject.addClass('inner');

    const boundingBox = thingObject.findOne('.sketch.bbox').bbox();

    const objectAttributes = thing.attributes.sort((a, b) => {
        if (a.priority < b.priority) {
            return -1;
        }
        if (a.priority > b.priority) {
            return 1;
        }
        return 0;
    });

    const objectAttributesHeight = objectAttributes.reduce((accumulator, attribute, index) => {
        const inherited = !attribute.initial;
        const attributeSources = attribute?.sourceObj?.map(el => {
            const obj = Things.findOne(el);
            return obj?.typeAttributes?.name;
        });
        const objectAttribute = NameValue(attribute.attributeId, thing._id, objectAttributesObject,
            {
                x: boundingBox.x + constants.boxPadding,
                y: boundingBox.y
            },
            [
                {
                    value: `${attribute.key}`,
                    readOnly: false,
                    type: typeof attribute.key,
                    callback: (ev, val, nameValue) => {
                        changeAttributeName.call({
                            attributeId: nameValue.parent('.bbox').data('id'),
                            value: val
                        })
                    }
                },
                (attributeSources?.length ? {
                    value: ` of ${attributeSources?.join(", ")}`,
                    readOnly: true
                } : undefined)
            ], draggable
        );

        objectAttribute.parent('.bbox').dy(accumulator + constants.boxPadding * 2);

        objectAttribute.parent('.bbox').data('parentAttributeId', attribute.parentAttributeId);
        objectAttribute.parent('.bbox').data('inherited', inherited);
        if (inherited) objectAttribute.parent('.bbox').addClass('inherited');

        if (attribute.initial) {
            if (thing.type.includes('type')) {
                objectAttribute.parent('.bbox').data('type', 'attributeOnType');
            } else {
                objectAttribute.parent('.bbox').data('type', 'attribute');
            }
        } else {
            objectAttribute.parent('.bbox').data('type', 'collection');
        }

        return accumulator + objectAttribute.parent('.bbox').height() + constants.boxPadding;
    }, boundingBox.height);

    let attributeBoundingBox = objectAttributesObject.bbox();
    if (objectAttributes.length === 0) {
        attributeBoundingBox = boundingBox;
    }

    if (addable) {
        let addAttributeObject = objectAttributesObject.group();
        let csvImportObject = objectAttributesObject.group();
        const circle = addAttributeObject.circle(constants.connectorDiameter)
            .x(attributeBoundingBox.x)
            .y(attributeBoundingBox.y2 + constants.padding)
            .fill('gray');
        createPlusInCircle(addAttributeObject, 'black', circle);

        //if the thing is an object group or a container group, add an upload CSV button
        if (thing.type === "object_type" || thing.type === "container_type") {
            const circle2 = csvImportObject.circle(constants.connectorDiameter)
                .x(attributeBoundingBox.x + constants.padding * 3)
                .y(attributeBoundingBox.y2 + constants.padding)
                .fill('gray');
            createUploadInCircle(csvImportObject, 'black', circle2);
        }

        if (draggable) {

            interact(addAttributeObject.node).on('down', (ev) => {
                if (ev.button === 0) {
                    addAttribute.call({
                        id: thing._id
                    });
                    ev.preventDefault();
                }
            });

            interact(csvImportObject.node).on('down', (ev) => {
                if (ev.button === 0) {
                    //if the button clicked has class uploadCsv, the user is uploading a CSV
                    //create a input which accepts CSV files
                    const fileUpload = document.createElement('input');
                    fileUpload.setAttribute("type", "file");
                    fileUpload.setAttribute("accept", ".csv");
                    //on upload function
                    fileUpload.onchange = e => {
                        //get the file, and then read
                        const file = e.target.files[0];
                        const reader = new FileReader();
                        reader.readAsText(file, 'UTF-8');
                        //method to run when the file is successfully read
                        reader.onload = readerEvent => {
                            const csvContent = readerEvent.target.result; // get the content
                            const csvLines = csvContent.split(/\r?\n/).map(el => el.split(','));
                            const attributesHeader = csvLines.shift();
                            const attributeAndValueMapArray = csvLines
                                .filter(el => el.length === attributesHeader.length)
                                .map(el => el.reduce((prev, curr, i) => {
                                    return {
                                        ...prev,
                                        [attributesHeader[i]]: curr
                                    }
                                }, {}));

                            const directInstances = [...getDirectInstances(thing._id)];
                            if (thing.instancesExpanded) {
                                attributesHeader.forEach(el => {
                                    if (el === 'name') {
                                        directInstances.forEach((el1, i) => {
                                            if (i >= attributeAndValueMapArray.length) return;
                                            changeTypeAttribute.call({
                                                id: el1._id,
                                                value: attributeAndValueMapArray[i].name.toString(),
                                                typeAttributeName: "name"
                                            })
                                        });
                                    } else {
                                        batchAddAttributeAndValues.call({
                                            parentId: thing._id,
                                            attributeName: el,
                                            values: attributeAndValueMapArray.map(el1 => el1[el].toString()),
                                            sketchHeight: thingObject.findOne('.sketch > rect').height()
                                        });
                                    }
                                });
                            } else {
                                const targetId = directInstances.length > 0 ? directInstances[0]._id : thing._id;
                                addAttributesAndValuesToLoad.call({
                                    id: thing._id,
                                    attributesAndValuesToLoad: attributeAndValueMapArray
                                });
                                attributesHeader.filter(el => el !== 'name').forEach(el => {
                                    addAttribute.call({
                                        id: targetId,
                                        attributeName: el,
                                    });
                                });
                            }

                            const message = csvImportObject.text(i18n.__(`ui.csv-imported`)).center(circle.cx(),
                                circle.cy()).font({fill: '#000000'});
                            message.dx(message.bbox().width);
                            message.animate(3000).opacity(0);
                            setTimeout(() => {
                                if (message) {
                                    message.remove();
                                }
                            }, 3000);
                        }
                    }
                    setTimeout(() => fileUpload.click(), 100);
                    ev.preventDefault();
                }
            });
        }

        if (objectAttributes.length === 0) {
            addAttributeObject.dx(constants.boxPadding);
        }
    }

    createBoundingBox(objectAttributesObjectBbox, objectAttributesObject.bbox(),
        constants.typeAttributeBboxColor, constants.typeAttributeBboxOpacity);

    return objectAttributesObject;

}

const createRepresentativeTitle = (thing, thingObject, draggable) => {
    const representativeBbox = thingObject.group();
    representativeBbox.addClass('representative');
    representativeBbox.addClass('bbox');

    const representativeNameObject = representativeBbox.group();
    representativeNameObject.addClass('inner');

    const selectorSource = Things.findOne(Object.keys(thing.inConnections?.representative ?? {})?.[0] ?? '');
    const representativeSource = Things.findOne(Object.keys(selectorSource?.inConnections?.selector ?? {})?.[0] ?? '');

    let sourceName; // = 'container';

    if (representativeSource?.type === 'representative') {
        thingObject.data('level', 'two');
        const sourceConnectedTypeIds = getSourceObjectConnectedTypeIds(thing._id);
        const sourceObject = getSourceObject(thing._id);

        const sourceConnectedType = Things.findOne(sourceConnectedTypeIds?.[0] ?? '');
        if (sourceObject?.type === 'container_type') {
            if (sourceConnectedTypeIds.length === 1) {
                sourceName = sourceConnectedType.typeAttributes.name;
            } else {
                sourceName = i18n.__(`selector.contained`);
            }
            if (sourceConnectedType?.type?.includes('container')) {
                thingObject.data('targetType', 'container');
            } else {
                thingObject.data('targetType', 'object');
            }
        } else {
            sourceName = i18n.__(`selector.invalid`);
            thingObject.data('targetType', 'invalid');
        }
    } else {
        thingObject.data('level', 'one');
        const sourceObject = getSourceObject(thing._id);
        if (sourceObject?.type === 'container_type') {
            sourceName = sourceObject?.typeAttributes?.name;
            thingObject.data('targetType', 'container');
        } else {
            if (sourceObject?.type) {
                const sourceConnectedTypeIds = getSourceObjectConnectedTypeIds(thing._id);
                const sourceConnectedType = Things.findOne(sourceConnectedTypeIds?.[0] ?? '');
                if (sourceConnectedTypeIds.length === 1) {
                    sourceName = sourceConnectedType.typeAttributes.name;
                } else if (sourceObject?.type === 'object_type') {
                    sourceName = sourceObject.typeAttributes.name;
                } else {
                    sourceName = i18n.__(`selector.contained`);
                }
                if (sourceConnectedType?.type?.includes('container')) {
                    thingObject.data('targetType', 'container');
                } else {
                    thingObject.data('targetType', 'object');
                }
            } else {
                sourceName = i18n.__(`selector.invalid`);
                thingObject.data('targetType', 'invalid');
            }
        }
    }

    const representativeName = NameValue(thing._id, undefined, representativeNameObject,
        {
            x: 0,
            y: 0
        },
        [{
            value: i18n.__(`selector.${thing.type}`) + ' of ' + sourceName,
            readOnly: true,
            border: typeBoxColor(thing.type),
            size: 'large'
        }
        ], draggable, true);

    const selectorObject = Things.findOne(Object.keys(thing?.inConnections?.representative ?? {})?.[0] ?? '');
    const sourceObject = Things.findOne(Object.keys(selectorObject?.inConnections?.selector ?? {})?.[0] ?? '');

    if (sourceObject?.type === 'container_type') {
        representativeName.parent('.bbox').data('type', 'representativeWithNext');
    } else {
        representativeName.parent('.bbox').data('type', 'representative');
    }

    createBoundingBox(representativeBbox, representativeBbox.bbox(),
        constants.typeAttributeBboxColor, constants.typeAttributeBboxOpacity);

    return representativeBbox;
}

const createSelectorPicker = (thing, thingObject, draggable) => {
    const selectorBbox = thingObject.group();
    selectorBbox.addClass('selector');
    selectorBbox.addClass('bbox');

    const selectorNameObject = selectorBbox.group();
    selectorNameObject.addClass('inner');

    const representativeSource = Things.findOne(Object.keys(thing.inConnections?.selector ?? {})?.[0] ?? '');

    let sourceName; // = 'container';

    if (representativeSource?.type === 'representative') {
        thingObject.data('level', 'two');
        const sourceConnectedTypeIds = getSourceObjectConnectedTypeIds(thing._id);
        const sourceObject = getSourceObject(thing._id);
        const sourceConnectedType = Things.findOne(sourceConnectedTypeIds?.[0] ?? '');
        if (sourceObject?.type === 'container_type') {
            if (sourceConnectedTypeIds.length === 1) {
                sourceName = sourceConnectedType.typeAttributes.name;
            } else {
                sourceName = i18n.__(`selector.contained`);
            }
            if (sourceConnectedType?.type?.includes('container')) {
                thingObject.data('targetType', 'container');
            } else {
                thingObject.data('targetType', 'object');
            }
        } else {
            sourceName = i18n.__(`selector.invalid`);
            thingObject.data('targetType', 'invalid');
        }
    } else {
        thingObject.data('level', 'one');
        const sourceObject = getSourceObject(thing._id);
        if (sourceObject?.type === 'container_type') {
            sourceName = sourceObject?.typeAttributes?.name
            thingObject.data('targetType', 'container');
        } else {
            if (sourceObject?.type) {
                const sourceConnectedTypeIds = getSourceObjectConnectedTypeIds(thing._id);
                const sourceConnectedType = Things.findOne(sourceConnectedTypeIds?.[0] ?? '');
                if (sourceConnectedTypeIds.length === 1) {
                    sourceName = sourceConnectedType.typeAttributes.name;
                } else if (sourceObject?.type === 'object_type') {
                    sourceName = sourceObject.typeAttributes.name;
                } else {
                    sourceName = i18n.__(`selector.contained`);
                }
                if (sourceConnectedType?.type?.includes('container')) {
                    thingObject.data('targetType', 'container');
                } else {
                    thingObject.data('targetType', 'object');
                }
            } else {
                sourceName = i18n.__(`selector.invalid`);
                thingObject.data('targetType', 'invalid');
            }
        }
    }

    const selectorName = NameValue(thing._id, undefined, selectorNameObject,
        {
            x: 0,
            y: 0
        },
        [{
            value: i18n.__(`selector.${thing.type}`) + ' of ' + sourceName,
            readOnly: true,
            border: typeBoxColor(thing.type),
            size: 'large'
        }], draggable, true);

    selectorName.parent('.bbox').data('type', 'selector');

    const selectorPickerObject = selectorBbox.group();
    selectorPickerObject.addClass('inner');

    const selectorOptions = ['any', 'all', 'none', 'exists'];

    const typeSelector = NameValue(undefined, thing._id, selectorPickerObject,
        {
            x: 0,
            y: 0
        },
        [{
            value: thing.selectorType,
            options: selectorOptions.map(el => [i18n.__(`selector.${el}`), el]),
            readOnly: false,
            type: 'select',
            callback: (ev, val, nameValue) => {
                changeSelectorType.call({
                    id: nameValue.parent('.bbox').data('parentId'),
                    type: val
                });
            }
        }], draggable);

    typeSelector.parent('.bbox').dy(selectorName.parent('.bbox').height() + constants.boxPadding);

    if (thing.selectorType === 'exists' && Array.isArray(thing.selectorTypeRange)) {
        const existsSelector = NameValue(undefined, thing._id, selectorPickerObject,
            {
                x: 0,
                y: 0
            },
            [{
                value: thing.selectorTypeRange[0] > -1 ? thing.selectorTypeRange[0] : 'unlimited',
                readOnly: false,
                type: typeof thing.selectorTypeRange[0],
                callback: (ev, val, nameValue) => {
                    if (Number.isNaN(val)) val = -1;
                    changeSelectorTypeRange.call({
                        id: nameValue.parent('.bbox').data('parentId'),
                        value: [val, thing.selectorTypeRange[1]]
                    })
                }
            }, {
                value: ' to ',
                readOnly: true
            }, {
                value: thing.selectorTypeRange[1] > -1 ? thing.selectorTypeRange[1] : 'unlimited',
                readOnly: false,
                type: typeof thing.selectorTypeRange[1],
                callback: (ev, val, nameValue) => {
                    if (Number.isNaN(val)) val = -1;
                    changeSelectorTypeRange.call({
                        id: nameValue.parent('.bbox').data('parentId'),
                        value: [thing.selectorTypeRange[0], val]
                    })
                }
            }], draggable);

        existsSelector.parent('.bbox').dy(typeSelector.parent('.bbox').bbox().y2 + constants.boxPadding);
    }

    thing.typeAttributesOrder.reverse();

    const typeAttributesHeight = thing.typeAttributesOrder
        .filter(typeAttributesFilter, thing)
        .reduce((accumulator, attribute, index) => {
            const elements = [{
                value: i18n.__(`attributes.${attribute}`),
                readOnly: true
            }, {
                value: ': ',
                readOnly: true
            }];
            if (Array.isArray(thing.typeAttributes[attribute])) {
                elements.push({
                    value: thing.typeAttributes[attribute][0] > -1 ? thing.typeAttributes[attribute][0] : 'unlimited',
                    readOnly: false,
                    type: typeof thing.typeAttributes[attribute][0],
                    callback: (ev, val, nameValue) => {
                        if (Number.isNaN(val)) val = -1;
                        changeTypeAttribute.call({
                            id: nameValue.parent('.bbox').data('parentId'),
                            typeAttributeName: attribute,
                            value: [val, thing.typeAttributes[attribute][1]]
                        })
                    }
                }, {
                    value: ' to ',
                    readOnly: true
                }, {
                    value: thing.typeAttributes[attribute][1] > -1 ? thing.typeAttributes[attribute][1] : 'unlimited',
                    readOnly: false,
                    type: typeof thing.typeAttributes[attribute][1],
                    callback: (ev, val, nameValue) => {
                        if (Number.isNaN(val)) val = -1;
                        changeTypeAttribute.call({
                            id: nameValue.parent('.bbox').data('parentId'),
                            typeAttributeName: attribute,
                            value: [thing.typeAttributes[attribute][0], val]
                        })
                    }
                });
            } else {
                const readOnly = () => {
                    if (thing.type === 'container' &&
                        Object.keys(thing?.outConnections?.instanceOf ?? {}).some(el => {
                            const thing = Things.findOne(el);
                            return ['object', 'container', 'object_type', 'container_type'].includes(thing?.type)
                        })) {
                        if (attribute === 'ordered' || attribute === 'circular') {
                            return true;
                        }
                    }
                    return false;
                };
                elements.push({
                    value: typeof thing.typeAttributes[attribute] === 'number' ?
                        (thing.typeAttributes[attribute] > -1) ? thing.typeAttributes[attribute] : 'unlimited'
                        : thing.typeAttributes[attribute],
                    readOnly: readOnly(),
                    type: typeof thing.typeAttributes[attribute],
                    callback: (ev, val, nameValue) => {
                        if (Number.isNaN(val)) val = -1;
                        changeTypeAttribute.call({
                            id: nameValue.parent('.bbox').data('parentId'),
                            typeAttributeName: attribute,
                            value: val
                        })
                    }
                });
            }
            const typeAttribute = NameValue(undefined, thing._id, selectorPickerObject,
                {
                    x: 0,
                    y: 0
                },
                elements, draggable);
            typeAttribute.parent('.bbox')
                .dy(accumulator + constants.boxPadding * 2);

            return accumulator + constants.boxPadding;
        }, selectorPickerObject.bbox().y2 - constants.boxPadding);

    createBoundingBox(selectorBbox, selectorBbox.bbox(),
        constants.typeAttributeBboxColor, constants.typeAttributeBboxOpacity);

    return selectorBbox;
}

const createAttributePicker = (thing, thingObject, draggable, addable) => {
    if (!addable && !thing.attributes.length) return;

    const attributesObjectBbox = thingObject.group();
    attributesObjectBbox.addClass('attributes-picker');
    attributesObjectBbox.addClass('bbox');

    const attributesObject = attributesObjectBbox.group();
    attributesObject.addClass('inner');

    const selectorName = NameValue(undefined, thing._id, attributesObject,
        {
            x: thingObject.bbox().x + constants.boxPadding,
            y: thingObject.bbox().y2 + constants.boxPadding * 2
        },
        [{
            value: i18n.__(`attributes.attribute`),
            readOnly: true,
        }
        ], draggable, true);

    let sourceObject;

    if (thing.type === 'selector' || thing.type === 'representative') {
        sourceObject = getSourceObject(thing._id);
        const sourceConnectedTypeIds = [...getDirectPutIntoObjects(sourceObject._id)];
        if (thingObject.data('level') === 'two') {
            const sourceConnectedType = sourceConnectedTypeIds?.[0];
            sourceObject = sourceConnectedType;
        }
    }

    const objectAttributes = sourceObject?.attributes?.sort((a, b) => {
        if (a.priority < b.priority) {
            return -1;
        }
        if (a.priority > b.priority) {
            return 1;
        }
        return 0;
    });

    const attributesOptions = objectAttributes?.filter(el =>
        thing.type === 'selector' || !el.initial
    )?.map(el => {
        const attributeSources = el?.sourceObj?.map(el1 => {
            const obj = Things.findOne(el1);
            return obj?.typeAttributes?.name;
        }) ?? [];

        return [el.key + (attributeSources?.length ? ' of ' + attributeSources?.join(", ") : ''),
            el.parentAttributeId]
    });

    const objectAttributesHeight = thing.pickedAttributes.reduce((accumulator, attribute, index) => {
        const objectAttribute = NameValue(attribute.attributeId, thing._id, attributesObject,
            {
                x: thingObject.bbox().x + constants.boxPadding,
                y: 0
            },
            [
                {
                    value: attribute.parentAttributeId,
                    options: [['select an attribute', ''], ...attributesOptions],
                    readOnly: false,
                    type: 'select',
                    callback: (ev, val, nameValue) => {
                        changePickedAttribute.call({
                            attributeId: nameValue.parent('.bbox').data('id'),
                            parentAttributeId: val
                        });
                    }
                }
            ], draggable
        );

        objectAttribute.parent('.bbox').dy(accumulator + constants.boxPadding);

        objectAttribute.parent('.bbox').data('parentAttributeId', attribute.parentAttributeId);

        if (attribute.parentAttributeId !== '') {
            if (thingObject.data('targetType') === 'container') {
                const sourceAttr = objectAttributes?.find(el => el.parentAttributeId === attribute.parentAttributeId);
                if (sourceAttr?.initial) {
                    objectAttribute.parent('.bbox').data('type', 'selectorAttribute');
                } else {
                    objectAttribute.parent('.bbox').data('type', 'collection');
                }
            } else {
                objectAttribute.parent('.bbox').data('type', 'selectorAttribute');
            }
        }

        return accumulator + objectAttribute.parent('.bbox').height() + constants.boxPadding;
    }, attributesObjectBbox.bbox().y2);

    let attributeBoundingBox = attributesObject.bbox();
    if (thing.pickedAttributes.length === 0) {
        attributeBoundingBox = attributesObjectBbox.bbox();
    }

    if (addable) {
        let addAttributeObject = attributesObject.group();
        const circle = addAttributeObject.circle(constants.connectorDiameter)
            .x(attributeBoundingBox.x)
            .y(attributeBoundingBox.y2 + constants.padding)
            .fill('gray');
        createPlusInCircle(addAttributeObject, 'black', circle);

        if (draggable) {
            interact(addAttributeObject.node).on('down', (ev) => {
                if (ev.button === 0) {
                    addPickedAttribute.call({
                        id: thing._id
                    });
                    ev.preventDefault();
                }
            });
        }

        if (thing.pickedAttributes.length === 0) {
            addAttributeObject.dx(constants.boxPadding);
        }
    }

    createBoundingBox(attributesObjectBbox, attributesObjectBbox.bbox(),
        constants.typeAttributeBboxColor, constants.typeAttributeBboxOpacity);

    return attributesObjectBbox;
}

export const createRelationshipPicker = (thing, thingObject, draggable, addable) => {

    if (thingObject.data('targetType') && thingObject.data('targetType') !== 'container') {
        return;
    }

    const relationshipAttributeBbox = thingObject.group();
    relationshipAttributeBbox.addClass('relationship-attributes');
    relationshipAttributeBbox.addClass('bbox');

    const relationshipAttributesObject = relationshipAttributeBbox.group();
    relationshipAttributesObject.addClass('inner');

    const selectorName = NameValue(undefined, thing._id, relationshipAttributesObject,
        {
            x: thingObject.bbox().x + constants.boxPadding,
            y: thingObject.bbox().y2 + constants.boxPadding * 2
        },
        [{
            value: i18n.__(`relationship.relationship`),
            readOnly: true,
        }
        ], draggable, true);

    const countOrigin = [];
    const countOriginDefault = [i18n.__(`selector.contained`)];
    let ordered = false;

    if (thing.type === 'container_type' || thing.type === 'container') {
        if (thing.type === 'container_type') {
            countOrigin.push(thing.typeAttributes.name);
        } else {
            ordered = thing.typeAttributes?.ordered;
        }
        const sourceConnectedTypeIds = [...getDirectPutIntoObjects(thing._id)];
        if (sourceConnectedTypeIds.length === 1) {
            const sourceConnectedType = sourceConnectedTypeIds?.[0];
            countOrigin.push(sourceConnectedType.typeAttributes.name);
        } else {
            countOrigin.push(...countOriginDefault);
        }
    } else if (thing.type === 'selector' || thing.type === 'representative') {
        const sourceObject = getSourceObject(thing._id);
        const sourceConnectedTypeIds = [...getDirectPutIntoObjects(sourceObject._id)];
        if (thingObject.data('level') === 'one') {
            if (sourceObject.type === 'container_type') {
                countOrigin.push(sourceObject.typeAttributes.name);
                if (thing.type === 'representative') {
                    ordered = sourceObject.typeAttributes?.ordered;
                }
            }
            if (sourceConnectedTypeIds.length === 1) {
                const sourceConnectedType = sourceConnectedTypeIds?.[0];
                countOrigin.push(sourceConnectedType.typeAttributes.name);
                if (sourceObject.type === 'container') {
                    ordered = sourceConnectedType.typeAttributes?.ordered;
                }
            } else {
                countOrigin.push(...countOriginDefault);
            }
        } else if (thingObject.data('level') === 'two') {
            if (sourceConnectedTypeIds.length === 1) {
                const sourceConnectedType = sourceConnectedTypeIds?.[0];
                countOrigin.push(i18n.__(`selector.contained`) + ' in ' + sourceConnectedType.typeAttributes.name);
                ordered = sourceConnectedType.typeAttributes?.ordered;
            } else {
                countOrigin.push(i18n.__(`selector.contained`) + ' in ' + i18n.__(`selector.contained`));
                ordered = sourceConnectedTypeIds.every(el => el.typeAttributes?.ordered);
            }
        }
    }

    const relationshipAttributesHeight = thing.pickedRelationships
        .reduce((accumulator, attribute, index) => {
            const relationshipCount = (countOrigin.length ? countOrigin : countOriginDefault)
                .map((el, i) => [i18n.__(`relationship.count`) +
                ' of ' + el, 'count' + i])
            const relationshipOneOptions = ['contains', 'contains_all']
                .map(el => [i18n.__(`relationship.${el}`), el]);
            const relationshipOnePointFiveOptions = ['first', 'last'].map(el => [i18n.__(`relationship.${el}`), el]);
            const relationshipTwoOptions = ['before', 'previous', 'adjacent', 'next', 'after']
                .map(el => [i18n.__(`relationship.${el}`), el]);
            const placeholder = [[i18n.__(`relationship.placeholder`), '']];


            const relationshipOptions = (() => {
                if (ordered) {
                    return relationshipOneOptions.concat([relationshipOnePointFiveOptions[0]],
                        relationshipTwoOptions, [relationshipOnePointFiveOptions[1]])
                } else {
                    return relationshipOneOptions;
                }
            })();

            let options = relationshipCount.concat(relationshipOptions);

            if (attribute.relationshipAttribute === '') {
                options = placeholder.concat(options);
            }

            const relationshipAttribute = NameValue(attribute.relationshipAttributeId, thing._id,
                relationshipAttributesObject,
                {
                    x: thingObject.bbox().x + constants.boxPadding,
                    y: 0
                },
                [
                    {
                        value: attribute.relationshipAttribute,
                        options: options,
                        readOnly: false,
                        type: 'select',
                        callback: (ev, val, nameValue) => {
                            changePickedRelationships.call({
                                relationshipAttributeId: nameValue.parent('.bbox').data('id'),
                                relationshipAttribute: val
                            })
                        }
                    }
                ], draggable
            );

            relationshipAttribute.parent('.bbox').dy(accumulator + constants.boxPadding);

            if (relationshipCount.concat(relationshipOneOptions, relationshipOnePointFiveOptions)
                .map(e => e[1]).includes(attribute.relationshipAttribute)) {
                relationshipAttribute.parent('.bbox').data('type', 'relationalSelector');
            } else if (relationshipTwoOptions.map(e => e[1]).includes(attribute.relationshipAttribute)) {
                relationshipAttribute.parent('.bbox').data('type', 'relationalTwoSelector');
            }

            let accHeight = relationshipAttribute.parent('.bbox').height();

            if (attribute.relationshipAttribute === 'contains' &&
                Array.isArray(attribute.relationshipAttributeRange)) {
                const containsSelector = NameValue(attribute.relationshipAttributeId, thing._id,
                    relationshipAttributesObject,
                    {
                        x: thingObject.bbox().x + constants.boxPadding,
                        y: 0
                    },
                    [{
                        value: attribute.relationshipAttributeRange[0] > -1 ?
                            attribute.relationshipAttributeRange[0] : 'unlimited',
                        readOnly: false,
                        type: typeof attribute.relationshipAttributeRange[0],
                        callback: (ev, val, nameValue) => {
                            if (Number.isNaN(val)) val = -1;
                            changePickedRelationshipsRange.call({
                                relationshipAttributeId: nameValue.parent('.bbox').data('id'),
                                relationshipAttributeRange: [val, attribute.relationshipAttributeRange[1]]
                            })
                        }
                    }, {
                        value: ' to ',
                        readOnly: true
                    }, {
                        value: attribute.relationshipAttributeRange[1] > -1 ?
                            attribute.relationshipAttributeRange[1] : 'unlimited',
                        readOnly: false,
                        type: typeof attribute.relationshipAttributeRange[1],
                        callback: (ev, val, nameValue) => {
                            if (Number.isNaN(val)) val = -1;
                            changePickedRelationshipsRange.call({
                                relationshipAttributeId: nameValue.parent('.bbox').data('id'),
                                relationshipAttributeRange: [attribute.relationshipAttributeRange[0], val]
                            })
                        }
                    }], draggable);

                containsSelector.parent('.bbox').dy(relationshipAttribute.parent('.bbox').bbox().y2 +
                    constants.boxPadding);
                accHeight += containsSelector.parent('.bbox').height() + constants.boxPadding;
            }

            return accumulator + accHeight + constants.boxPadding;
        }, relationshipAttributeBbox.bbox().y2);

    let attributeBoundingBox = relationshipAttributesObject.bbox();
    if (thing.pickedRelationships.length === 0) {
        attributeBoundingBox = relationshipAttributeBbox.bbox();
    }

    if (addable) {
        let addAttributeObject = relationshipAttributesObject.group();
        const circle = addAttributeObject.circle(constants.connectorDiameter)
            .x(attributeBoundingBox.x)
            .y(attributeBoundingBox.y2 + constants.padding)
            .fill('gray');
        createPlusInCircle(addAttributeObject, 'black', circle);

        if (draggable) {
            interact(addAttributeObject.node).on('down', (ev) => {
                if (ev.button === 0) {
                    addPickedRelationships.call({
                        id: thing._id
                    });
                    ev.preventDefault();
                }
            });
        }

        if (thing.pickedRelationships.length === 0) {
            addAttributeObject.dx(constants.boxPadding);
        }
    }

    createBoundingBox(relationshipAttributeBbox, relationshipAttributesObject.bbox(),
        constants.typeAttributeBboxColor, constants.typeAttributeBboxOpacity);

    return relationshipAttributeBbox;
}

const allowReverse = (instance) => {
    interact(instance.node).on('doubletap', (ev) => {
        if (ev.button === 0) {
            reverseConnectors.call({
                id: ev.currentTarget.instance.data('id'),
                reverseConnectors: !ev.currentTarget.instance.data('reverse-connectors')
            });
            ev.preventDefault();
        }
    });
}

const disableDrag = (ev) => {
    const drawRoot = ev.target?.instance?.root();
    if (drawRoot) {
        drawRoot.on('panbeforestart.solvedrag', (ev) => {
            ev.preventDefault();
        });
    }
}

const undisableDrag = (ev) => {
    const drawRoot = ev.target?.instance?.root();
    if (drawRoot) {
        drawRoot.off('.solvedrag');
    }
}

export const allowSolve = (instance, initEnabled = true) => {
    instance.addClass('solvable');

    instance.enableSolve = () => {
        if (hasPointerEvents()) {
            instance.node.addEventListener('pointerdown', disableDrag);
        } else {
            instance.node.addEventListener('touchstart', disableDrag);
        }
        interact(instance.node).draggable({
            inertia: true,
            onmove: (ev) => {
                // overlayCode here
                // console.log(ev)
            },
            onend: (ev) => {
                undisableDrag(ev);
            }
        })
    }

    instance.disableSolve = () => {
        if (hasPointerEvents()) {
            instance.node.removeEventListener('pointerdown', disableDrag);
        } else {
            instance.node.removeEventListener('touchstart', disableDrag);
        }
        interact(instance.node).draggable(false);
        disableDrag(instance.node);
    }

    if (initEnabled) {
        instance.enableSolve();
    }
}

export const Thing = (thing, parentSvg, mode, setHighlightObject) => {
    const draggable = mode === 'pan';
    const solvable = mode === 'solve';
    const resultPrototype = mode === 'result-proto';
    const result = mode === 'result';
    const addable = !(resultPrototype || result);

    if (!thing || !parentSvg) return;
    const thingObjectBbox = parentSvg.group();
    const thingObject = thingObjectBbox.group();

    thingObjectBbox.attr('id', thing._id);
    thingObjectBbox.data('id', thing._id);
    thingObjectBbox.addClass('thing');
    thingObjectBbox.addClass('bbox');
    thingObjectBbox.addClass(thing.type);
    thingObjectBbox.data('reverse-connectors', thing.reverseConnectors);
    thingObjectBbox.addClass(mode);

    thingObject.addClass('thing');
    thingObject.addClass(thing.type);
    thingObject.addClass('inner');

    const attachments = [];

    switch (thing.type) {
        case 'object':
        case 'container':
        case 'object_type':
        case 'container_type':
            /*
            1) create sketch and bbox with connectors (return sketch and no connector bbox)
            2) create each type attribute and bbox with connectors (return list of attributes and no connector bbox)
            3) create object attributes and bbox with connectors (return list and no connector bbox)
            4) create bounding box for thing by merging boxes
             */

            const sketch = Sketch(thing._id, thingObject, thing.paths);
            sketch.parent('.bbox').data('type', thing.type);
            if (!resultPrototype && !result) {
                attachments.push([sketch, {
                    instancesExpanded: thing.instancesExpanded
                }]);
            }

            if (!resultPrototype && !result && thing.type.includes('container')) {
                const repeatedAttributes = createRepeatedAttributes(thing, thingObject, draggable);
            }
            const typeAttributes = createTypeAttributes(thing, thingObject, draggable);
            const objectAttributes = createObjectAttributes(thing, thingObject, draggable, addable);
            if (!resultPrototype && !result && thing.type.includes('container')) {
                const relationshipAttributes = createRelationshipPicker(thing, thingObject, draggable, addable);
                if (!resultPrototype && !result && relationshipAttributes) {
                    relationshipAttributes?.find('.name-value.inner')?.forEach(el => {
                        attachments.push([el]);
                    });
                }
            }
            if (!resultPrototype && !result && objectAttributes) {
                objectAttributes.find('.name-value.inner').forEach(el => {
                    attachments.push([el]);
                });
            }

            if (!resultPrototype && !result && thing.outConnections?.instanceOf) {
                const hasInstance = Object.keys(thing.outConnections?.instanceOf ?? {}).find(el => {
                    const obj = Things.findOne(el);
                    return obj?.type.includes('type');
                });
                if (hasInstance) {
                    typeAttributes.find('.name-value.inner').forEach(el => {
                        attachments.push([el]);
                    });
                }
            }

            switch (thing.type) {
                case 'container':
                case 'container_type':
                    allowSolve(sketch.parent('.bbox'), solvable);
                    break;
            }

            break;
        case 'selector':
            // create selector title with picker
            // has incoming (from object type, container or container type) and outgoing (to representative) connectors

            // create attribute box with plus
            // each as outgoing selector
            // extra count as attribute

            // create relationship box with plus
            // contains has outgoing selector
            //

            const selector = createSelectorPicker(thing, thingObject, draggable);

            const selectorAttributes = createAttributePicker(thing, thingObject, draggable, addable);

            const selectorRelationships = createRelationshipPicker(thing, thingObject, draggable, addable);

            selector?.find('.name-value.inner')?.forEach(el => {
                attachments.push([el]);
            });

            selectorAttributes?.find('.name-value.inner')?.forEach(el => {
                attachments.push([el]);
            });

            selectorRelationships?.find('.name-value.inner')?.forEach(el => {
                attachments.push([el]);
            });

            break;
        case 'representative':
            // create representation title
            // has incoming (from selector) and outgoing as representative

            // create attribute box with plus

            // create relationship box with plus

            const representative = createRepresentativeTitle(thing, thingObject, draggable);

            if (thingObject.data('targetType') === 'container') {
                const representativeAttributes = createAttributePicker(thing, thingObject, draggable, addable);

                representativeAttributes?.find('.name-value.inner')?.forEach(el => {
                    attachments.push([el]);
                });

                const representativeRelationships = createRelationshipPicker(thing, thingObject, draggable, addable);

                representativeRelationships?.find('.name-value.inner')?.forEach(el => {
                    attachments.push([el]);
                });

            }

            representative?.find('.name-value.inner')?.forEach(el => {
                attachments.push([el]);
            });

            break;
        case 'value':
            //create value and bbox with connectors

            const value = NameValue(thing._id, undefined, thingObject, undefined, [
                {
                    value: thing.value,
                    size: 'normal',
                    type: 'float',
                    readOnly: false,
                    callback: (ev, val, nameValue, revert) => {
                        changeValue.call({
                            id: nameValue.parent('.bbox').data('id'),
                            value: val
                        }, (err, res) => {
                            if (err) {
                                revert();
                            }
                        });
                    }
                }
            ], draggable);

            value.parent('.bbox').data('type', 'value');

            attachments.push([value]);

            allowReverse(thingObjectBbox);

            break;
        case 'text':
            const text = NameValue(thing._id, undefined, thingObject, undefined, [
                {
                    value: thing.value,
                    size: 'normal',
                    type: 'text',
                    readOnly: false,
                    callback: (ev, val, nameValue) => {
                        changeText.call({
                            id: nameValue.parent('.bbox').data('id'),
                            text: val
                        })
                    }
                }
            ], draggable);

            text.parent('.bbox').data('type', 'value');

            attachments.push([text]);

            allowReverse(thingObjectBbox);

            break;
        case 'icon':
            const icon = createIcon(thing.icon, thingObject);
            switch (thing.icon) {
                case 'plus':
                case 'minus':
                case 'times':
                case 'divide':
                    icon.parent('.bbox').data('type', 'math');
                    break;
                case 'greaterThan':
                case 'greaterThanEqual':
                case 'lessThan':
                case 'lessThanEqual':
                case 'equals':
                case 'notEqual':
                case 'and':
                case 'or':
                case 'xor':
                case 'implication':
                    icon.parent('.bbox').data('type', 'modifier');
                    break;
                case 'not':
                    icon.parent('.bbox').data('type', 'notModifier');
                    break;
                case 'sum':
                case 'avg':
                case 'spread':
                case 'max':
                case 'min':
                case 'count':
                    icon.parent('.bbox').data('type', 'reducer');
                    allowReverse(thingObjectBbox);
                    allowSolve(thingObjectBbox, solvable);
                    break;
                case 'allDiff':
                    icon.parent('.bbox').data('type', 'difference');
                    allowReverse(thingObjectBbox);
                    break;
                case 'maximise':
                case 'minimise':
                    icon.parent('.bbox').data('type', 'optimiser');
                    allowReverse(thingObjectBbox);
                    break;
                default:
                    break;
            }

            attachments.push([icon]);

            break;
        default:
            break;
    }

    createBoundingBox(thingObjectBbox, thingObject.bbox(), constants.outerBboxColor,
        constants.outerBboxOpacity, constants.outerBoxPadding);

    if (attachments.length) {
        const connectorsGroup = thingObjectBbox.group();
        connectorsGroup.addClass('connectors');

        attachments.forEach(el => {
            createConnectorAttachments(connectorsGroup, thingObject.bbox(), el[0],
                Object.assign({
                    enabled: draggable,
                    reversed: thing.reverseConnectors,
                }, el[1]));
        });
    }

    if (thing.x === null || thing.y === null) {
        moveThings.call({id: thing._id, x: thingObjectBbox.bbox().x, y: thingObjectBbox.bbox().y, noUndo: true});
    }

    if (thing.x && thing.y) {
        thingObjectBbox.move(thing.x, thing.y);
    }

    thingObjectBbox.draggable(draggable);
    allowDelete(thingObjectBbox, deleteThing, thingObjectBbox, draggable);

    let pending = -1;

    thingObjectBbox.on('pointerdown', ev => {
        pending = -1;
    });

    thingObjectBbox.on('pointerenter', ev => {
        if (typeof setHighlightObject === 'function') {
            pending = Date.now();
            setTimeout(() => {
                if (pending > 0 && (Date.now() - pending) > 800) {
                    pending = -1;
                    setHighlightObject(prev => prev ? prev : thing._id);
                }
            }, 1000);
        }
    });

    thingObjectBbox.on('pointerleave', ev => {
        if (typeof setHighlightObject === 'function') {
            pending = -1;
            setHighlightObject(null);
        }
    });

    thingObjectBbox.on('pointercancel', ev => {
        if (typeof setHighlightObject === 'function') {
            pending = -1;
            setHighlightObject(null);
        }
    });

    //TODO move case for selector representative pair

    thingObjectBbox.on('dragend.dragging', _.debounce((ev) => {
        const el = ev.detail.handler;
        if (ev.detail.changed) moveThings.call({id: el.data('id'), x: el.x(), y: el.y()})
    }, 300));

    return thingObject;
}
