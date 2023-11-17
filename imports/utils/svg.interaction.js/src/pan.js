"use strict";

import {Svg, on, off, extend, Matrix, Box} from '@svgdotjs/svg.js';
import {touchWrapper, getOffsetCoords, getPointerId, hasPointerEvents} from "./util/events";

extend(Svg, {
    pannable(options) {

        const setSizeToWindow = (viewbox) => {
            if (viewbox.width === 0 || viewbox.height === 0) {
                viewbox.width = this.node.clientWidth;
                viewbox.height = this.node.clientHeight;
            }
            return viewbox;
        };

        const panStart = (ev) => {
            touchWrapper(ev, (ev) => {
                if (ev.button && ev.button !== 0) return;
                if (this.dispatch('panbeforestart', {event: ev, handler: this}).defaultPrevented) {
                    return;
                }
                this.off('.pan');
                pointerId = getPointerId(ev);
                this.node.setPointerCapture(pointerId);
                const offsetCoord = getOffsetCoords(ev);
                lastP = {x: offsetCoord.x, y: offsetCoord.y};
                lastBox = this.viewbox();
                this.viewbox(setSizeToWindow(lastBox));

                if (hasPointerEvents()) {
                    this.on('pointermove.pan', panning, this);
                    on(document, 'pointerup.pan', panStop, this);
                    on(document, 'pointercancel.pan', panStop, this);
                } else {
                    this.on('touchmove.pan', panning, this);
                    on(document, 'touchend.pan', panStop, this);
                    on(document, 'touchcancel.pan', panStop, this);
                }

                this.fire('panstart', {event: ev, handler: this});
            })
        };

        const panStop = (ev) => {
            touchWrapper(ev, (ev) => {
                let id = getPointerId(ev);
                if (pointerId === id) {
                    this.node.releasePointerCapture(pointerId);
                    pointerId = null;
                    this.off('.pan');
                    off(document, '.pan');

                    this.fire('panend', {event: ev, handler: this});

                    if (hasPointerEvents()) {
                        this.on('pointerdown.pan', panStart, this);
                    } else {
                        this.on('touchstart.pan', panStart, this);
                    }

                }
            });
        };

        const panning = (ev) => {
            touchWrapper(ev, (ev) => {
                let id = getPointerId(ev);
                if (pointerId === id && this.root() === ev.target.instance.root()) {
                    if (this.dispatch('panbeformove', {event: ev, handler: this}).defaultPrevented) {
                        return;
                    }
                    const offsetCoord = getOffsetCoords(ev);
                    const p1 = this.point(offsetCoord.x, offsetCoord.y);
                    const p2 = this.point(lastP.x, lastP.y);
                    const deltaP = [p2.x - p1.x, p2.y - p1.y];
                    const box = new Box(lastBox).transform(new Matrix().translate(deltaP[0], deltaP[1]));
                    this.fire('panmove', {event: ev, handler: this, viewbox: setSizeToWindow(box)});
                }
            });
        };

        let lastP;
        let lastBox;
        let pointerId;

        this.off('.pan');
        off(document, '.pan');

        // when called with false, disable pan
        if (options === false) return this;

        if (hasPointerEvents()) {
            this.on('pointerdown.pan', panStart, this);
        } else {
            this.on('touchstart.pan', panStart, this);
        }

        return this;
    }
});
