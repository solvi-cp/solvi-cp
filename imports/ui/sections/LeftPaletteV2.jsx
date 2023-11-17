import React, {useState, useRef, useMemo} from 'react';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {
    faHandPaper,
    faPen,
    faHashtag,
    faFont,
    faGreaterThan,
    faGreaterThanEqual,
    faLessThan,
    faLessThanEqual,
    faEquals,
    faLongArrowAltRight,
    faNotEqual,
    faFileDownload,
    faFileUpload,
    faUndo,
    faRedo, faTrash, faPlus, faMinus, faTimes, faDivide, faSearchPlus, faSearchMinus
} from '@fortawesome/free-solid-svg-icons';
import i18n from 'meteor/universe:i18n';

import {setMode, setPalette, revertMode, setPaletteVersion, setZoom} from "../../api/ui/methods";

import {combineCSS, touchWrapper, getOffsetCoords} from "../helpers/shared";
import {redo, resetUndo, undo} from "../../api/undo/methods";
import {clear, load} from "../../api/save/methods";
import {solve} from "../../api/solver/methods";

import knapsackJSON from "../../../examples/knapsack.json";
import weddingJSON from "../../../examples/wedding_table.json";
import teachingJSON from "../../../examples/teaching.json";

const styles = {
    halfCircle: {
        background: '#9e978e',
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        border: '0px solid gray',
        borderRightWidth: 10,
        borderLeft: 0,
        boxSizing: 'border-box',
        position: 'relative',
        top: '50%',
    },
    iconCircle: {
        width: 40,
        height: 40,
        position: 'absolute',
        backgroundColor: 'white',
        borderRadius: 40
    },
    iconSize: {
        width: 15,
        height: 15
    },
    textContainer: {
        paddingTop: 2,
        paddingBottom: 2,
        textAlign: 'center',
        fontWeight: 'bold'
    },
    textSelected: {
        color: 'white'
    },
    textNotSelected: {
        color: 'black'
    }
};

const calculateLeftTopFromAngleRadians = (radians) => {
    if (radians >= 0 && radians <= Math.PI / 2) {
        return {
            left: (Math.sin(radians) * 110) - 30,
            top: 150 - (Math.cos(radians) * 110) - 30
        }
    } else if (radians > Math.PI / 2 && radians <= Math.PI) {
        radians = Math.PI - radians;
        return {
            left: (Math.sin(radians) * 110) - 30,
            top: 300 - (150 - (Math.cos(radians) * 110)) - 30
        }
    } else if (radians < 0 && radians > -1 * Math.PI * 0.1) {
        return {
            left: (-1 * (Math.sin(Math.abs(radians)) * 110) - 30),
            top: 150 - (Math.cos(Math.abs(radians)) * 110) - 30
        }
    } else if (radians > Math.PI && radians < Math.PI * 1.1) {
        radians = radians - Math.PI;
        return {
            left: (-1 * Math.sin(radians) * 110) - 30,
            top: 300 - (150 - (Math.cos(radians) * 110)) - 30
        }
    } else {
        return {
            left: -100,
            top: -100
        }
    }
};

const Word = (props) => {
    return (
        <div style={styles.textContainer}><span
            style={props.inverse ? styles.textSelected : styles.textNotSelected}>{props.word}</span></div>
    )
}

const wordInIcon = (word) => {
    if (word.includes(' ')) {
        return word.replace(' ', '\n');
    } else if (word.length > 9) {
        return `${word.slice(0, 5)}-\n${word.slice(5, 10)}`;
    } else {
        return word;
    }
}

