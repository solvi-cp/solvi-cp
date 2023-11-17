import React, {useState, useRef, useEffect, useCallback, useMemo} from 'react';
import {_} from 'meteor/underscore';
import {EJSON} from 'meteor/ejson';
import {SVG, on, off} from '@svgdotjs/svg.js';
import '../../utils/svg.interaction.js';
import {combineCSS, constants} from "../helpers/shared";

import interact from 'interactjs';
import {Thing} from "../fragments/drawing/Thing";
import {solve} from "../../api/solver/methods";
import {NameValue} from "../components/drawing/NameValue";
import {createBoundingBox} from "../components/drawing/Components";
import {getAttributeByReducerId, getAttributeValue, getReducerAttributeMap, getTypePrototypes} from "../../utils/api";
import {sanitiseName} from "../../utils/essence";

const styles = {
    results: {
        height: '100%',
        width: '100%',
        touchAction: 'auto',
        overflowY: 'scroll'
    },
    canvases: {
        display: 'grid',
        gridTemplateRows: '1fr',
        gridAutoColumns: 'min-content',
        margin: '5px 10px 5px 10px',
        paddingBottom: 20,
        background: 'lightgray',
        borderRadius: 10,
        overflowX: 'scroll',
        overflowY: 'hidden'
    },
    canvas: {
        width: 300,
        // height: '100%',
        background: 'gray',
        margin: '10px 5px 10px 5px',
        borderRadius: 10,
        gridRow: 1,
        gridColumn: 'span'
    },
    status: {
        fontSize: '2em',
        padding: 15
    }
};

const SolutionsSection = (props) => {
    if (props.solverState.activeSolver) {
        if (props.solverState.solving && !props.solverState.solved) {
            return <div className="results status" style={combineCSS(styles.status)}>solving...</div>
        } else if (props.solverState.solved && props.solverState.error) {
            return <div className="results status"
                        style={combineCSS(styles.status)}>something is wrong with the model
                or the solver ran out of time</div>
        } else if (props.solverState.solved && !props.solverState.solutions?.length) {
            return <div className="results status" style={combineCSS(styles.status)}>no solutions found</div>
        } else {
            return props.solverState.solutions.map((solution, index, array) =>
                <div key={index} className="results canvas" style={combineCSS(styles.canvases,
                    array.length - 1 === index ? {marginBottom: 10} : null,
                    {height: 400})}>
                    {Object.keys(solution)
                        .map((container, index) =>
                            <div key={index} style={combineCSS(styles.canvas,
                                index === 0 ? {marginLeft: 10} : null)}>
                            </div>
                        )}
                    <div style={{width: 5, gridRow: 1, gridColumn: 'span'}}>
                    </div>
                </div>
            )
        }
    } else {
        return null;
    }
}

