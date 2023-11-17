import React, {useRef, useState, useMemo, useEffect, useCallback, useLayoutEffect} from 'react';
import {SVG, on, off, Spring} from '@svgdotjs/svg.js';
import {_} from 'meteor/underscore';
import '../../utils/svg.interaction.js';

import {Thing, allowSolve} from "../fragments/drawing/Thing";
import {Connector} from "../fragments/drawing/Connector";

import {diff} from 'deep-object-diff';

import {createThings, createText, createValue, createIcon, deleteThing} from "../../api/things/methods";
import {setViewbox, setZoom} from "../../api/ui/methods";
import {getTypeInstances, getAllConnectedUpstream} from "../../utils/api";

import {
    allowDelete
} from "../components/drawing/Components";

const styles = {
    canvas: {
        height: '100vh',
        width: '100vw',
        touchAction: 'none'
    }
};

const overlayBorderStyles = ({top, right, bottom, left}) => {
    const style = {};
    const border = 'gray 3px dotted'
    if (top && bottom) {
        style.height = 'calc(100% - 6px)';
    } else if (bottom) {
        style.height = 'calc(100% - 3px)';
    } else {
        style.height = '100%';
    }
    if (top) {
        style.borderTop = border;
    }
    if (right) {
        style.borderRight = border;
    }
    if (bottom) {
        style.borderBottom = border;
    }
    if (left) {
        style.borderLeft = border;
    }
    return style;
}

