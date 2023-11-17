import React, {useRef, useEffect} from 'react';
import {SVG, on, off} from '@svgdotjs/svg.js';
import '../../utils/svg.interaction.js';
import ReactDOM from "react-dom";
import {combineCSS} from "../helpers/shared";

import i18n from 'meteor/universe:i18n';

const styles = {
    overlay: {
        height: '100%',
        width: '100%',
        position: 'absolute',
        left: 0,
        top: 0,
        zIndex: 100,
    },
    mask: {
        backgroundColor: 'white',
        touchAction: 'none',
        opacity: 0.7,
        width: '100%',
        height: '100%',
        position: 'absolute',
        left: 0,
        top: 0,
        zIndex: 99
    },
    left: {
        position: 'absolute',
        top: '50%',
        left: 5,
        transform: 'translate(0, -50%)',
        fontSize: '1em'
    },
    leftV2: {
        position: 'absolute',
        top: 15,
        left: 100,
        transform: 'translate(0, -50%)',
        fontSize: '1em'
    },
    center: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: '10em'
    },
    canvas: {
        height: '100vh',
        width: '100vw',
        touchAction: 'none'
    },
    textbox: {
        backgroundColor: 'lightgray',
        borderRadius: 20,
        opacity: 0.9
    }
};

const Portal = ({children}) => {
    return ReactDOM.createPortal(children, document.body)
}

const Overlay = (props) => {
    const canvasRef = useRef(null);
    const draw = useRef(null);

    useEffect(() => {
        if (canvasRef.current) {
            draw.current = SVG().addTo(canvasRef.current).size('100%', '100%');
        }
    }, []);

    return (
        <Portal>
            <div className="overlay" style={styles.overlay} onClick={() => props.setFirstRun(false)}>
                {props.overlayState.rendering.length ?
                    <div
                        style={combineCSS(props.state.Ui?.paletteVersion === "v2" ? styles.leftV2 : styles.left, styles.textbox)}>
                        {i18n.__('ui.rendering')}
                    </div> : null}
                {props.overlayState.error ?
                    <div style={combineCSS(styles.center, styles.textbox)}>
                        {i18n.__('ui.' + props.overlayState.error)}
                    </div> : null}
                {/*{props.state.status ?*/}
                {/*    <div style={combineCSS(props.state.Ui?.paletteVersion === "v2" ? styles.leftV2 : styles.left, styles.textbox)}>*/}
                {/*        {props.state.status.status}*/}
                {/*    </div> : null}*/}
                {props.overlayState.draggingObject ?
                    <div className="canvas" ref={canvasRef} style={styles.canvas}>
                    </div> : null}
            </div>
            <div style={styles.mask}>
            </div>
        </Portal>
    )
}

export default Overlay;