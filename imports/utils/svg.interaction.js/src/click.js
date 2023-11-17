"use strict";

import * as SVG from '@svgdotjs/svg.js';
import {touchWrapper, getOffsetCoords, getPointerId, hasPointerEvents} from "./util/events";

SVG.extend(SVG.Element, {
    clickable(enable) {

        let activeIds = {};

        const clickStart = (ev) => {
            touchWrapper(ev, (ev) => {
                if (ev.button && ev.button !== 0) return;
                if (this.dispatch('clickbeforestart', {event: ev, handler: this}).defaultPrevented) {
                    return;
                }
                let id = getPointerId(ev);
                activeIds[id] = true;
                this.fire('clickstart', {event: ev, handler: this});
            });
        };

        const clickEnd = (ev) => {
            touchWrapper(ev, (ev) => {
                let id = getPointerId(ev);
                if (id in activeIds) {
                    if (this.root() === ev.target.instance.root()) {
                        const point = this.point(ev.pageX, ev.pageY);
                        this.fire('clickend', {
                            event: ev,
                            handler: this,
                            x: point.x,
                            y: point.y
                        });
                    }
                    delete activeIds[id];
                }
            });
        };

        const init = (enable) => {
            if (enable) {
                if (hasPointerEvents()) {
                    this.on('pointerdown.click', clickStart);
                    SVG.on(document, 'pointerup.click', clickEnd);
                } else {
                    this.on('touchstart.click', clickStart);
                    SVG.on(document, 'touchend.click', clickEnd);
                }
            } else {
                this.off('.click');
                SVG.off(document, '.click');
            }
        };

        init(enable);

        return this;

    }
});