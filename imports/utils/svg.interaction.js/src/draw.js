"use strict";

import * as SVG from '@svgdotjs/svg.js';
import {touchWrapper, getOffsetCoords, getPointerId, hasPointerEvents} from "./util/events";

SVG.extend(SVG.Element, {
    drawable(enable) {

        let activePaths = {};

        const offsetFromViewBox = (x, y, viewbox) => {
            return `${x + viewbox.x} ${y + viewbox.y}`
        };

        const drawStart = (ev) => {
            touchWrapper(ev, (ev) => {
                if (ev.button && ev.button !== 0) return;
                if (this.dispatch('drawbeforestart', {event: ev, handler: this}).defaultPrevented) {
                    return;
                }
                let id = getPointerId(ev);
                let offsetCoord = getOffsetCoords(ev);
                let pathSvg = [Date.now(), `M ${offsetFromViewBox(offsetCoord.x, offsetCoord.y, this.viewbox())}`];
                activePaths[id] = {
                    path: this.path(pathSvg[1]).fill('none').stroke({
                        color: 'dimgray',
                        width: 2
                    }),
                    svg: [pathSvg,]
                };
                this.fire('drawstart', {event: ev, handler: this, path: activePaths[id]});
            });
        };

        const drawMove = (ev) => {
            touchWrapper(ev, (ev) => {
                let id = getPointerId(ev);
                if (id in activePaths && this.root() === ev.target.instance.root()) {
                    let offsetCoord = getOffsetCoords(ev);
                    activePaths[id].svg.push([Date.now(), ` L ${offsetFromViewBox(offsetCoord.x, offsetCoord.y, this.viewbox())}`]);
                    activePaths[id].path.plot(activePaths[id].svg.map(el => el[1]).join(' '));
                    this.fire('drawmove', {event: ev, handler: this, path: activePaths[id]});
                }
            });
        };

        const drawEnd = (ev) => {
            touchWrapper(ev, (ev) => {
                let id = getPointerId(ev);
                if (id in activePaths) {
                    this.fire('drawend', {event: ev, handler: this, path: activePaths[id]});
                    delete activePaths[id];
                }
            });
        };

        const init = (enable) => {
            if (enable) {
                if (hasPointerEvents()) {
                    this.on('pointerdown.draw', drawStart);
                    this.on('pointermove.draw', drawMove);
                    SVG.on(document, 'pointerup.draw', drawEnd);
                } else {
                    this.on('touchstart.draw', drawStart);
                    this.on('touchmove.draw', drawMove);
                    SVG.on(document, 'touchend.draw', drawEnd);
                }
            } else {
                this.off('.draw');
                SVG.off(document, '.draw');
            }
        };

        init(enable);

        return this;

    }
});