const LeftPaletteV2 = (props) => {

    const dialingPointer = useRef(null);
    const currentCommand = useRef(false);
    const holdReset = useRef(false);
    const [flash, setFlash] = useState(false);

    let dialStartPoint = useRef(null);
    let dialStartAngle = useRef(null);
    let dialTurning = useRef(false);
    let modeStartTime = useRef(null);

    const dialRef = useRef(null);

    const dialList = useMemo(() => [
        {icon: faHandPaper, mode: 'pan', enable: true},
        {icon: faPen, mode: 'draw', enable: true},
        {icon: faHashtag, mode: 'number', enable: true},
        {icon: faFont, mode: 'string', enable: true},
        {icon: faPlus, mode: 'plus', enable: true},
        {icon: faMinus, mode: 'minus', enable: true},
        {icon: faTimes, mode: 'times', enable: true},
        {icon: faDivide, mode: 'divide', enable: true},
        {icon: faGreaterThan, mode: 'greaterThan', enable: true},
        {icon: faGreaterThanEqual, mode: 'greaterThanEqual', enable: true},
        {icon: faLessThan, mode: 'lessThan', enable: true},
        {icon: faLessThanEqual, mode: 'lessThanEqual', enable: true},
        {icon: faEquals, mode: 'equals', enable: true},
        {icon: faNotEqual, mode: 'notEqual', enable: true},
        {mode: 'and', enable: true},
        {mode: 'or', enable: true},
        {mode: 'not', enable: true},
        {icon: faLongArrowAltRight, mode: 'implication', enable: true},
        {mode: 'sum', enable: true},
        {mode: 'avg', enable: true},
        {mode: 'spread', enable: true},
        {mode: 'max', enable: true},
        {mode: 'min', enable: true},
        {mode: 'count', enable: true},
        // {mode: 'allDiff', enable: true},
        {mode: 'maximise', enable: true},
        {mode: 'minimise', enable: true},
        {icon: faUndo, mode: 'undo', enable: props.state?.Undo?.length > 0, command: true},
        {icon: faRedo, mode: 'redo', enable: props.state?.Redo?.length > 0, command: true},
        {icon: faFileDownload, mode: 'save', enable: true, command: true},
        {icon: faFileUpload, mode: 'load', enable: true, command: true},
        {icon: faTrash, mode: 'clear', enable: true, command: true},
        {mode: 'solve', enable: true},
        {
            icon: (props.state.Ui?.viewbox?.zoom ?? 1) < 1 ? faSearchPlus : faSearchMinus, mode: 'zoom',
            enable: true, command: true
        },
        {mode: 'switch', enable: true, command: true},
        // {mode: 'knapsack', enable: true, command: true},
        // {mode: 'wedding', enable: true, command: true},
        // {mode: 'teaching', enable: true, command: true}
    ], [props.state?.Undo]);

    const generateIconList = (iconNamesAndModes, startDegrees = 0) => {
        return iconNamesAndModes.map((iconNameAndMode, index) => {
            return (
                <div key={iconNameAndMode.mode}
                     style={{
                         backgroundColor: iconNameAndMode.mode === props.state.Ui?.mode &&
                         !flash ? 'black' : 'white',
                         textAlign: 'center',
                         paddingTop: 5,
                         paddingBottom: 5
                     }}
                     onPointerDown={iconNameAndMode.enable ? modeChangeStart(iconNameAndMode.mode,
                         iconNameAndMode.command) : null}
                     onTouchStart={iconNameAndMode.enable ? modeChangeStart(iconNameAndMode.mode,
                         iconNameAndMode.command) : null}
                >
                    {
                        iconNameAndMode.icon ?
                            <FontAwesomeIcon icon={iconNameAndMode.icon} fixedWidth
                                             inverse={iconNameAndMode.mode === props.state.Ui?.mode && !flash}
                                             style={combineCSS(styles.iconSize,
                                                 iconNameAndMode.enable ? {} : {color: 'gray'})}/>
                            :
                            <Word word={wordInIcon(i18n.__(`operators.${iconNameAndMode.mode}`))}
                                  inverse={iconNameAndMode.mode === props.state.Ui?.mode && !flash}
                                  style={combineCSS(styles.iconSize, iconNameAndMode.enable ? {} : {color: 'gray'})}/>
                    }
                </div>
            )
        })
    };

    const handleDialStart = (event) => {
        touchWrapper(event, (ev, id) => {
            if (dialingPointer.current === null) {
                if (ev.button && ev.button !== 0) return;
                const offsetCoord = getOffsetCoords(ev, dialRef.current.parentElement);
                dialStartPoint.current = {x: offsetCoord.x, y: offsetCoord.y};
                dialStartAngle.current = props.state.Ui?.paletteAngle;
                dialingPointer.current = id;
                document.addEventListener('pointerup', handleDialEnd);
                document.addEventListener('pointercancel', handleDialEnd);
                document.addEventListener('touchend', handleDialEnd);
                document.addEventListener('touchcancel', handleDialEnd);
            }
        });
    };

    const handleDialWheel = (event) => {
        let newAngle = props.state.Ui?.paletteAngle + event.deltaY * 0.1
        let maxDegrees = dialList.length * 35;
        if (newAngle >= maxDegrees) {
            newAngle -= maxDegrees;
        } else if (newAngle <= -maxDegrees) {
            newAngle += maxDegrees;
        }
        setPalette.call({paletteAngle: newAngle});
    }

    const handleDialEnd = (event) => {
        touchWrapper(event, (ev, id) => {
            if (dialingPointer.current === id) {
                if (modeStartTime.current) {
                    const timeDiff = ev.timeStamp - modeStartTime.current;
                    if (!dialTurning.current && timeDiff < 600) {
                        // keep mode
                        if (currentCommand.current) {
                            revertMode.call();
                        }
                    } else if (!dialTurning.current && holdReset.current && timeDiff > 3000) {
                        resetUndo.call();
                        if (currentCommand.current) {
                            revertMode.call();
                        }
                    } else {
                        revertMode.call();
                    }
                    modeStartTime.current = null;
                }

                dialStartPoint.current = null;
                dialStartAngle.current = null;
                dialTurning.current = false;
                dialingPointer.current = null;
                currentCommand.current = false;
                holdReset.current = false;
                document.removeEventListener('pointerup', handleDialEnd);
                document.removeEventListener('pointercancel', handleDialEnd);
                document.removeEventListener('touchend', handleDialEnd);
                document.removeEventListener('touchcancel', handleDialEnd);
            }
        });
    };

    const modeChangeStart = (mode, command = false) => {
        return (ev) => {
            if (modeStartTime.current === null) {
                if (props.state.Ui?.mode === mode) {
                    setFlash(true);
                    setTimeout(() => {
                        setFlash(false);
                    }, 100);
                }
                modeStartTime.current = ev.timeStamp;
                if (command) {
                    currentCommand.current = true;
                    switch (mode) {
                        case 'zoom':
                            if ((props.state.Ui?.viewbox?.zoom ?? 1) < 1) {
                                setZoom.call({zoom: 1});
                            } else {
                                setZoom.call({zoom: 0.25});
                            }
                            break;
                        case 'switch':
                            setPaletteVersion.call({version: "v1"});
                            break;
                        case 'undo':
                            undo.call();
                            break;
                        case 'redo':
                            redo.call();
                            break;
                        case 'load':
                            const file = document.createElement('input');
                            file.hidden = true;
                            file.type = 'file';
                            file.accept = 'application/json';
                            file.click();
                            file.addEventListener('change', (ev) => {
                                if (ev.target.files.length > 0) {
                                    const reader = new FileReader();
                                    reader.readAsText(ev.target.files[0], 'UTF-8');
                                    reader.addEventListener('loadend', (ev) => {
                                        load.call({state: ev.target.result});
                                    });
                                }
                                file.remove();
                            }, false);
                            break;
                        case 'save':
                            const saveObject = {things: props.state.Things, connections: props.state.Connections}
                            const blob = new Blob([JSON.stringify(saveObject, null, 2)],
                                {type: 'application/json'});
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.hidden = true;
                            link.download = 'solvi.json';
                            link.href = url;
                            link.click();
                            link.remove();
                            URL.revokeObjectURL(url);
                            break;
                        case 'clear':
                            props.solverDispatch({type: 'resetSolve'});
                            clear.call();
                            holdReset.current = true;
                            break;
                        case 'knapsack':
                            load.call({state: JSON.stringify(knapsackJSON)});
                            break;
                        case 'wedding':
                            load.call({state: JSON.stringify(weddingJSON)});
                            break;
                        case 'teaching':
                            load.call({state: JSON.stringify(teachingJSON)});
                            break;
                    }
                } else {
                    switch (mode) {
                        case 'solve':
                            if (props.state.Ui?.mode !== 'solve') {
                                props.solverDispatch({type: 'resetSolve'});
                            }
                            break;
                        default:
                            if (props.state.Ui?.mode === 'solve' && mode !== 'solve' &&
                                !props.solverState.solving &&
                                !props.solverState.solved) {
                                props.solverDispatch({type: 'startSolve'});
                                solve.call({find: props.solverState.findable}, (err, res) => {
                                    props.solverDispatch({type: 'setActiveSolver', payload: res});
                                });
                            }
                            break;
                    }
                }
                setMode.call({mode});
            }
        }
    }

    return (props.state.loaded ? (
            <div
                style={combineCSS(styles.halfCircle)}
                ref={dialRef}
                draggable={false}
                onPointerDown={handleDialStart}
                onTouchStart={handleDialStart}
                onWheel={handleDialWheel}
            >
                {generateIconList(dialList, props.state.Ui?.paletteAngle)}
            </div>
        ) : null
    )
}

export default LeftPaletteV2;