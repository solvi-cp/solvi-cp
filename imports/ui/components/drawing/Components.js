import {
    faCopy, faDivide, faUpload,
    faEquals,
    faGreaterThan,
    faGreaterThanEqual,
    faLessThan,
    faLessThanEqual, faLongArrowAltRight, faMinus, faPlus, faTimes
} from "@fortawesome/free-solid-svg-icons";
import escape from "escape-html";
import {
    dragDropGroupLookup,
    connectorTypeColor,
    constants,
    connectorTypeDash,
    angleToDirection
} from "../../helpers/shared";
import {connectObjects} from "../../../api/connections/methods";
import {
    addAttribute,
    addPositionalAttribute,
    changeAttributeName,
    toggleInstancesExpansion,
    changePositionalAttribute,
    createInstances,
    addPrototypeAttribute,
    copyTypeAttribute,
    createSelector,
    createAndConnectValue,
    createAndConnectText,
    addAttributesAndValuesToLoad,
    changeTypeAttribute,
    removeAllAttributes
} from "../../../api/things/methods";
import interact from "interactjs";

import i18n from 'meteor/universe:i18n';
import {NameValue} from "./NameValue";
import {getDirectInstances, getObjectOnPosition} from "../../../utils/api";
import {Things} from "../../../api/things/collection";
import {faNotEqual} from "@fortawesome/free-solid-svg-icons/faNotEqual";
import {Box, Matrix} from "@svgdotjs/svg.js";

export const allowDelete = (instance, deleteCall, visualTarget, initEnabled = true) => {
    let animation = null;
    let startTime = null;
    let enabled = initEnabled;

    instance.enableDelete = () => {
        enabled = true;
    }

    instance.disableDelete = () => {
        enabled = false;
    }

    interact(instance.node).on('down', (ev) => {
        if (enabled && ev.button === 0 && !startTime) {
            startTime = ev.timeStamp;
            instance.root().on('panbeforestart.delete', (ev) => ev.preventDefault());
            instance.node.setPointerCapture(ev.pointerId);
            animation = visualTarget.animate({duration: 3000, when: 'now'}).ease('<>');
            animation.opacity(0);
        }
    });

    interact(instance.node).on('move', (ev) => {
        if (enabled && startTime && animation) {
            instance.root().off('.delete');
            instance.node.releasePointerCapture(ev.pointerId);
            startTime = null;
            animation.reverse();
            animation.finish();
        }
    });

    interact(instance.node).on(['up', 'cancel'], (ev) => {
        if (enabled && startTime && animation) {
            instance.root().off('.delete');
            instance.node.releasePointerCapture(ev.pointerId);
            startTime = null;
            animation.reverse();
            animation.finish();
        }
    });

    interact(instance.node).pointerEvents({holdDuration: 2800}).on('hold', (ev) => {
        if (enabled && startTime && (ev.timeStamp - startTime) > 2000) {
            ev.preventDefault();
            instance.root()?.off('.delete');
            instance.node.releasePointerCapture(ev.pointerId);
            deleteCall.call({id: ev.currentTarget.instance.data('id')});
            instance.remove();
            animation = null;
            startTime = null;
        }
    });
}

export const updateBoundingBoxWidth = (targetBbox) => {
    if (!targetBbox || targetBbox === targetBbox.root()) return;
    if (targetBbox.parent() === targetBbox.root()) {
        const width = targetBbox.findOne(':scope > .inner').bbox().width;
        targetBbox.findOne(':scope > rect').width(width + 2 * constants.outerBoxPadding);
        updateConnectors(targetBbox);
    } else {
        const width = targetBbox.find(':scope > .inner').reduce((acc, el) => {
            return Math.max(acc, el.bbox().width + 2 * constants.boxPadding);
        }, 0);
        targetBbox.findOne(':scope > rect').width(width);
        updateBoundingBoxWidth(targetBbox.parent('.bbox'));
    }
}

const updateConnectors = (targetObject) => {
    const reversed = targetObject.data('reverse-connectors');
    const targetInner = targetObject.findOne(':scope > .inner');
    const rightConnectors = targetObject.find(`:scope > .connectors > .connector[data-positionX="right"]`);
    const centerConnectors = targetObject.find(`:scope > .connectors > .connector[data-positionX="middle"]`);
    rightConnectors.forEach(con => {
        con.cx(targetInner.bbox().x2 + constants.outerBoxPadding);
        con.cons?.forEach(e => {
            e.update();
        })
    });
    centerConnectors.forEach(con => {
        con.cx(targetInner.bbox().cx);
        con.cons?.forEach(e => {
            e.update();
        })
    });
}

