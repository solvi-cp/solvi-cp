import React, {useState, useRef, useMemo, useReducer, useEffect} from 'react';

import {touchWrapper, combineCSS, getOffsetCoords} from "../helpers/shared";

import Drawing from '../sections/Drawing';
import LeftPalette from "../sections/LeftPalette";
import LeftPaletteV2 from "../sections/LeftPaletteV2";
import DrawingResult from "../sections/DrawingResult";
import Text from '../sections/Text';
import TextResult from "../sections/TextResult";

import {Meteor} from "meteor/meteor";
import {useTracker} from 'meteor/react-meteor-data';

import {Ui} from '../../api/ui/collection';
import {Things} from '../../api/things/collection';
import {Connections} from '../../api/connections/collection';
import {Solver} from '../../api/solver/collection';

import {setPane, setPaletteVersion, setZoom} from "../../api/ui/methods";

import i18n from 'meteor/universe:i18n';
import '../../../i18n/en.i18n.json';
import Overlay from "../sections/Overlay";
import {Redo, Undo} from "../../api/undo/collection";
import {load} from "../../api/save/methods";
import knapsackJSON from "../../../examples/knapsack.json";
import weddingJSON from "../../../examples/wedding_table.json";
import teachingJSON from "../../../examples/teaching.json";

const styles = {
    paletteLeft: {
        position: 'absolute',
        left: 0,
        top: 'calc(50% - 150px)',
        bottom: 'calc(50% - 150px)',
        height: 300,
        width: 150,
        zIndex: 2
    },
    paletteLeftV2: {
        position: 'absolute',
        top: '0',
        transform: 'translate(0, -50%)',
        width: 105,
        zIndex: 2,
        height: "100%"
    },
    paletteLeftV2Padding: {
        zIndex: 1,
        paddingLeft: 95
    },
    maxHeight: {
        height: '100%'
    },
    maxWidth: {
        width: '100%'
    },
    border: {
        borderStyle: 'solid'
    },
    gridLeftTop: {
        gridArea: '1 / 1 / 2 / 2',
        borderRight: '1px solid grey',
        borderBottom: '1px solid grey',
        zIndex: 1
    },
    gridRightTop: {
        gridArea: '1 / 2 / 2 / 3',
        borderLeft: '1px solid grey',
        borderBottom: '1px solid grey',
        zIndex: 1
    },
    gridLeftBottom: {
        gridArea: '2 / 1 / 3 / 2',
        borderRight: '1px solid grey',
        borderTop: '1px solid grey',
        zIndex: 1
    },
    gridRightBottom: {
        gridArea: '2 / 2 / 3 / 3',
        borderLeft: '1px solid grey',
        borderTop: '1px solid grey',
        zIndex: 1
    },
    dot: {
        height: 26,
        width: 26,
        backgroundColor: '#bbb',
        borderRadius: '50%',
        display: 'inline-block',
        zIndex: 2
    },
    generateGrid: (leftWidth, leftHeight) => {
        return {
            display: 'grid',
            gridTemplateColumns: `${leftWidth}px calc(100% - ${leftWidth}px)`,
            gridTemplateRows: `${leftHeight}px calc(100% - ${leftHeight}px)`
        }
    },
    generateHandle: (leftWidth, leftHeight) => {
        return {
            position: 'absolute',
            left: `calc(${leftWidth}px - 13px)`,
            top: `calc(${leftHeight}px - 13px`,
            cursor: 'move'
        }
    },
    center: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginRight: '-50%',
        transform: 'translate(-50%, -50%)',
        fontSize: '10vw'
    },
    modal: {
        backgroundColor: 'white',
        zIndex: 101
    },
    hidden: {
        visibility: 'hidden'
    },
    displayNone: {
        display: 'none'
    },
    topLeft: {
        position: 'absolute',
        top: '10px',
        left: '10px',
        fontSize: '2vw'
    },
};