const Drawing = (props) => {

    const activeDrawing = useRef([]);

    const canvasRef = useRef(null);
    const draw = useRef(null);
    const drawSpring = useRef(null);

    const [renderedThings, setRenderedThings] = useState([]);
    const [renderedConnections, setRenderedConnections] = useState([]);
    const [isDraggable, setIsDraggable] = useState(props.state.Ui?.mode === "pan");
    const [isEditable, setIsEditable] = useState(props.state.Ui?.mode === "pan");

    const [windowDim, setWindowDim] = useState({width: window.innerWidth, height: window.innerHeight});
    const [outsideOverlay, setOutsideOverlay] = useState({
        top: false, right: false,
        bottom: false, left: false
    });

    useEffect(() => {
        draw.current = SVG().addTo(canvasRef.current).size('100%', '100%');
        const spring = new Spring(300, 3);
        drawSpring.current = draw.current.animate(spring);
    }, []);

    const disableAllInputs = () => {
        const spans = canvasRef.current.querySelectorAll("span.editable");
        const selects = canvasRef.current.querySelectorAll("select.editable");
        const connectors = canvasRef.current.querySelectorAll(".connector");

        Array.from(spans).forEach(el => {
            el.setAttribute("contenteditable", "false");
        });

        Array.from(selects).forEach(el => {
            el.setAttribute("disabled", "");
        });

        Array.from(connectors).forEach(el => {
            if (typeof el.instance.disable === 'function') {
                el.instance.disable();
            }
        });

        setIsEditable(false);
    }

    const enableAllInputs = () => {
        const spans = canvasRef.current.querySelectorAll("span.editable");
        const selects = canvasRef.current.querySelectorAll("select.editable");
        const connectors = canvasRef.current.querySelectorAll(".connector");

        Array.from(spans).forEach(el => {
            el.setAttribute("contenteditable", "true");
        });

        Array.from(selects).forEach(el => {
            el.removeAttribute("disabled");
        });

        Array.from(connectors).forEach(el => {
            if (typeof el.instance.enable === 'function') {
                el.instance.enable();
            }
        });

        setIsEditable(true);
    }

    const disableAllSolve = () => {
        const solvables = canvasRef.current.getElementsByClassName('solvable');

        Array.from(solvables).forEach(el => {
            el.instance.disableSolve();
        });
    }

    const enableAllSolve = () => {
        const solvables = canvasRef.current.getElementsByClassName('solvable');

        Array.from(solvables).forEach(el => {
            el.instance.enableSolve();
        });
    }

    useEffect(() => {
        draw.current.off('.props');
        draw.current.clickable(false);
        draw.current.pannable(false);
        draw.current.drawable(false);
        disableAllSolve();
        switch (props.state.Ui?.mode) {
            case 'pan':
            case 'solve':
                draw.current.pannable(true);
                let panning  = false;
                let clicking = false;
                if (props.state.Ui?.mode === "pan" && (props.state.Ui?.viewbox?.zoom ?? 1) >= 1) {
                    if (!isEditable) enableAllInputs();
                    if (!isDraggable) {
                        for (let i = 0; i < renderedThings.length; i++) {
                            renderedThings[i].draggable(true);
                            if (typeof renderedThings[i].enableDelete === 'function') {
                                renderedThings[i].enableDelete();
                            }
                            if (typeof renderedThings[i].disableSolve === 'function') {
                                renderedThings[i].disableSolve();
                            }
                        }
                        setIsDraggable(true);
                    }
                } else {
                    if ((props.state.Ui?.viewbox?.zoom ?? 1) < 1) {
                        draw.current.clickable(true);
                        draw.current.on('clickend.props', (ev) => {
                            if (!panning) {
                                clicking = true;
                                setViewbox.call({x: ev.detail.x - 300, y: ev.detail.y - 300});
                                setZoom.call({zoom: 1});
                            }
                        });
                    }
                    if (isEditable) disableAllInputs();
                    enableAllSolve();
                    if (isDraggable) {
                        for (let i = 0; i < renderedThings.length; i++) {
                            renderedThings[i].draggable(false);
                            if (typeof renderedThings[i].enableSolve === 'function') {
                                renderedThings[i].enableSolve();
                            }
                            if (typeof renderedThings[i].disableDelete === 'function') {
                                renderedThings[i].disableDelete();
                            }
                        }
                        setIsDraggable(false);
                    }
                }
                draw.current.on('panmove.props', (ev) => {
                    drawSpring.current.viewbox(ev.detail.viewbox);
                    panning = true;
                });
                draw.current.on('panend.props', _.debounce((ev) => {
                    if (!clicking) {
                        setViewbox.call({x: ev.detail.handler.viewbox().x, y: ev.detail.handler.viewbox().y});
                    }
                    panning = false;
                    clicking = false;
                }, 300));
                break;
            case 'draw':
                if (isEditable) disableAllInputs();
                if (isDraggable) {
                    for (let i = 0; i < renderedThings.length; i++) {
                        renderedThings[i].draggable(false);
                        if (typeof renderedThings[i].disableDelete === 'function') {
                            renderedThings[i].disableDelete();
                        }
                        if (typeof renderedThings[i].disableSolve === 'function') {
                            renderedThings[i].disableSolve();
                        }
                    }
                    setIsDraggable(false);
                }
                draw.current.drawable(true);
                draw.current.on('drawend.props', (ev) => {
                    activeDrawing.current.push(ev.detail.path.svg);
                });
                break;
            case 'number':
                if (isEditable) disableAllInputs();
                if (isDraggable) {
                    for (let i = 0; i < renderedThings.length; i++) {
                        renderedThings[i].draggable(false);
                        if (typeof renderedThings[i].disableDelete === 'function') {
                            renderedThings[i].disableDelete();
                        }
                        if (typeof renderedThings[i].disableSolve === 'function') {
                            renderedThings[i].disableSolve();
                        }
                    }
                    setIsDraggable(false);
                }
                draw.current.clickable(true);
                draw.current.on('clickend.props', (ev) => {
                    createValue.call({x: ev.detail.x, y: ev.detail.y})
                });
                break;
            case 'string':
                if (isEditable) disableAllInputs();
                if (isDraggable) {
                    for (let i = 0; i < renderedThings.length; i++) {
                        renderedThings[i].draggable(false);
                        if (typeof renderedThings[i].disableDelete === 'function') {
                            renderedThings[i].disableDelete();
                        }
                        if (typeof renderedThings[i].disableSolve === 'function') {
                            renderedThings[i].disableSolve();
                        }
                    }
                    setIsDraggable(false);
                }
                draw.current.clickable(true);
                draw.current.on('clickend.props', (ev) => {
                    createText.call({x: ev.detail.x, y: ev.detail.y})
                });
                break;
            case 'plus':
            case 'minus':
            case 'times':
            case 'divide':
            case 'greaterThan':
            case 'greaterThanEqual':
            case 'lessThan':
            case 'lessThanEqual':
            case 'equals':
            case 'notEqual':
            case 'and':
            case 'or':
            case 'xor':
            case 'not':
            case 'implication':
            case 'sum':
            case 'avg':
            case 'spread':
            case 'median':
            case 'max':
            case 'min':
            case 'count':
            case 'allDiff':
            case 'maximise':
            case 'minimise':
                if (isEditable) disableAllInputs();
                if (isDraggable) {
                    for (let i = 0; i < renderedThings.length; i++) {
                        renderedThings[i].draggable(false);
                        if (typeof renderedThings[i].disableDelete === 'function') {
                            renderedThings[i].disableDelete();
                        }
                        if (typeof renderedThings[i].disableSolve === 'function') {
                            renderedThings[i].disableSolve();
                        }
                    }
                    setIsDraggable(false);
                }
                draw.current.clickable(true);
                draw.current.on('clickend.props', (ev) => {
                    createIcon.call({
                        icon: props.state.Ui.mode,
                        x: ev.detail.x,
                        y: ev.detail.y
                    })
                });
                break;
            default:
                break;
        }
    }, [props.state.Ui?.mode, props.state.Ui?.viewbox?.zoom, renderedThings, isEditable, isDraggable]);

    useEffect(() => {
        if (props.state.Ui?.previousMode === 'draw') {
            if (activeDrawing.current.length > 0) {
                createThings.call({paths: activeDrawing.current});
            }
            activeDrawing.current = [];
            const paths = draw.current.children().filter(a => a.type === "path");
            for (let i = 0; i < paths.length; i++) {
                paths[i].remove();
            }
        }
    }, [props.state.Ui?.mode, props.state.Ui?.previousMode]);

    const viewboxJSON = useMemo(() => JSON.stringify(props.state.Ui?.viewbox), [props.state.Ui?.viewbox]);

    const calcOutside = (things, hidden, props, draw, partial = false) => {
        const outsideOverlayCurrent = {
            top: false, right: false,
            bottom: false, left: false
        }

        things.forEach((thing) => {
            if (!hidden.includes(thing._id)) {
                const thingObj = draw.current.findOne(`[id="${thing._id}"]`);
                if (partial) {
                    if (thing.x + (thingObj?.width() ?? 0) < props.state.Ui.viewbox?.x) {
                        outsideOverlayCurrent.left = true;
                    }
                    if (thing.y + (thingObj?.height() ?? 0) < props.state.Ui.viewbox?.y) {
                        outsideOverlayCurrent.top = true;
                    }
                    if (thing.x > props.state.Ui.viewbox?.x +
                        draw.current.node.parentElement.parentElement.clientWidth) {
                        outsideOverlayCurrent.right = true;
                    }
                    if (thing.y > props.state.Ui.viewbox?.y +
                        draw.current.node.parentElement.parentElement.clientHeight) {
                        outsideOverlayCurrent.bottom = true;
                    }
                } else {
                    if (thing.x < props.state.Ui.viewbox?.x) {
                        outsideOverlayCurrent.left = true;
                    }
                    if (thing.y < props.state.Ui.viewbox?.y) {
                        outsideOverlayCurrent.top = true;
                    }
                    if (thing.x + (thingObj?.width() ?? 0) > props.state.Ui.viewbox?.x +
                        draw.current.node.parentElement.parentElement.clientWidth) {
                        outsideOverlayCurrent.right = true;
                    }
                    if (thing.y + (thingObj?.height() ?? 0) > props.state.Ui.viewbox?.y +
                        draw.current.node.parentElement.parentElement.clientHeight) {
                        outsideOverlayCurrent.bottom = true;
                    }
                }
            }
        });
        return outsideOverlayCurrent;
    }

    const getHidden = (props) => {
        const unexpandedTypes = props.state.Things.filter((thing) =>
            thing.type.includes('type') && !thing?.instancesExpanded);
        const hiddenInstances = unexpandedTypes.flatMap(el =>
            Array.from(getTypeInstances(el._id))
        );
        return hiddenInstances.flatMap(el =>
            [el._id, ...getAllConnectedUpstream(el._id)]
        );
    }

    useEffect(() => {
        if (props.state.Ui?.viewbox) {
            drawSpring.current.viewbox(props.state.Ui.viewbox?.x, props.state.Ui.viewbox?.y,
                draw.current.node.clientWidth * (1 / props.state.Ui.viewbox?.zoom ?? 1),
                draw.current.node.clientHeight * (1 / props.state.Ui.viewbox?.zoom ?? 1));
        }
    }, [viewboxJSON, windowDim]);

    useEffect(() => window.addEventListener('resize', ev => {
        setWindowDim({width: window.innerWidth, height: window.innerHeight});
    }), []);

    const usePrevious = value => {
        const ref = useRef();
        useEffect(() => {
            const parsedRef = ref.current ? JSON.parse(ref.current) : null;
            const parsedVal = value ? JSON.parse(value) : null;
            if (parsedRef && parsedVal) {
                const diffedObject = diff(parsedVal, parsedRef);
                if (diffedObject && Object.keys(diffedObject).length === parsedRef.length && diffedObject[0] &&
                    Object.keys(diffedObject[0]).length === 1 && diffedObject[0].updateTime) {
                    return;
                }
            }
            ref.current = value;
        });
        return ref.current;
    }

    const thingsJSON = useMemo(() => {
            if (props.state.loaded) {
                return JSON.stringify(props.state.Things)
            }
        },
        [props.state.Things, props.state.loaded]);

    const prevThingsJSON = usePrevious(thingsJSON);

    const connectionsJSON = useMemo(() => {
            if (props.state.loaded) {
                return JSON.stringify(props.state.Connections)
            }
        },
        [props.state.Connections, props.state.loaded]);

    const renderSvg = useCallback(_.debounce((draw, props) => {
        draw.current.clear();

        const hiddenObjects = getHidden(props);
        let newRenderedThings = [];
        props.state.Things.forEach((thing) => {
            if (!hiddenObjects.includes(thing._id)) {
                const rendered = Thing(thing, draw.current, props.state.Ui?.mode, props.setHighlightObject);
                if (rendered) {
                    newRenderedThings.push(rendered.parent('.bbox'));
                }
            }
        });
        setRenderedThings(newRenderedThings);

        renderedConnections.forEach(el => el.remove());
        let newRenderedConnections = [];
        props.state.Connections.forEach((connection) => {
            const rendered = Connector(connection, draw.current, props.state.Ui?.mode);
            if (rendered) {
                newRenderedConnections.push(rendered);
            }
        });
        setRenderedConnections(newRenderedConnections);

        props.overlayDispatch({type: 'removeRender', payload: 'drawing'});
    }, 1000), [renderedThings, renderedConnections]);

    const renderSingleThing = useCallback(_.debounce((draw, props, thing) => {
        draw.current.findOne(`.bbox[data-id="${thing._id}"]`)?.remove();

        const hiddenObjects = getHidden(props);
        let newRenderedThings = renderedThings;
        if (!hiddenObjects.includes(thing._id)) {
            const rendered = Thing(thing, draw.current, props.state.Ui?.mode, props.setHighlightObject);
            if (rendered) {
                newRenderedThings = newRenderedThings.filter(el => el._id !== thing._id);
                newRenderedThings.push(rendered.parent('.bbox'));
            }
        }
        setRenderedThings(newRenderedThings);

        renderedConnections.forEach(el => el.remove());
        let newRenderedConnections = [];
        props.state.Connections.forEach((connection) => {
            const rendered = Connector(connection, draw.current, props.state.Ui?.mode);
            if (rendered) {
                newRenderedConnections.push(rendered);
            }
        });
        setRenderedConnections(newRenderedConnections);

        props.overlayDispatch({type: 'removeRender', payload: 'drawing'});
    }, 1000), [renderedThings, renderedConnections]);

    useEffect(() => {
        //Only one Thing update. We're going to only draw the one Thing.
        if (typeof props.overlayState.rendering[0] === "object") {
            props.setHighlightObject(null);
            renderSingleThing(draw, props, props.overlayState.rendering[0].key);
        } else if (props.overlayState.rendering.includes('drawing')) {
            props.setHighlightObject(null);
            renderSvg(draw, props);
        }
    }, [props.overlayState.rendering]);

    useEffect(() => {
        const hiddenObjects = getHidden(props);
        setOutsideOverlay(calcOutside(props.state.Things, hiddenObjects, props, draw));
    }, [viewboxJSON, windowDim, props.overlayState.rendering])

    //changes to update and create time don't matter. Remove them.
    const pruneDiffObject = diffObject => {
        for (const [key, value] of Object.entries(diffObject)) {
            if (value && value.createTime) {
                delete value.createTime;
            }
            if (value && value.updateTime) {
                delete value.updateTime;
            }
        }
    }

    useEffect(() => {
        const parsedThings = thingsJSON ? JSON.parse(thingsJSON) : null;
        const parsedPrevThings = prevThingsJSON ? JSON.parse(prevThingsJSON) : null;

        //solvi has underwent first load
        if (parsedThings && !parsedPrevThings) {
            props.overlayDispatch({type: 'addRender', payload: 'drawing'});
            return;
        }
        //slate was cleared
        if (parsedThings && parsedPrevThings && parsedThings.length === 0 && parsedPrevThings.length !== 0) {
            setRenderedThings([]);
            props.overlayDispatch({type: 'addRender', payload: 'drawing'});
            return;
        }

        //one Thing deleted. For now total redraw.
        if (parsedThings && parsedPrevThings && parsedThings.length === parsedPrevThings.length - 1) {
            props.overlayDispatch({type: 'addRender', payload: 'drawing'});
            return;
        }

        //diff the previous things and the new things to decide what we are redrawing
        let diffedObject = null;
        if (parsedThings && parsedPrevThings) {
            diffedObject = diff(parsedThings, parsedPrevThings);
        }

        //get rid of update/create time as they shouldn't trigger a redraw.
        if (diffedObject !== null) pruneDiffObject(diffedObject);

        //nothing changed Things wise, just return
        if (diffedObject && Object.keys(diffedObject).length === 0 && parsedThings && parsedPrevThings) {
            return;
        }

        //New Thing(s)
        if (parsedThings && parsedPrevThings && parsedThings.length !== parsedPrevThings.length) {
            const keys = Object.keys(parsedThings)
            if (keys.length === parsedPrevThings.length + 1) {
                props.overlayDispatch({
                    type: 'addRender', payload: {
                        key: parsedThings[keys[keys.length - 1]],
                        doing: "drawing"
                    }
                });
            } else {
                props.overlayDispatch({type: 'addRender', payload: 'drawing'});
            }
            return;
        } else if (!parsedThings || !parsedPrevThings) {
            return;
        }

        //if we're here, only one Thing was modified (ignoring CSV func. as of now)
        let diffedObjectKey = Object.keys(diffedObject)[0];
        //a few different checks below, kept in seperate if's for cleanness
        if (diffedObject[diffedObjectKey] && Object.keys(diffedObject[diffedObjectKey]).length === 0) {
            return;
        }
        if ((!parsedThings && !parsedPrevThings && !diffedObject) || (diffedObject && diffedObject[diffedObjectKey] &&
            (diffedObject[diffedObjectKey].x || diffedObject[diffedObjectKey].y))) {
            return;
        } else if (diffedObject && diffedObject[diffedObjectKey] && diffedObject[diffedObjectKey].typeAttributes) {
            if (diffedObject[diffedObjectKey].typeAttributes.ordered ||
                diffedObject[diffedObjectKey].typeAttributes.ordered === false ||
                diffedObject[diffedObjectKey].typeAttributes.name) {
                props.overlayDispatch({
                    type: 'addRender', payload: {
                        key: parsedThings[diffedObjectKey],
                        doing: "drawing"
                    }
                });
            }
            return;
        }

        //x and y is updated later in creation of the Thing, so if we're here and the diffedObject has x and y null,
        // that means all that has happened is a db update on those two variables
        if (diffedObject && diffedObject[diffedObjectKey].x === null && diffedObject[diffedObjectKey].y === null) {
            return;
        }


        if (diffedObject) {
            //check to see if attribute changes were made.
            let foundAttributeUpdate = false;
            let indivKey = null;
            let foundMultipleAttributeUpdate = false;
            for (const [key, value] of Object.entries(diffedObject)) {
                if (diffedObject[key] && diffedObject[key].attributes) {
                    if (foundAttributeUpdate) {
                        //if we've found an attribute again, means an object group is being updated.
                        foundMultipleAttributeUpdate = true;
                    } else {
                        foundAttributeUpdate = true;
                        indivKey = key;
                    }
                }
            }
            //one or more (in case of object groups) of the Things had an attribute update
            if (foundMultipleAttributeUpdate) {
                //if an object group is getting an attribute, simplify the problem and just rerender all
                props.overlayDispatch({type: 'addRender', payload: 'drawing'});
                return;
            } else if (foundAttributeUpdate) {
                //only one object updated, redraw it
                props.overlayDispatch({type: 'addRender', payload: {key: parsedThings[indivKey], doing: "drawing"}});
                return;
            }

        }

        //strange cases might reach here. For now render all before adding more checks in the future


        props.overlayDispatch({type: 'addRender', payload: 'drawing'});
    }, [thingsJSON, connectionsJSON, props.state.Ui?.mode]);

    useLayoutEffect(() => {
        if (props.highlightObject) {
            const highlightRect = draw.current.findOne(`[id="${props.highlightObject}"] > rect`);
            if (highlightRect) {
                highlightRect.attr('stroke', 'rgb(255,0,0)');
                highlightRect.attr('stroke-width', 5);
                const highlightThing = props.state.Things.filter(el => el._id === props.highlightObject);
                const outsideArray = calcOutside(highlightThing, [], props, draw, true);
                if (Object.values(outsideArray).some(el => el)) {
                    setViewbox.call({
                        x: (highlightThing?.[0]?.x + highlightRect?.parent('.bbox')?.width() / 2) -
                            draw.current.node.parentElement.parentElement.clientWidth / 2,
                        y: (highlightThing?.[0]?.y + highlightRect?.parent('.bbox')?.height() / 2) -
                            draw.current.node.parentElement.parentElement.clientHeight / 2,
                    });
                }
            }
            return () => {
                if (highlightRect) {
                    highlightRect.attr('stroke', null);
                    highlightRect.attr('stroke-width', null);
                }
            }
        }
    }, [props.highlightObject]);

    return (
        <div className="draw-canvas-overlay" style={overlayBorderStyles(outsideOverlay)}>
            <div className="drawing-canvas" ref={canvasRef} style={styles.canvas}>
            </div>
        </div>
    );
}

export default Drawing;