export const createBoundingBox = (parentSvg, boundingBox, color, opacity, padding = constants.boxPadding
    , minimum = constants.boundingBoxMinimum) => {
    if (!boundingBox) boundingBox = parentSvg.bbox();
    const width = Math.max(boundingBox.width, minimum);
    const height = Math.max(boundingBox.height, minimum);
    return parentSvg.rect(width + 2 * padding,
        height + 2 * padding)
        .center(boundingBox.cx, boundingBox.cy)
        .fill(color)
        .radius(constants.boundingBoxCornerRadius)
        .opacity(opacity)
        .back();
};

const polarToCart = (radius, angleRadians) => {
    return {
        x: radius * Math.sin(angleRadians),
        y: radius * Math.cos(angleRadians)
    }
}

const degreesToRadians = (degrees) => {
    return degrees * (Math.PI / 180);
}

export const createTriangleInCircle = (parentSvg, color, circle, angle = 0) => {
    const radius = constants.connectorDiameter / 2;
    const points = [];
    for (let i = 0; i < 360; i += (360 / 3)) {
        points.push(polarToCart(radius, degreesToRadians(i)));
    }
    const poly = parentSvg.polygon(points.map(el => `${el.x} ${el.y}`).join(','))
        .fill(color);
    poly.center(circle.cx(), circle.cy())
        .dy(poly.width() - poly.height())
        .rotate(angle, circle.cx(), circle.cy())
        .scale(constants.connectorScale, circle.cx(), circle.cy());
}

export const createPlusInCircle = (parentSvg, color, circle) => {
    const radius = constants.connectorDiameter / 2;
    parentSvg.line(0, 0, 0, constants.connectorDiameter)
        .cx(circle.cx())
        .cy(circle.cy())
        .stroke({color: color, opacity: 1, width: 2})
        .scale(constants.connectorScale, circle.cx(), circle.cy());
    parentSvg.line(-radius, 0, radius, 0)
        .cx(circle.cx())
        .cy(circle.cy())
        .stroke({color: color, opacity: 1, width: 2})
        .scale(constants.connectorScale, circle.cx(), circle.cy());
}

export const createMinusInCircle = (parentSvg, color, circle) => {
    const radius = constants.connectorDiameter / 2;
    parentSvg.line(-radius, 0, radius, 0)
        .cx(circle.cx())
        .cy(circle.cy())
        .stroke({color: color, opacity: 1, width: 2})
        .scale(constants.connectorScale, circle.cx(), circle.cy());
}

export const createSquareInCircle = (parentSvg, color, circle) => {
    const sideLength = constants.connectorDiameter / Math.sqrt(2);
    parentSvg.rect(sideLength, sideLength)
        .fill(color)
        .center(circle.cx(), circle.cy())
        .scale(constants.connectorScale, circle.cx(), circle.cy());
}

export const createUploadInCircle = (parentSvg, color, circle) => {
    const radius = constants.connectorDiameter / 2;
    parentSvg.path(faUpload.icon[4])
        .size(radius)
        .cx(circle.cx())
        .cy(circle.cy())
        .fill(color);
}

export const createCopyInCircle = (parentSvg, color, circle) => {
    const radius = constants.connectorDiameter / 2;
    parentSvg.path(faCopy.icon[4])
        .size(radius)
        .cx(circle.cx())
        .cy(circle.cy())
        .fill(color);
}

const getConnectorX = (parentBbox, targetElement, position) => {
    if (position === 'left') {
        return parentBbox.x - constants.outerBoxPadding;
    } else if (position === 'right') {
        return parentBbox.x2 + constants.outerBoxPadding;
    } else if (position === 'middle') {
        return targetElement.bbox().cx;
    }
}

const getConnectorY = (parentBbox, targetElement, position) => {
    if (position === 'top') {
        return parentBbox.y - constants.outerBoxPadding;
    } else if (position === 'bottom') {
        return parentBbox.y2 + constants.outerBoxPadding;
    } else if (position === 'middle') {
        return targetElement.bbox().cy;
    }
}

const getConnectorAngle = (type, positionX, positionY) => {
    if (positionY === 'middle') {
        if (type === 'in') {
            if (positionX === 'left') {
                return 270;
            } else if (positionX === 'right') {
                return 90;
            }
        } else if (type === 'out') {
            if (positionX === 'left') {
                return 90;
            } else if (positionX === 'right') {
                return 270;
            }
        }
    } else {
        return 0;
    }
}