const App = (props) => {

    const state = useTracker(() => {
        const uiSub = Meteor.subscribe('Ui');
        const thingsSub = Meteor.subscribe('Things');
        const connectionsSub = Meteor.subscribe('Connections');
        const solverSub = Meteor.subscribe('Solver');
        const undoSub = Meteor.subscribe('Undo');
        const redoSub = Meteor.subscribe('Redo');
        const status = Meteor.status();
        return {
            loaded: uiSub.ready() && thingsSub.ready() && connectionsSub.ready() && solverSub.ready()
                && undoSub.ready() && redoSub.ready(),
            Ui: Ui.findOne(),
            Things: Things.find().fetch(),
            Connections: Connections.find().fetch(),
            Solver: Solver.find().fetch(),
            Undo: Undo.find().fetch(),
            Redo: Redo.find().fetch(),
            status: status
        };
    });

    const resizingPointer = useRef(null);
    const [firstRun, setFirstRun] = useState(true);

    const [highlightObject, setHighlightObject] = useState(null);

    const overlayInitialState = {
        rendering: [],
        error: null,
        draggingObject: null
    }

    const overlayReducer = (state, action) => {
        switch (action.type) {
            case 'addRender':
                return {...state, rendering: [...state.rendering, action.payload]};
            case 'removeRender':
                return {
                    ...state,
                    rendering: state.rendering.filter(el => el !== action.payload && el.doing !== action.payload)
                };
            case 'setDraggingObject':
                return {...state, draggingObject: action.payload};
            case 'resetDraggingObject':
                return {...state, draggingObject: null};
            case 'setError':
                return {...state, error: action.payload};
            case 'clearError':
                return {...state, error: null};
            default:
                return state;
        }
    }

    const [overlayState, overlayDispatch] = useReducer(overlayReducer, overlayInitialState);

    const solverInitialState = {
        findable: [],
        reducers: [],
        solving: false,
        solved: true,
        activeSolver: null,
        solutions: [],
        rawSolutions: [],
        error: '',
        problemState: null
    };

    const solverReducer = (state, action) => {
        switch (action.type) {
            case 'addFindable':
                if (state.findable.includes(action.payload)) {
                    return state;
                } else {
                    return {
                        ...state, ...{
                            findable: [...state.findable, action.payload]
                        }, ...{
                            solved: false
                        }
                    };
                }
            case 'addReducer':
                if (state.reducers.includes(action.payload)) {
                    return state;
                } else {
                    return {
                        ...state, ...{
                            reducers: [...state.reducers, action.payload]
                        }, ...{
                            solved: false
                        }
                    }
                }
            case 'startSolve':
                return {
                    ...state, ...{
                        solving: true
                    }
                };
            case 'setActiveSolver':
                return {
                    ...state, ...{
                        activeSolver: action.payload
                    }
                };
            case 'error':
                return {
                    ...state, ...{
                        solving: false,
                        solved: true,
                        error: action.payload.error
                    }
                };
            case 'noSolutions':
                return {
                    ...state, ...{
                        solving: false,
                        solved: true,
                        solutions: []
                    }
                };
            case 'hasSolutions':
                return {
                    ...state, ...{
                        solving: false,
                        solved: true,
                        solutions: action.payload.solutions,
                        rawSolutions: action.payload.rawSolutions,
                        problemState: action.payload.problemState
                    }
                };
            case 'resetSolve':
                return solverInitialState;
            default:
                return state;
        }
    }

    const [solveState, solverDispatch] = useReducer(solverReducer, solverInitialState);

    const frameRef = useRef(null);

    const handleResizeStart = (event) => {
        if (!resizingPointer.current) {
            touchWrapper(event, (ev, id) => {
                if (ev.button && ev.button !== 0) return;
                resizingPointer.current = id;
                document.addEventListener('pointerup', handleResizeEnd);
                document.addEventListener('pointercancel', handleResizeEnd);
                document.addEventListener('touchend', handleResizeEnd);
                document.addEventListener('touchcancel', handleResizeEnd);
            });
        }
    };

    const handlePaneResize = (event) => {
        touchWrapper(event, (ev, id) => {
            if (resizingPointer.current === id) {
                const offsetCoord = getOffsetCoords(ev, frameRef.current);
                setPane.call({width: offsetCoord.x, height: offsetCoord.y});
            }
        });
    };

    const handleResizeEnd = (event) => {
        touchWrapper(event, (ev, id) => {
            if (resizingPointer.current === id) {
                resizingPointer.current = null;
                document.removeEventListener('pointerup', handleResizeEnd);
                document.removeEventListener('pointercancel', handleResizeEnd);
                document.removeEventListener('touchend', handleResizeEnd);
                document.removeEventListener('touchcancel', handleResizeEnd);
            }
        });
    };

    const frameDimBuffer = 20;
    const [windowDim, setWindowDim] = useState({width: window.innerWidth, height: window.innerHeight});

    const getPaneDim = (currentValue, maxValue) => {
        const middleValue = maxValue / 2;
        if (!currentValue || currentValue < 0) {
            return middleValue;
        }
        return Math.min(Math.max(currentValue, frameDimBuffer), maxValue - frameDimBuffer);
    };

    const getPaneWidth = useMemo(() => {
        const frameWidth = frameRef?.current?.clientWidth;
        const paneWidth = state.Ui?.pane?.width;
        return getPaneDim(paneWidth, frameWidth);
    }, [state.Ui?.pane?.width, windowDim]);

    const getPaneHeight = useMemo(() => {
        const frameHeight = frameRef?.current?.clientHeight;
        const paneHeight = state.Ui?.pane?.height;
        return getPaneDim(paneHeight, frameHeight);
    }, [state.Ui?.pane?.height, windowDim]);

    useEffect(() => window.addEventListener('resize', ev => {
        setWindowDim({width: window.innerWidth, height: window.innerHeight});
    }), []);

    return (
        <div style={combineCSS(styles.maxWidth, styles.maxHeight)}
             onPointerMove={handlePaneResize}
             onTouchMove={handlePaneResize}>
            <div className="frames"
                 style={combineCSS(styles.generateGrid(getPaneWidth, getPaneHeight),
                     styles.maxHeight, styles.maxWidth, state.loaded ? {} : styles.hidden)}
                 ref={frameRef}>
                <div className="drawing" style={combineCSS(styles.gridLeftTop,
                    state.Ui?.paletteVersion === "v2" ? styles.paletteLeftV2Padding : {},
                    {backgroundColor: 'white'})}>
                    <Drawing state={state} overlayState={overlayState} overlayDispatch={overlayDispatch}
                             highlightObject={highlightObject} setHighlightObject={setHighlightObject}/>
                </div>
                <div className="drawing-result"
                     style={combineCSS(styles.gridLeftBottom,
                         state.Ui?.paletteVersion === "v2" ? styles.paletteLeftV2Padding : {},
                         {backgroundColor: 'white'})}>
                    <DrawingResult state={state} solverState={solveState} solverDispatch={solverDispatch}
                                   overlayState={overlayState} overlayDispatch={overlayDispatch}/>
                </div>
                <div className="text"
                     style={combineCSS(styles.gridRightTop, {backgroundColor: 'white'}, {overflowY: 'scroll'})}>
                    <Text state={state} overlayState={overlayState} overlayDispatch={overlayDispatch}
                          highlightObject={highlightObject} setHighlightObject={setHighlightObject}/>
                </div>
                <div className="text-result"
                     style={combineCSS(styles.gridRightBottom, {backgroundColor: 'white'}, {overflowY: 'scroll'})}>
                    <TextResult state={state} solverState={solveState} solverDispatch={solverDispatch}
                                overlayState={overlayState} overlayDispatch={overlayDispatch}/>
                </div>
            </div>
            <div
                style={combineCSS(styles.dot, styles.generateHandle(getPaneWidth, getPaneHeight),
                    state.loaded ? {} : styles.hidden)}
                draggable={false}
                onPointerDown={handleResizeStart}
                onTouchStart={handleResizeStart}
            >
            </div>
            {state.Ui?.paletteVersion === "v2" ?
                <div style={combineCSS(styles.paletteLeftV2, state.loaded ? {} : styles.hidden)}>
                    <LeftPaletteV2
                        state={state}
                        solverState={solveState}
                        solverDispatch={solverDispatch}
                        overlayState={overlayState}
                        overlayDispatch={overlayDispatch}
                    />
                </div>
                :
                <div style={combineCSS(styles.paletteLeft, state.loaded ? {} : styles.hidden)}>
                    <LeftPalette
                        state={state}
                        solverState={solveState}
                        solverDispatch={solverDispatch}
                        overlayState={overlayState}
                        overlayDispatch={overlayDispatch}
                    />
                </div>

            }

            {state.loaded && (overlayState.rendering.length ||
                overlayState.draggingObject ||
                overlayState.error || firstRun) ?
                <Overlay state={state} overlayState={overlayState} overlayDispatch={overlayDispatch}
                         setFirstRun={setFirstRun}/>
                : null}
            <div style={combineCSS(styles.center, styles.modal, state.loaded ? styles.displayNone : {})}>
                <div>{i18n.__('ui.loading')}</div>
            </div>
            {firstRun ?
            <div style={combineCSS(styles.topLeft, styles.modal)}>
                <div>Click an example to preload, then to solve: switch to solve mode, drag container/container group
                    drawing to solve for into gray box in the left bottom pane,
                    and switch back to pan to start solve</div>
                <div style={{fontSize: '1vw'}} onClick={() => {
                    load.call({state: JSON.stringify(knapsackJSON)});
                    setZoom.call({zoom: 0.25});
                    setFirstRun(false);
                }}>Knapsack</div>
                <div style={{fontSize: '1vw'}} onClick={() => {
                    load.call({state: JSON.stringify(weddingJSON)});
                    setZoom.call({zoom: 0.25});
                    setFirstRun(false);
                }}>Wedding</div>
                <div style={{fontSize: '1vw'}} onClick={() => {
                    load.call({state: JSON.stringify(teachingJSON)});
                    setZoom.call({zoom: 0.25});
                    setFirstRun(false);
                }}>Teaching</div>
            </div>
            : null}
        </div>
    )
}

export default App;