const DrawingResult = (props) => {

    const drawingResultRef = useRef(null);

    useEffect(() => {
        interact(drawingResultRef.current.querySelector('.result.canvas.prototype')).dropzone({
            accept: '.solvable',

            checker: (dragEvent,
                      event,
                      dropped,
                      dropzone,
                      dropElement,
                      draggable,
                      draggableElement) => {
                return dropped;
            },

            ondropactivate: (ev) => {
                //console.log(ev)
            },
            ondragenter: (ev) => {
                //console.log(ev)
            },
            ondragleave: (ev) => {
                //console.log(ev)
            },
            ondrop: (ev) => {
                //console.log(ev)
                if (ev.relatedTarget.instance.data('type') === 'reducer') {
                    props.solverDispatch({
                        type: 'addReducer',
                        payload: ev.relatedTarget.instance.data('id')
                    });
                } else {
                    props.solverDispatch({
                        type: 'addFindable',
                        payload: ev.relatedTarget.instance.data('id')
                    });
                }
            },
            ondropdeactivate: (ev) => {
                //console.log(ev)
            }
        })
    }, []);

    const createObjectAttributes = (attributesReducers, thing, thingObject) => {

        if (!attributesReducers || !attributesReducers.length) return;

        const objectAttributesObjectBbox = thingObject.group();
        objectAttributesObjectBbox.addClass('object-attributes');
        objectAttributesObjectBbox.addClass('bbox');

        const objectAttributesObject = objectAttributesObjectBbox.group();
        objectAttributesObject.addClass('inner');

        const boundingBox = thingObject.parent('.bbox').bbox();

        const objectAttributesHeight = attributesReducers.reduce((accumulator, attributeReducer, index) => {
            const nameValueElements = [];
            if (attributeReducer[0]) {
                nameValueElements.push({
                    value: attributeReducer[0].icon,
                    readOnly: false,
                    type: typeof attributeReducer[0].icon,
                }, {
                    value: ': ',
                    readOnly: true,
                });
            }
            if (attributeReducer[1]) {
                nameValueElements.push({
                    value: attributeReducer[1].key,
                    readOnly: false,
                    type: typeof attributeReducer[1].key,
                });
            }
            if (attributeReducer[2]) {
                nameValueElements.push({
                    value: ' = ',
                    readOnly: true,
                }, {
                    value: attributeReducer[2],
                    readOnly: false,
                    type: typeof attributeReducer[2],
                })
            }
            const objectAttribute = NameValue(attributeReducer[1].attributeId, thing._id, objectAttributesObject,
                {
                    x: boundingBox.x + constants.outerBoxPadding + constants.boxPadding,
                    y: boundingBox.y
                },
                nameValueElements, false
            );

            objectAttribute.parent('.bbox').dy(accumulator);

            objectAttribute.parent('.bbox').data('parentAttributeId', attributeReducer[1].parentAttributeId);

            return accumulator + objectAttribute.parent('.bbox').height() + constants.boxPadding;
        }, boundingBox.height - constants.outerBoxPadding / 2);

        let attributeBoundingBox = objectAttributesObject.bbox();
        if (attributesReducers.length === 0) {
            attributeBoundingBox = boundingBox;
        }

        createBoundingBox(objectAttributesObjectBbox, objectAttributesObject.bbox(),
            constants.typeAttributeBboxColor, constants.typeAttributeBboxOpacity);

        return objectAttributesObject;
    }

    const renderPrototype = useCallback(_.debounce((findable, reducers, drawingResultRef, props) => {
        const prototypePanel = drawingResultRef.current?.querySelector('.result.canvas.prototype');
        if (prototypePanel) {
            let maxHeight = 0;
            if (findable.length) {
                const reducerMap = getReducerAttributeMap(reducers);
                findable.forEach((f, i) => {
                    let draw = prototypePanel.children[i]?.children[0]?.instance;
                    if (!draw) {
                        draw = SVG().addTo(prototypePanel.children[i]).size('100%',);
                    } else {
                        draw.clear();
                    }
                    const thing = props.state.Things.find(el => el._id === f);
                    const thingCopy = {
                        ...thing, ...{
                            attributes: [],
                            typeAttributesOrder: ['name']
                        },
                    }
                    const thingObject = Thing(thingCopy, draw, 'result-proto');
                    thingObject.parent('.bbox').move(10, 10);

                    createObjectAttributes(
                        reducerMap[f],
                        thing,
                        thingObject
                    )

                    thingObject.parent('.bbox').findOne(':scope > rect').width(thingObject.bbox().width +
                        constants.outerBoxPadding * 2);

                    thingObject.parent('.bbox').findOne(':scope > rect').height(thingObject.bbox().height +
                        constants.outerBoxPadding * 2);

                    prototypePanel.children[i].style.width = `${draw.bbox().width + draw.bbox().x + 10}px`;
                    maxHeight = Math.max(maxHeight, draw.bbox().height + draw.bbox().y);
                    draw.height(maxHeight + 8);
                });
                prototypePanel.style.height = `${maxHeight + 25}px`;
            }
        }
        props.overlayDispatch({type: 'removeRender', payload: 'resultPrototype'});
    }, 1000), []);

    useEffect(() => {
        if (props.overlayState.rendering.includes('resultPrototype')) {
            renderPrototype(props.solverState.findable, props.solverState.reducers, drawingResultRef, props);
        }
    }, [props.overlayState.rendering]);

    useEffect(() => {
        props.overlayDispatch({type: 'addRender', payload: 'resultPrototype'});
    }, [props.solverState.findable, props.solverState.reducers]);

    useEffect(() => {
        if (props.solverState.solving) {
            const solve = props.state.Solver.find(el => el.problemId === props.solverState.activeSolver);
            if (solve?.ran) {
                if (solve?.solved && solve?.stdout) {
                    console.log(solve?.stdout);
                } else if (solve?.stderr) {
                    console.error(solve?.stderr);
                }
                if (solve?.error === 'no solutions') {
                    props.solverDispatch({
                        type: 'noSolutions', payload: {}
                    });
                    return;
                }
                if (solve?.solved) {
                    if (solve?.solutionJson?.length) {
                        const sol = solve.solutionJson.map(el => JSON.parse(el));
                        // console.log(sol);
                        const findableNames = props.solverState.findable.map(el =>
                            props.state.Things.find(e => e._id === el));

                        const makeTree = (innerArray, i) => {
                            const tree = {};
                            innerArray.forEach(el => {
                                const innerName = sanitiseName(solve.indexMap[el]);
                                if (innerName in sol[i]) {
                                    tree[innerName] = makeTree(sol[i][innerName], i);
                                } else {
                                    tree[innerName] = null;
                                }
                            });
                            return tree;
                        }

                        const filteredSol = sol.map(el => {
                            const filtered = {}
                            Object.entries(el).forEach(([k, v]) => {
                                if (findableNames.map(e => sanitiseName(e.typeAttributes.name)).includes(k) ||
                                    findableNames.map(e => solve.problemState
                                        .containerTypeToContainerArray?.[e.typeAttributes.name] ?? [])
                                        .some(e => e.map(ee => sanitiseName(ee)).includes(k))) {
                                    filtered[k] = v;
                                }
                            });
                            return filtered;
                        });

                        const solutionTreeArray = filteredSol.map((el, i) => {
                            const subObject = {};
                            Object.entries(el).forEach(([key, val]) => {
                                subObject[key] = makeTree(val, i);
                            });
                            return subObject;
                        });

                        console.log(solutionTreeArray);

                        props.solverDispatch({
                            type: 'hasSolutions', payload: {
                                solutions: solutionTreeArray,
                                rawSolutions: sol,
                                problemState: solve.problemState
                            }
                        });
                    }
                } else if (solve?.stderr) {
                    props.solverDispatch({
                        type: 'error', payload: {
                            error: solve?.stderr
                        }
                    });
                }
            }
        }
    }, [props.state.Solver, props.solverState.activeSolver, props.solverState.solving]);

    function drawResult(objectMap, rawSolution, draw, reducers, props, initial = false,
                        attributesToDisplay = [], y = constants.padding) {

        let width = 0;
        let height = 0;

        Object.keys(objectMap).forEach((f, i) => {
            const thing = props.state.Things.find(el => sanitiseName(el?.typeAttributes?.name) === f) ??
                props.state.Things.find(el => sanitiseName(el?.typeAttributes?.name) === f
                    .split('_').slice(0, -1).join('_'));

            const x = draw.bbox().width + (initial ? constants.padding : constants.outerBoxPadding * 2);
            const thingCopy = EJSON.clone(thing);
            thingCopy.attributes = [];
            thingCopy.typeAttributesOrder = ['name'];

            if (thingCopy.type === 'container_type') {
                if (thingCopy.typeAttributes.name === f) {
                    const typeName = getTypePrototypes(thingCopy)[0].typeAttributes.name;
                    thingCopy.typeAttributes.name = f + ' of ' + typeName;
                } else {
                    thingCopy.typeAttributes.name = f + ' of ' + thingCopy.typeAttributes.name;
                }
                thingCopy.type = 'container';
            } else if (thingCopy.type === 'object_type') {
                if (thingCopy.typeAttributes.name === f) {
                    const typeName = getTypePrototypes(thingCopy)[0].typeAttributes.name;
                    thingCopy.typeAttributes.name = f + ' of ' + typeName;
                } else {
                    thingCopy.typeAttributes.name = f + ' of ' + thingCopy.typeAttributes.name;
                }
                thingCopy.type = 'object';
            }
            const thingObject = Thing(thingCopy, draw, 'result');

            const reducerMap = getReducerAttributeMap(reducers);
            const attributesToPass = [];
            const attributesObject = [];

            reducerMap[thing._id]?.forEach(el => {
                attributesToPass.push(el[1].parentAttributeId);
                attributesObject.push([...el, rawSolution[sanitiseName(el[0].icon + '_' + el[1].key
                    + '_' + el[0]._id)]]);
            });

            attributesObject.push(...thing.attributes
                .filter(el => attributesToDisplay.includes(el.parentAttributeId))
                .map(el => [undefined, el, getAttributeValue(el.attributeId)]));

            createObjectAttributes(
                attributesObject,
                thing,
                thingObject
            )

            thingObject.parent('.bbox').findOne(':scope > rect').width(thingObject.bbox().width +
                constants.outerBoxPadding * 2);

            thingObject.parent('.bbox').findOne(':scope > rect').height(thingObject.bbox().height +
                constants.outerBoxPadding * 2);

            thingObject.parent('.bbox').move(x, y);

            let returnWidth, returnHeight = 0;

            height = Math.max(thingObject.bbox().height, height);

            if (objectMap[f] !== null) {
                [returnWidth, returnHeight] =
                    drawResult(objectMap[f], rawSolution, draw, reducers, props, false,
                        [...attributesToDisplay, ...attributesToPass], y + constants.outerBoxPadding);
                innerWidth += returnWidth;
                thingObject.parent('.bbox').findOne(':scope > rect').width(thingObject.bbox().width +
                    returnWidth + constants.outerBoxPadding * 2);
                height = Math.max(returnHeight, height);
                thingObject.parent('.bbox').findOne(':scope > rect').height(height +
                    constants.outerBoxPadding * 2);
            }
            width += thingObject.parent('.bbox').bbox().width + constants.outerBoxPadding;
        });
        return [width + constants.outerBoxPadding * 2, height + constants.outerBoxPadding * 2];
    }

    const renderResult = useCallback(_.debounce((solution, reducers, drawingResultRef, props) => {
        const resultsPanels = drawingResultRef.current?.querySelectorAll('.results.canvas');
        if (resultsPanels && solution.length) {
            solution.forEach((sol, i) => {
                const resultsPanel = resultsPanels[i];
                let maxHeight = 0;
                Object.keys(sol).forEach((f, j) => {
                    let draw = resultsPanel.children[j]?.children[0]?.instance;
                    if (!draw) {
                        draw = SVG().addTo(resultsPanel.children[j]).size('100%',);
                    } else {
                        draw.clear();
                    }

                    drawResult({[f]: sol[f]}, props.solverState.rawSolutions[i], draw, reducers, props,
                        true);

                    resultsPanel.children[j].style.width = `${draw.bbox().width + draw.bbox().x + 10}px`;
                    maxHeight = Math.max(maxHeight, draw.bbox().height + draw.bbox().y);
                    draw.height(maxHeight + 8);
                });
                resultsPanel.style.height = `${maxHeight + 25}px`;
            });
        }
        props.overlayDispatch({type: 'removeRender', payload: 'results'});
    }, 1000), []);

    useEffect(() => {
        if (props.overlayState.rendering.includes('results')) {
            renderResult(props.solverState.solutions, props.solverState.reducers, drawingResultRef, props);
        }
    }, [props.overlayState.rendering]);

    useEffect(() => {
        props.overlayDispatch({type: 'addRender', payload: 'results'});
    }, [props.solverState.solutions]);

    return (
        <div style={styles.results} ref={drawingResultRef}>
            <div key="proto" className="result canvas prototype" style={combineCSS(styles.canvases,
                {marginTop: 10},
                {height: 400},
                {background: 'darkgray'})}>
                {props.solverState.findable.map((el, index) =>
                    <div key={index} style={combineCSS(styles.canvas,
                        index === 0 ? {marginLeft: 10} : null)}>
                    </div>
                )}
                <div style={{width: 5, gridRow: 1, gridColumn: 'span'}}>
                </div>
            </div>
            <SolutionsSection solverState={props.solverState}/>
        </div>
    )
}

export default DrawingResult;