export const createInstancesFromType = (id, target) => {
    const targetObject = target.parent(`.bbox[data-id="${id}"]`);
    const targetBbox = targetObject.bbox();

    createInstances.call({
        id: id,
        x: targetBbox.x,
        y: targetBbox.y,
        width: targetBbox.width,
        height: targetBbox.height
    });
}

export const createCopyConnector = (copyConnector, index, parentBbox, targetElement, positionX, positionY,
                                    connectorConfig, {enabled}) => {
    copyConnector.addClass('copy');
    copyConnector.addClass('connector');
    const boundingBox = targetElement.bbox();

    const circle = copyConnector.circle(constants.connectorDiameter)
        .center(getConnectorX(parentBbox, targetElement, positionX),
            getConnectorY(parentBbox, targetElement, positionY))
        .fill('gray')
        .forward();
    circle.dy((circle.height() + constants.boxPadding) * Math.floor((index - 1) / 2));

    createCopyInCircle(copyConnector, connectorTypeColor(connectorConfig.connectorType), circle);

    copyConnector.circle(constants.connectorDiameter + 5)
        .center(circle.cx(), circle.cy())
        .fill('white')
        .back();

    const listener = (ev) => {
        if (ev.button === 0) {
            copyTypeAttribute.call({
                id: targetElement.parent('.bbox').data('parentId'),
                copyName: targetElement.parent('.bbox').data('typeName')
            });
            ev.preventDefault();
        }
    }

    copyConnector.enable = () => {
        interact(copyConnector.node).on('down', listener);
    }

    copyConnector.disable = () => {
        interact(copyConnector.node).off('down', listener);
    }

    if (enabled) {
        copyConnector.enable();
    }

    copyConnector.data('parentId', targetElement.parent('.bbox').data('parentId'));
    copyConnector.data('copyName', targetElement.parent('.bbox').data('typeName'));
    copyConnector.data('type', connectorConfig.connectorType);
    copyConnector.data('position', index);
    copyConnector.data('positionX', connectorConfig.positionX);
    copyConnector.data('positionY', connectorConfig.positionY);
    copyConnector.data('direction', getConnectorAngle(connectorConfig.type, positionX, positionY));

    return copyConnector;
}

export const createInConnector = (inConnector, index, parentBbox, targetElement, positionX, positionY, connectorConfig,
                                  {enabled, instancesExpanded}) => {
    inConnector.addClass('in');
    inConnector.addClass('connector');
    const boundingBox = targetElement.bbox();

    const circle = inConnector.circle(constants.connectorDiameter)
        .center(getConnectorX(parentBbox, targetElement, positionX),
            getConnectorY(parentBbox, targetElement, positionY))
        .fill('gray')
        .forward();
    circle.dy((circle.height() + constants.boxPadding) * Math.floor(index / 2));
    if (connectorConfig.connectorType === 'instanceOf') {
        if (instancesExpanded) {
            createMinusInCircle(inConnector, connectorTypeColor(connectorConfig.connectorType), circle);
        } else {
            createPlusInCircle(inConnector, connectorTypeColor(connectorConfig.connectorType), circle);
        }
        interact(inConnector.node).on('down', (ev) => {
            if (ev.button === 0) {
                const id = ev.currentTarget.instance.data('parentId');
                if (!instancesExpanded && getDirectInstances(id).size === 0) {
                    createInstancesFromType(id, ev.currentTarget.instance);
                }
                toggleInstancesExpansion.call({
                    id: ev.currentTarget.instance.data('parentId'),
                    instancesExpanded: !instancesExpanded
                });
                ev.preventDefault();
            }
        });
    } else if (connectorConfig.connectorType === 'prototype') {
        createSquareInCircle(inConnector, connectorTypeColor(connectorConfig.connectorType), circle);
    } else {
        createTriangleInCircle(inConnector, connectorTypeColor(connectorConfig.connectorType), circle,
            getConnectorAngle(connectorConfig.type, positionX, positionY));
    }

    inConnector.circle(constants.connectorDiameter + 5)
        .center(circle.cx(), circle.cy())
        .fill('white')
        .back();

    inConnector.data('parentId', targetElement.parent('.bbox').data('id'));
    inConnector.dropTarget(enabled ? connectorConfig.group : false);
    inConnector.data('accepts', connectorConfig.group);
    inConnector.data('type', connectorConfig.connectorType);
    inConnector.data('position', index);
    inConnector.data('positionX', connectorConfig.positionX);
    inConnector.data('positionY', connectorConfig.positionY);
    inConnector.data('direction', getConnectorAngle(connectorConfig.type, positionX, positionY));

    inConnector.enable = () => {
        inConnector.dropTarget(connectorConfig.group);
    }

    inConnector.disable = () => {
        inConnector.dropTarget(false);
    }

    return inConnector;
}

