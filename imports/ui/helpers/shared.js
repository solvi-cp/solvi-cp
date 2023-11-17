export const combineCSS = (...args) => {
    return args.reduce(((previousValue, currentValue) => {
        if (currentValue) {
            return Object.assign({}, previousValue, currentValue)
        } else {
            return previousValue;
        }
    }))
}

export const touchWrapper = (ev, callback) => {
    if (ev.changedTouches) {
        for (let touch of ev.changedTouches) {
            callback(touch, getPointerId(ev), ev);
        }
    } else {
        callback(ev, getPointerId(ev));
    }
}

export const hasPointerEvents = () => {
    return (window.PointerEvent) || (window.navigator.pointerEnabled) || (window.navigator.msPointerEnabled)
}

export const getOffsetCoords = (ev, parentElement) => {
    return {
        x: ev.offsetX ? ev.offsetX : ev.pageX - parentElement.offsetLeft,
        y: ev.offsetY ? ev.offsetY : ev.pageY - parentElement.offsetTop
    }
}

export const getPointerId = (ev) => {
    return ev.pointerId ? ev.pointerId : ev.identifier;
};

export const dragDropGroupLookup = (type, reversed) => {
    switch (type) {
        case 'copy':
            return[undefined, undefined,{
                type: 'copy',
                group: 'type',
                connectorType: 'copy',
                positionX: 'right',
                positionY: 'middle'
            }]
        case 'object':
            return [{
                type: 'in',
                group: 'object',
                connectorType: 'putInto',
                positionX: 'left',
                positionY: 'middle'
            }, undefined, {
                type: 'out',
                group: 'object',
                connectorType: 'putInto',
                positionX: 'right',
                positionY: 'middle'
            }, undefined, {
                type: 'out',
                group: 'instance',
                connectorType: 'instanceOf',
                positionX: 'right',
                positionY: 'middle'
            }]
        case 'container':
            return [{
                type: 'in',
                group: 'object',
                connectorType: 'putInto',
                positionX: 'left',
                positionY: 'middle'
            }, undefined, {
                type: 'out',
                group: 'object',
                connectorType: 'putInto',
                positionX: 'right',
                positionY: 'middle'
            }, undefined, {
                type: 'out',
                group: 'instance',
                connectorType: 'instanceOf',
                positionX: 'right',
                positionY: 'middle'
            }, undefined, {
                type: 'out',
                group: 'selector',
                connectorType: 'prototype',
                positionX: 'right',
                positionY: 'middle'
            }]
        case 'object_type':
        case 'container_type':
            return [{
                type: 'in',
                group: 'object',
                connectorType: 'putInto',
                positionX: 'left',
                positionY: 'middle'
            }, undefined, {
                type: 'out',
                group: 'object',
                connectorType: 'putInto',
                positionX: 'right',
                positionY: 'middle'
            }, {
                type: 'in',
                group: 'instance',
                connectorType: 'instanceOf',
                positionX: 'left',
                positionY: 'middle'
            }, {
                type: 'out',
                group: 'instance',
                connectorType: 'instanceOf',
                positionX: 'right',
                positionY: 'middle'
            }, undefined, {
                type: 'out',
                group: 'selector',
                connectorType: 'prototype',
                positionX: 'right',
                positionY: 'middle'
            }]
        case 'selector':
            return [{
                type: 'in',
                group: 'selector',
                connectorType: 'prototype',
                positionX: 'left',
                positionY: 'middle'
            }, undefined, {
                type: 'out',
                group: 'representative',
                connectorType: 'prototype',
                positionX: 'right',
                positionY: 'middle'
            }]
        case 'representativeWithNext':
            return [{
                type: 'in',
                group: 'representative',
                connectorType: 'prototype',
                positionX: 'left',
                positionY: 'middle'
            }, undefined, {
                type: 'out',
                group: 'instance',
                connectorType: 'instanceOf',
                positionX: 'right',
                positionY: 'middle'
            }, undefined, {
                type: 'out',
                group: 'selector',
                connectorType: 'prototype',
                positionX: 'right',
                positionY: 'middle'
            }]
        case 'representative':
            return [{
                type: 'in',
                group: 'representative',
                connectorType: 'prototype',
                positionX: 'left',
                positionY: 'middle'
            }, undefined, {
                type: 'out',
                group: 'instance',
                connectorType: 'instanceOf',
                positionX: 'right',
                positionY: 'middle'
            }]
        case 'attribute':
            return [{
                type: 'in',
                group: ['value', 'modifier'],
                connectorType: 'assignment',
                positionX: 'left',
                positionY: 'middle'
            }, undefined]
        case 'attributeOnType':
            return [{
                type: 'in',
                group: ['value', 'modifier'],
                connectorType: 'assignment',
                positionX: 'left',
                positionY: 'middle'
            }, undefined, {
                type: 'out',
                group: 'collection',
                connectorType: 'aggregation',
                positionX: 'right',
                positionY: 'middle'
            }]
        case 'selectorAttribute':
            return [undefined, undefined, {
                type: 'out',
                group: 'modifier',
                connectorType: 'modifier',
                positionX: 'right',
                positionY: 'middle'
            }]
        case 'representativeAttribute':
            return [undefined, undefined, {
                type: 'out',
                group: 'modifier',
                connectorType: 'modifier',
                positionX: 'right',
                positionY: 'middle'
            }]
        case 'collection':
            return [undefined, undefined, {
                type: 'out',
                group: 'collection',
                connectorType: 'aggregation',
                positionX: 'right',
                positionY: 'middle'
            }]
        case 'value':
            return [undefined, undefined, {
                type: 'out',
                group: 'value',
                connectorType: 'assignment',
                positionX: reversed ? 'left' : 'right',
                positionY: 'middle'
            }]
        case 'reducer':
            return [{
                type: 'in',
                group: 'collection',
                connectorType: 'aggregation',
                positionX: reversed ? 'right' : 'left',
                positionY: 'middle'
            }, undefined, {
                type: 'out',
                group: 'modifier',
                connectorType: 'modifier',
                positionX: reversed ? 'left' : 'right',
                positionY: 'middle'
            }]
        case 'math':
            return [{
                type: 'in',
                group: ['modifier', 'value', 'instance'],
                connectorType: 'modifier',
                positionX: 'left',
                positionY: 'top'
            }, {
                type: 'in',
                group: ['modifier', 'value', 'instance'],
                connectorType: 'modifier',
                positionX: 'right',
                positionY: 'top'
            }, {
                type: 'out',
                group: 'modifier',
                connectorType: 'modifier',
                positionX: 'middle',
                positionY: 'bottom'
            }]
        case 'modifier':
            return [{
                type: 'in',
                group: ['modifier', 'value', 'instance'],
                connectorType: 'modifier',
                positionX: 'left',
                positionY: 'top'
            }, {
                type: 'in',
                group: ['modifier', 'value', 'instance'],
                connectorType: 'modifier',
                positionX: 'right',
                positionY: 'top'
            }, {
                type: 'out',
                group: 'modifier',
                connectorType: 'logical',
                positionX: 'middle',
                positionY: 'bottom'
            }]
        case 'relationalSelector':
            return [undefined, undefined, {
                type: 'out',
                group: 'modifier',
                connectorType: 'modifier',
                positionX: 'right',
                positionY: 'middle'
            }]
        case 'relationalTwoSelector':
            return [{
                type: 'in',
                group: 'instance',
                connectorType: 'modifier',
                positionX: 'left',
                positionY: 'middle'
            }, undefined, {
                type: 'out',
                group: 'modifier',
                connectorType: 'modifier',
                positionX: 'right',
                positionY: 'middle'
            }]
        case 'notModifier':
            return [{
                type: 'in',
                group: ['modifier', 'value'],
                connectorType: 'modifier',
                positionX: 'left',
                positionY: 'top'
            }, undefined, {
                type: 'out',
                group: 'modifier',
                connectorType: 'logical',
                positionX: 'middle',
                positionY: 'bottom'
            }]
        case 'difference':
            return [{
                type: 'in',
                group: 'collection',
                connectorType: 'aggregation',
                positionX: 'left',
                positionY: 'top'
            }, undefined, {
                type: 'out',
                group: 'modifier',
                connectorType: 'logical',
                positionX: 'middle',
                positionY: 'bottom'
            }]
        case 'optimiser':
            return [{
                type: 'in',
                group: 'modifier',
                connectorType: 'modifier',
                positionX: reversed ? 'right' : 'left',
                positionY: 'middle'
            }, undefined]
        default:
            return [];
    }
}

