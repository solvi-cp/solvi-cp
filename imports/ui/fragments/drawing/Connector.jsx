import {Spring} from "@svgdotjs/svg.js";
import {connectorTypeColor, connectorTypeDash, angleToDirection, constants} from "../../helpers/shared";
import {NameValue} from "../../components/drawing/NameValue";
import {
    createBoundingBox,
    allowDelete,
    createMinusInCircle,
    createPlusInCircle, createConnectorAttachments
} from "../../components/drawing/Components";
import {deleteConnector} from "../../../api/connections/methods";
import {changeConnectorAttribute, toggleConnectorAttributeExpansion} from "../../../api/connections/methods";
import interact from "interactjs";
import i18n from 'meteor/universe:i18n';

const getConnectorPoints = (connector) => {
    const points = connector.computeConnectorCoordinates();
    return [
        {x: points[1][1], y: points[1][2]},
        {x: points[1][5], y: points[1][6]},
        {x: points[2][1], y: points[2][2]}
    ]
}

const createConnectorAttributes = (connection, connectorObject, draggable) => {

    const connectorAttributesObjectBbox = connectorObject.group();
    connectorAttributesObjectBbox.addClass('connector-attributes');
    connectorAttributesObjectBbox.addClass('bbox');

    const connectorAttributesObject = connectorAttributesObjectBbox.group();
    connectorAttributesObject.addClass('inner');

    const connectorType = NameValue(undefined, connection._id, connectorAttributesObject,
        {
            x: 0,
            y: 0
        },
        [{
            value: i18n.__(`connectorTypes.${connection.type}`),
            readOnly: true,
            size: 'large'
        }
        ], draggable);

    const connectorAttributesHeight = connection.connectorAttributesOrder.reduce((accumulator, attribute) => {
        const elements = [{
            value: i18n.__(`attributes.${attribute}`),
            readOnly: true
        }];
        if (connection.connectorAttributes[attribute] !== null)
            elements.push({
                value: ': ',
                readOnly: true
            });
        if (Array.isArray(connection.connectorAttributes[attribute])) {
            elements.push({
                    value: connection.connectorAttributes[attribute][0] > -1 ?
                        connection.connectorAttributes[attribute][0] : '_',
                    readOnly: false,
                    type: typeof connection.connectorAttributes[attribute][0],
                    callback: (ev, val, nameValue) => {
                        changeConnectorAttribute.call({
                            id: nameValue.parent('.bbox').data('parentId'),
                            connectorAttributeName: attribute,
                            value: [val, connection.connectorAttributes[attribute][1]]
                        })
                    }
                }, {
                    value: ' to ',
                    readOnly: true
                }, {
                    value: connection.connectorAttributes[attribute][1] > -1 ?
                        connection.connectorAttributes[attribute][1] : '_',
                    readOnly: false,
                    type: typeof connection.connectorAttributes[attribute][1],
                    callback: (ev, val, nameValue) => {
                        changeConnectorAttribute.call({
                            id: nameValue.parent('.bbox').data('parentId'),
                            connectorAttributeName: attribute,
                            value: [connection.connectorAttributes[attribute][0], val]
                        })
                    }
                }
            )
        } else if (connection.connectorAttributes[attribute] !== null) {
            elements.push({
                value: connection.connectorAttributes[attribute],
                readOnly: false,
                type: typeof connection.connectorAttributes[attribute],
                callback: (ev, val, nameValue) => {
                    changeConnectorAttribute.call({
                        id: nameValue.parent('.bbox').data('parentId'),
                        connectorAttributeName: attribute,
                        value: val
                    })
                }
            });
        }

        const connectorAttribute = NameValue(undefined, connection._id, connectorAttributesObject,
            {
                x: 0,
                y: 0
            },
            elements, draggable);

        connectorAttribute.parent('.bbox').dy(accumulator + constants.boxPadding * 2);
        return accumulator + connectorAttribute.parent('.bbox').height() + constants.boxPadding;
    }, connectorType.bbox().height + constants.boxPadding);

    createBoundingBox(connectorAttributesObjectBbox, connectorAttributesObject.bbox(),
        constants.typeAttributeBboxColor, constants.typeAttributeBboxOpacity);

    return connectorAttributesObject;
};

