"use strict";

import {Box, Element, G, extend, off, on} from '@svgdotjs/svg.js'
import {touchWrapper, getPointerId, hasPointerEvents} from "./util/events";

extend(Element, {
    draggable(enable) {

        let pointerId;
        let startBox;
        let startClick;

        const init = (enabled) => {
            pointerId = null;
            this.off('.drag');
            off(document, '.drag');
            if (this.root()) {
                off(this.root(), '.drag');
            }
            if (enabled) {
                if (hasPointerEvents()) {
                    this.on('pointerdown.drag', startDrag);
                } else {
                    this.on('touchstart.drag', startDrag);
                }
            }
        };

        // Start dragging
        const startDrag = (ev) => {
            touchWrapper(ev, (ev) => {
                if (ev.button && ev.button !== 0) return;
                // Fire beforedrag event
                if (this.dispatch('dragbeforestart', {event: ev, handler: this}).defaultPrevented) {
                    return;
                }

                // Make sure that start events are unbound so that one element
                // is only dragged by one input only
                init(false);

                //disable pan
                if (this.root()) {
                    on(this.root(), 'panbeforestart.drag', (ev) => {
                        ev.preventDefault();
                    });
                }

                pointerId = getPointerId(ev);
                startBox = this.bbox();
                startClick = this.point({x: ev.pageX, y: ev.pageY});

                // Bind drag and end events to window
                if (hasPointerEvents()) {
                    on(document, 'pointermove.drag', drag);
                    on(document, 'pointercancel.drag', endDrag);
                    on(document, 'pointerup.drag', endDrag);
                } else {
                    on(document, 'touchmove.drag', drag);
                    on(document, 'touchend.drag', endDrag);
                    on(document, 'touchcancel.drag', endDrag);
                }

                this.opacity(0.5);

                // Fire dragstart event
                this.fire('dragstart', {event: ev, handler: this, box: startBox});
            });
        };

        // While dragging
        const drag = (ev, cb) => {
            touchWrapper(ev, (ev) => {
                if (pointerId === getPointerId(ev) && this.root() === ev.target.instance.root()) {
                    const currentClick = this.point({x: ev.pageX, y: ev.pageY});
                    let x = startBox.x + (currentClick.x - startClick.x);
                    let y = startBox.y + (currentClick.y - startClick.y);
                    let newBox = new Box(x, y, startBox.w, startBox.h);

                    const evResult = this.dispatch('dragbeforemove', {
                        event: ev,
                        handler: this,
                        box: newBox,
                        x: x,
                        y: y
                    });

                    if (evResult.defaultPrevented) {
                        return;
                    } else {
                        x = evResult.detail.x;
                        y = evResult.detail.y;
                        newBox = new Box(x, y, startBox.w, startBox.h);
                    }

                    move(x, y);

                    this.fire('dragmove', {
                        event: ev,
                        handler: this,
                        box: newBox
                    });

                    if (cb) {
                        cb(newBox);
                    }
                }
            });
        };

        const move = (x, y) => {
            // Svg elements bbox depends on their content even though they have
            // x, y, width and height - strange!
            // Thats why we handle them the same as groups
            if (this.type === 'svg') {
                G.prototype.move.call(this, x, y);
            } else {
                this.move(x, y);
            }
        };

        const endDrag = (ev) => {
            touchWrapper(ev, (ev) => {
                if (pointerId === getPointerId(ev)) {
                    if (this.root() === ev.target.instance.root()) {
                        // final drag
                        drag(ev, (endBox) => {
                            // fire dragend event
                            this.fire('dragend', {
                                event: ev, handler: this, box: endBox,
                                changed: (startBox.x !== endBox.x) || (startBox.y !== endBox.y)
                            });
                        });
                    }

                    this.opacity(1);

                    init(true);

                }
            });
        };

        init(enable);

        return this;

    }
});