export const connectorTypeColor = (type) => {
    switch (type) {
        // objects
        case 'putInto':
            return '#ff4365';
        // instances:
        case 'instanceOf':
            return '#ff7700';
        // prototypes:
        case 'prototype':
        case 'selector':
        case 'representative':
            return '#ffdb99';
        // multiple
        case 'aggregation':
            return '#dfc116';
        // single
        case 'assignment':
        case 'modifier':
            return '#44af69';
        case 'logical':
            return '#3c91e6';
        case 'copy':
            return '#ffffff';
        default:
            return '#000000';
    }
}

export const typeBoxColor = (type) => {
    switch (type) {
        case 'object':
        case 'object_type':
            return '#f781bf';
        case 'container':
        case 'container_type':
            return '#984ea3';
        case 'selector':
            return '#a65628';
        case 'representative':
            return '#e5b395';
        default:
            return '#999999';
    }
}

export const connectorTypeDash = (type) => {
    switch (type) {
        case 'putInto':
            return 4;
        default:
            return 'none';
    }
}

export const angleToDirection = (angle) => {
    switch (angle) {
        case 0:
            return 'down';
        case 90:
            return 'left';
        case 270:
            return 'right';
    }
}

export const constants = {
    boxPadding: 4,
    boundingBoxCornerRadius: 10,
    padding: 10,
    boundingBoxMinimum: 20,
    sketchBoxMinimum: 100,

    draggingObjectRadius: 10,
    draggingObjectOpacity: 0,

    connectorDiameter: 20,
    connectorScale: 0.8,

    typeAttributeBboxColor: 'gray',
    typeAttributeBboxOpacity: 0.5,

    sketchLineColor: 'black',
    sketchLineWidth: 2,
    sketchBboxColor: 'gray',
    sketchBboxOpacity: 0.5,

    nameValueLineColor: 'black',
    nameValueLineWidth: 2,
    nameValueBboxColor: 'gray',
    nameValueBboxOpacity: 0.5,

    foreignObjectMaxWidth: 2000,
    foreignObjectMaxHeight: 2000,

    iconSize: 20,

    outerBboxColor: 'lightgray',
    outerBboxOpacity: 0.4,
    outerBoxPadding: 15
};