const leftCornerPin = (points) => {
    return (points[2].y - points[0].y) / (points[2].x - points[0].x) < 0;
}

const moveConnectorAttributes = (connector, connectorAttributes, connectorAttributesBbox) => {
    const points = getConnectorPoints(connector);

    const x = leftCornerPin(points) ? points[1].x : points[1].x - connectorAttributesBbox.width();
    const y = points[1].y;

    connectorAttributes.move(x, y);
}

export const getDirection = (connector) => {
    let angle = connector.data('direction');
    return angleToDirection(angle);
}

const MIN_SCALE = 0.00001;

export const Connector = (connection, parentSvg, mode) => {
    const draggable = mode === 'pan';
    const solvable = mode === 'solve';
    const resultPrototype = mode === 'result-proto';
    const result = mode === 'result';

    if (!connection || !parentSvg) return;
    const sourceConnector = parentSvg.findOne(
        `.connectors .out[data-parentId="${connection.sourceId}"][data-position="${
            connection.sourcePosition}"]`);
    const destinationConnector = parentSvg.findOne(
        `.connectors .in[data-parentId="${connection.destinationId}"][data-position="${
            connection.destinationPosition}"]`);
    const connectorObject = parentSvg.group();

    if (sourceConnector && destinationConnector) {
        const connector = sourceConnector.connectTo({
            container: connectorObject,
            markers: connectorObject,
            marker: 'default',
            targetAttach: 'perifery',
            sourceAttach: 'perifery',
            color: connectorTypeColor(connection.type),
            type: 'curved',
            dash: connectorTypeDash(connection.type),
            sourceDirection: getDirection(sourceConnector),
            targetDirection: getDirection(destinationConnector)
        }, destinationConnector);

        connector.connector.data('id', connection._id);
        connector.connector.data('type', connection.type);
        connector.connector.addClass('connector');
        connector.connector.addClass(connection.type);

        const connectorTouchTarget = sourceConnector.connectTo({
            container: connectorObject,
            markers: connectorObject,
            marker: 'null',
            targetAttach: 'perifery',
            sourceAttach: 'perifery',
            color: 'black',
            type: 'curved',
            sourceDirection: getDirection(sourceConnector),
            targetDirection: getDirection(destinationConnector)
        }, destinationConnector);

        connectorTouchTarget.connector.stroke({width: 50}).opacity(0);
        connectorTouchTarget.connector.data('id', connection._id);

        if (connection.connectorAttributesOrder.length) {
            const points = getConnectorPoints(connector);
            const connectorPin = connectorObject.group();
            connectorPin.data('id', connection._id);
            const connectorPinCircle = connectorPin.circle(constants.connectorDiameter)
                .center(points[1].x, points[1].y)
                .fill('gray')
                .forward();

            if (connection?.attributesExpanded) {
                createMinusInCircle(connectorPin, 'white', connectorPinCircle);
            } else {
                createPlusInCircle(connectorPin, 'white', connectorPinCircle);
            }

            const attachments = [];

            const connectorAttributes = createConnectorAttributes(connection, connectorObject, draggable);
            if (!resultPrototype && !result && connectorAttributes) {
                connectorAttributes.find('.name-value.inner.connectable').forEach(el => {
                    attachments.push([el]);
                });
            }
            const connectorAttributesParent = connectorAttributes.parent('.bbox');
            moveConnectorAttributes(connector, connectorAttributesParent,
                connectorAttributesParent);

            if (attachments.length) {
                const connectorsGroup = connectorAttributesParent.group();
                connectorsGroup.addClass('connectors');

                attachments.forEach(el => {
                    createConnectorAttachments(connectorsGroup, connectorAttributes.bbox(), el[0],
                        Object.assign({
                            enabled: draggable
                        }, el[1]));
                })
            }

            if (!connection?.attributesExpanded) {
                const scaleOrigin = [leftCornerPin(points) ? connectorAttributesParent.bbox().x :
                    connectorAttributesParent.bbox().x2,
                    connectorAttributesParent.bbox().y];
                connectorAttributesParent
                    .transform({scale: MIN_SCALE, origin: scaleOrigin});
            }

            interact(connectorPin.node).on('down', (ev) => {
                if (ev.button === 0) {
                    const points = getConnectorPoints(connector);
                    const scaleOrigin = [leftCornerPin(points) ? connectorAttributesParent.bbox().x :
                        connectorAttributesParent.bbox().x2,
                        connectorAttributesParent.bbox().y];
                    connectorAttributesParent.animate(1000).ease('<>').transform({
                        scale: connection?.attributesExpanded ? MIN_SCALE : 1,
                        origin: scaleOrigin
                    }).after(() => {
                        toggleConnectorAttributeExpansion.call({
                            id: ev.currentTarget.instance.data('id'),
                            attributesExpanded: !connection?.attributesExpanded
                        });
                    });
                }
            });

            const spring = new Spring(300);
            const connectorAttributeAnimation = connectorAttributesParent.animate(spring);
            connector.setCallback((con) => {
                const points = getConnectorPoints(connector);
                connectorPin.center(points[1].x, points[1].y);
                moveConnectorAttributes(connector, connectorAttributeAnimation,
                    connectorAttributesParent);
            });
        }
        allowDelete(connectorTouchTarget.connector, deleteConnector, connectorObject);
    } else if (sourceConnector || destinationConnector) {
        let sourceConnectorStub = sourceConnector ?? destinationConnector.parent().findOne(
            `.stub[data-parentId="${connection.sourceId}"][data-position="${
                connection.sourcePosition}"]`);
        let destinationConnectorStub = destinationConnector ?? sourceConnector.parent().findOne('.stub');


        if (!sourceConnectorStub) {
            const destinationConnectorBbox = destinationConnector.bbox();
            const stubConnector = destinationConnector.parent().group();
            sourceConnectorStub = stubConnector.circle(constants.connectorDiameter)
                .center(destinationConnectorBbox.cx, destinationConnectorBbox.cy)
                .opacity(0);
            if (destinationConnector.data('positionX') === 'left') {
                sourceConnectorStub.dx(-constants.connectorDiameter * 3)
            } else if (destinationConnector.data('positionX') === 'right') {
                sourceConnectorStub.dx(constants.connectorDiameter * 3);
            } else if (destinationConnector.data('positionX') === 'middle') {
                sourceConnectorStub.dy(constants.connectorDiameter * 3);
            }
            sourceConnectorStub.addClass('stub');
            sourceConnectorStub.data('parentId', destinationConnector.data('parentId'));
            sourceConnectorStub.data('position', destinationConnector.data('position'));
            sourceConnectorStub.data('direction', destinationConnector.data('direction'));
        }

        if (!destinationConnectorStub) {
            const sourceConnectorBbox = sourceConnector.bbox();
            const stubConnector = sourceConnector.parent().group();
            destinationConnectorStub = stubConnector.circle(constants.connectorDiameter)
                .center(sourceConnectorBbox.cx, sourceConnectorBbox.cy)
                .opacity(0);
            if (sourceConnector.data('positionX') === 'left') {
                destinationConnectorStub.dx(-constants.connectorDiameter * 3)
            } else if (sourceConnector.data('positionX') === 'right') {
                destinationConnectorStub.dx(constants.connectorDiameter * 3);
            } else if (sourceConnector.data('positionX') === 'middle') {
                destinationConnectorStub.dy(constants.connectorDiameter * 3);
            }
            destinationConnectorStub.addClass('stub');
            destinationConnectorStub.data('parentId', sourceConnector.data('parentId'));
            destinationConnectorStub.data('position', sourceConnector.data('position'));
            destinationConnectorStub.data('direction', sourceConnector.data('direction'));
        }

        const connector = sourceConnectorStub.connectTo({
            container: connectorObject,
            markers: connectorObject,
            marker: 'default',
            targetAttach: 'perifery',
            sourceAttach: 'perifery',
            color: connectorTypeColor(connection.type),
            type: 'curved',
            dash: connectorTypeDash(connection.type),
            sourceDirection: getDirection(sourceConnectorStub),
            targetDirection: getDirection(destinationConnectorStub)
        }, destinationConnectorStub);

        connector.connector.data('id', connection._id);
        connector.connector.data('type', connection.type);
        connector.connector.addClass('connector-stub');
        connector.connector.addClass(connection.type);
    }
    return connectorObject;
}