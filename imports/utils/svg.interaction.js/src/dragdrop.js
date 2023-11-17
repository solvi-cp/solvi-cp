"use strict";

import * as SVG from '@svgdotjs/svg.js';
import {touchWrapper, getPointerId, hasPointerEvents} from "./util/events";
import {on, off} from "@svgdotjs/svg.js";
import interact from 'interactjs';

import {_} from 'meteor/underscore';

const createTarget = (target) => {
    if (target.root() === target) {
        return target;
    } else {
        const targetBbox = target.bbox();
        return target.rect(targetBbox.width + 10, targetBbox.height + 10)
            .center(targetBbox.cx, targetBbox.cy)
            .opacity(0)
            .front()
            .addClass('dragdrop');
    }
}

SVG.extend(SVG.Element, {
    dragSource(group) {
        let pointerId;

        const draggable = {
            onstart: (ev) => {
                if (ev.button && ev.button !== 0 && !group) return;
                if (this.dispatch('dragdropbeforestart', {event: ev, handler: this}).defaultPrevented) {
                    return;
                }
                pointerId = getPointerId(ev);
                const currentClick = this.point({x: ev.pageX, y: ev.pageY});
                this.fire('dragdropstart', {event: ev, handler: this, x: currentClick.x, y: currentClick.y});
            },
            onmove: (ev) => {
                if (pointerId === getPointerId(ev) && this.root() === ev.target.instance.root() && !!group) {
                    try {
                        const currentClick = this.point({x: ev.pageX, y: ev.pageY});
                        this.fire('dragdropmove', {event: ev, handler: this, x: currentClick.x, y: currentClick.y});
                    } catch (err) {

                    }
                }
            },
            onend: (ev) => {
                if (pointerId === getPointerId(ev) && !!group) {
                    try {
                        const currentClick = this.point({x: ev.pageX, y: ev.pageY});
                        this.fire('dragdropend', {event: ev, handler: this, x: currentClick.x, y: currentClick.y});
                    } catch (err) {

                    }
                    init(group);
                }
            }
        }

        const disableDrag = (ev) => {
            touchWrapper(ev, (ev) => {
                //disable drag and pan
                if (this.target.parent('.pan')) {
                    on(this.target.parent('.pan'), 'dragbeforestart.dragdrop', (ev) => {
                        ev.preventDefault();
                    });
                }
                if (this.target.root()) {
                    on(this.target.root(), 'panbeforestart.dragdrop', (ev) => {
                        ev.preventDefault();
                    });
                }
            });
        };

        const init = (group) => {
            pointerId = null;

            if (this.target?.parent('.thing')) {
                off(this.target.parent('.thing'), '.dragdrop');
            }

            if (this.target?.parent('.pan')) {
                off(this.target.parent('.pan'), '.dragdrop');
            }

            if (this.target?.root()) {
                off(this.target.root(), '.dragdrop');
            }

            if (this.target) {
                interact(this.target.node).draggable(false);
                off(this.target, '.dragdrop');
            }

            if (group === false) return;

            if (!this.target) {
                this.target = createTarget(this);
                interact(this.target.node).styleCursor(false).draggable(draggable);
            }

            if (hasPointerEvents()) {
                this.target.on('pointerdown.dragdrop', disableDrag, this);
            } else {
                this.target.on('touchstart.dragdrop', disableDrag, this);
            }

            this.target.on('dragdropped.dragdrop', (ev) => {
                this.fire('dragdropend', {event: ev, handler: this});
                let sourceGroups = group;
                if (!Array.isArray(sourceGroups)) sourceGroups = [sourceGroups];
                let destinationGroups = ev.detail.group;
                if (!Array.isArray(destinationGroups)) destinationGroups = [destinationGroups];
                if (_.intersection(sourceGroups, destinationGroups).length > 0)
                    this.fire('dragdropsuccess', {event: ev, handler: this})
            });
        };

        init(group);

        return this;

    }
});

SVG.extend(SVG.Element, {
    dropTarget(group) {
        const dropzone = {
            accept: '.dragdrop',
            checker: (dragEvent,
                      event,
                      dropped,
                      dropzone,
                      dropElement,
                      draggable,
                      draggableElement) => {
                return dropped && !!group;
            },

            ondropactivate: (ev) => {
                //console.log(ev)
            },
            ondragenter: (ev) => {
                // console.log(ev)
            },
            ondragleave: (ev) => {
                // console.log(ev)
            },
            ondrop: (ev) => {
                if (this?.root() && group) {
                    if (ev.target?.instance === this.target) {
                        let id = getPointerId(ev);
                        ev.relatedTarget.instance
                            .fire('dragdropped', {event: ev, id: id, group: group, handler: this});
                    }
                }
            },
            ondropdeactivate: (ev) => {
                //console.log(ev)
            }
        }

        const init = (group) => {
            if (!this.target) {
                this.target = createTarget(this);
                interact.dynamicDrop(true);
                interact(this.target.node).dropzone(dropzone);
            }
        }

        init(group);

        return this;
    }
});