export const createOutConnector = (outConnector, index, parentBbox, targetElement, positionX, positionY, connectorConfig,
                                   {enabled}) => {
    outConnector.addClass('out');
    outConnector.addClass('connector');
    const boundingBox = targetElement.bbox();

    let draggingObject;
    let draggingConnector;

    const circle = outConnector.circle(constants.connectorDiameter)
        .center(getConnectorX(parentBbox, targetElement, positionX),
            getConnectorY(parentBbox, targetElement, positionY))
        .fill('gray')
        .forward();
    circle.dy((circle.height() + constants.boxPadding) * Math.floor((index - 1) / 2));
    if (connectorConfig.connectorType === 'prototype') {
        createSquareInCircle(outConnector, connectorTypeColor(connectorConfig.connectorType), circle);
    } else {
        createTriangleInCircle(outConnector, connectorTypeColor(connectorConfig.connectorType), circle,
            getConnectorAngle(connectorConfig.type, positionX, positionY));
    }

    outConnector.circle(constants.connectorDiameter + 5)
        .center(circle.cx(), circle.cy())
        .fill('white')
        .back();

    outConnector.data('parentId', targetElement.parent('.bbox').data('id'));
    outConnector.dragSource(enabled ? connectorConfig.group : false);
    outConnector.data('provides', connectorConfig.group);
    outConnector.data('type', connectorConfig.connectorType);
    outConnector.data('position', index);
    outConnector.data('positionX', connectorConfig.positionX);
    outConnector.data('positionY', connectorConfig.positionY);
    outConnector.data('direction', getConnectorAngle(connectorConfig.type, positionX, positionY));

    outConnector.enable = () => {
        outConnector.dragSource(connectorConfig.group);
    }

    outConnector.disable = () => {
        outConnector.dragSource(false);
    }

    outConnector.on('dragdropstart.connect', ev => {
        const sourceReversed = outConnector.parent().hasClass('left');
        if (draggingObject) {
            draggingConnector.remove();
            draggingObject.remove();
        }
        draggingObject = outConnector.root().circle(constants.draggingObjectRadius)
            .move(ev.detail.x, ev.detail.y)
            .opacity(constants.draggingObjectOpacity);
        draggingConnector = outConnector.connectTo({
            marker: 'default',
            targetAttach: 'perifery',
            sourceAttach: 'perifery',
            color: connectorTypeColor(connectorConfig.connectorType),
            type: 'curved',
            dash: connectorTypeDash(connectorConfig.connectorType),
            sourceDirection: angleToDirection(outConnector.data('direction')),
            targetDirection: angleToDirection(outConnector.data('direction')),
        }, draggingObject);
    });
    outConnector.on('dragdropmove.connect', ev => {
        if (draggingObject) {
            const draw = draggingObject.root();
            const viewBox = draggingObject.root().viewbox();

            const borderX1 = viewBox?.x;
            const borderY1 = viewBox?.y;
            const borderX2 = viewBox?.x +
                draw.node.parentElement.parentElement.clientWidth;
            const borderY2 = viewBox?.y +
                draw.node.parentElement.parentElement.clientHeight;

            const buffer = 40;

            const moveLeft = ev.detail.x < borderX1 + buffer;
            const moveRight = ev.detail.x > borderX2 - buffer;
            const moveUp = ev.detail.y < borderY1 + buffer;
            const moveDown = ev.detail.y > borderY2 - buffer;

            if (moveLeft) {
                const box = new Box(viewBox).transform(new Matrix().translate(-buffer, 0));
                draw.fire('panmove', {event: ev, handler: this, viewbox: box});
            }
            if (moveRight) {
                const box = new Box(viewBox).transform(new Matrix().translate(buffer, 0));
                draw.fire('panmove', {event: ev, handler: this, viewbox: box});
            }
            if (moveUp) {
                const box = new Box(viewBox).transform(new Matrix().translate(0, -buffer));
                draw.fire('panmove', {event: ev, handler: this, viewbox: box});
            }
            if (moveDown) {
                const box = new Box(viewBox).transform(new Matrix().translate(0, buffer));
                draw.fire('panmove', {event: ev, handler: this, viewbox: box});
            }
            draggingObject.move(ev.detail.x, ev.detail.y);
        }
        draggingObject.fire('othermove');
    });
    outConnector.on('dragdropend.connect', ev => {
        if (draggingObject) {
            draggingConnector.remove();
            draggingObject.remove();
        }
        if (connectorConfig.connectorType === 'prototype') {
            const id = ev.currentTarget.instance.data('parentId');
            createSelector.call({
                id: id,
                x: ev.detail.x,
                y: ev.detail.y
            });
        }
    });
    outConnector.on('dragdropsuccess.connect', ev => {
        connectObjects.call({
                sourceId: outConnector.data("parentId"),
                destinationId: ev.detail.event.detail.handler.data("parentId"),
                sourcePosition: outConnector.data("position"),
                destinationPosition: ev.detail.event.detail.handler.data("position"),
                type: connectorConfig.connectorType,
                group: connectorConfig.group
            }, (err) => {
                if (err) console.error(err);
                if (err?.error) {
                    const error = outConnector.text(i18n.__(`ui.${err.error}`)).center(circle.cx(), circle.cy()).font({fill: '#ef233c'});
                    switch (connectorConfig.positionX) {
                        case 'left':
                            error.dx(-30 - error.bbox().width / 2);
                            break;
                        case 'middle':
                            error.dy(30);
                            break;
                        case 'right':
                            error.dx(30 + error.bbox().width / 2);
                            break;
                    }
                    error.animate(3000).opacity(0);
                    setTimeout(() => {
                        if (error) {
                            error.remove();
                        }
                    }, 3000);
                }
            }
        );
    });

    return outConnector;
}

