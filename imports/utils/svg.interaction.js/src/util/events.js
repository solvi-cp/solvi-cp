const hasPointerEvents = () => {
    return (window.PointerEvent) || (window.navigator.pointerEnabled) || (window.navigator.msPointerEnabled)
}

const touchWrapper = (ev, callback) => {
    if (!ev.target.instance) {
        return;
    }
    if (ev.changedTouches) {
        for (let touch of ev.changedTouches) {
            callback(touch, ev);
        }
    } else {
        callback(ev);
    }
    ev.preventDefault();
};

const getOffsetCoords = (ev) => {
    if (!ev.target.instance) {
        return {
            x: ev.offsetX ? ev.offsetX : ev.pageX - ev.target?.parentElement?.offsetLeft,
            y: ev.offsetY ? ev.offsetY : ev.pageY - ev.target?.parentElement?.offsetTop
        }
    } else {
        return {
            x: ev.offsetX ? ev.offsetX : ev.pageX - ev.target.instance.root().node.parentElement.offsetLeft,
            y: ev.offsetY ? ev.offsetY : ev.pageY - ev.target.instance.root().node.parentElement.offsetTop
        }
    }
};

const getPointerId = (ev) => {
    return ev.pointerId ? ev.pointerId : ev.identifier;
};

export {
    touchWrapper,
    getOffsetCoords,
    getPointerId,
    hasPointerEvents
}