export const createConnectorAttachments = (connectorGroup, parentBbox, targetElement,
                                           {
                                               enabled = true, reversed = false, instancesExpanded = false
                                           } =
                                               {
                                                   enabled: true, reversed: false, instancesExpanded: false
                                               }) => {
    const connectorConfig = dragDropGroupLookup(targetElement.parent('.bbox').data('type'), reversed);

    let connectors = [];

    if (!connectorConfig) return connectors;

    connectorConfig.forEach((connector, index) => {
        if (connector) {
            let con = connectorGroup.group();
            connectors.push(con);
            if (connector.type === 'in') {
                createInConnector(con, index, parentBbox, targetElement, connector.positionX, connector.positionY,
                    connector, {
                        enabled,
                        instancesExpanded
                    });
            } else if (connector.type === 'out') {
                createOutConnector(con, index, parentBbox, targetElement, connector.positionX, connector.positionY,
                    connector, {
                        enabled,
                        instancesExpanded
                    });
            } else if (connector.type === 'copy') {
                createCopyConnector(con, index, parentBbox, targetElement, connector.positionX, connector.positionY,
                    connector, {
                        enabled
                    });
            }
        }
    })
    return connectors;
}

export const createIcon = (iconType, parentSvg) => {
    const iconObject = parentSvg.group();
    let iconInner;
    switch (iconType) {
        case 'plus':
            iconInner = iconObject.path(faPlus.icon[4]);
            break;
        case 'minus':
            iconInner = iconObject.path(faMinus.icon[4]);
            break;
        case 'times':
            iconInner = iconObject.path(faTimes.icon[4]);
            break;
        case 'divide':
            iconInner = iconObject.path(faDivide.icon[4]);
            break;
        case 'greaterThan':
            iconInner = iconObject.path(faGreaterThan.icon[4]);
            break;
        case 'greaterThanEqual':
            iconInner = iconObject.path(faGreaterThanEqual.icon[4]);
            break;
        case 'lessThan':
            iconInner = iconObject.path(faLessThan.icon[4]);
            break;
        case 'lessThanEqual':
            iconInner = iconObject.path(faLessThanEqual.icon[4]);
            break;
        case 'equals':
            iconInner = iconObject.path(faEquals.icon[4]);
            break;
        case 'notEqual':
            iconInner = iconObject.path(faNotEqual.icon[4]);
            break;
        case 'implication':
            iconInner = iconObject.path(faLongArrowAltRight.icon[4]);
            break;
        default:
            iconInner = iconObject.text(escape(iconType)).font({
                size: constants.iconSize
            });
            break;
    }
    if (iconInner) iconInner.size(constants.iconSize);
    return iconObject;
}
