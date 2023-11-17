import {SVG} from "@svgdotjs/svg.js";
import escape from "escape-html";
import {createBoundingBox, updateBoundingBoxWidth} from "./Components";
import {constants} from "../../helpers/shared";

export const NameValue = (id, parentId, parentSvg, {x = 0.0, y = 0.0} = {x: 0.0, y: 0.0}, elements,
                          editable = true, boundingBox = true) => {
    /*
    x: x
    y: y
    elements (array of objects):
        - value: Text shown or selected option value
        - options: array of possible options [text, value]
        - size: css font size
        - border: border color
        - italic: is font italic
        - readOnly: true/false
        - type: string, float, select
        - callback: event callback on update

        returns: this
        - html id -> id
        - class -> namevalue
        - svg data:
            - parentId
     */

    const nameValueBbox = parentSvg.group();
    nameValueBbox.data('id', id);
    if (parentId) {
        nameValueBbox.attr('id', id);
        nameValueBbox.data('parentId', parentId);
    }
    nameValueBbox.addClass('name-value');
    nameValueBbox.addClass('bbox');

    const nameValue = nameValueBbox.group();
    nameValue.addClass('name-value');
    nameValue.addClass('inner');

    const foreignHTMLArray = elements.filter(el => el).map((el) => {
        if (el.type === 'select' || el.type === 'boolean') {
            let options = el.options;
            if (el.type === 'boolean') {
                options = [[true, true], [false, false]];
            }
            const optionsArray = options.map(opt => {
                const [text, val] = opt;
                return `<option ${val === el.value ? "selected" : ""} value="${val}">${text}</option>`
            });
            return `<select ${el.readOnly || !editable ? 'disabled' : ''} ${el.readOnly ? "" : 'class="editable"'}
                style="font-size: ${
                el.size ? el.size : 'inherit'
            }; font-style: ${el.italic ? 'italic' : 'inherit'
            }; border: ${el.border ? '2px solid ' + el.border : 'inherit'}; ">${optionsArray.join("")}</select>`
        } else {
            return `<span ${el.readOnly ? "" : 'class="editable"'} style="font-size: ${el.size ?
                el.size : 'inherit'}; font-style: ${el.italic ? 'italic' : 'inherit'
            }; border: ${el.border ? '2px solid ' + el.border : 'inherit'};
                    " ${el.readOnly || !editable ? "" : "contenteditable"}>${escape(el.value)}</span>`;
        }
    });

    let nameValueHTML = SVG(`<div>${foreignHTMLArray.join('')}</div>`, true);
    let objectAttributeForeign = nameValue.foreignObject(constants.foreignObjectMaxWidth,
        constants.foreignObjectMaxHeight);
    objectAttributeForeign.add(nameValueHTML);

    objectAttributeForeign.bbox = () => {
        const bbox = nameValue.bbox();
        bbox.x = objectAttributeForeign.attr('x');
        bbox.y = objectAttributeForeign.attr('y');
        return bbox;
    };

    objectAttributeForeign.move(constants.boxPadding + x, constants.boxPadding + y);
    objectAttributeForeign.width(nameValueHTML.node.offsetWidth + constants.boxPadding);
    objectAttributeForeign.height(nameValueHTML.node.offsetHeight + constants.boxPadding);
    objectAttributeForeign.node.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            ev.target.blur();
        }
    });

    elements.filter(el => el).forEach((el, index) => {
        if (typeof el.callback === 'function') {
            switch (el.type) {
                case 'select':
                    objectAttributeForeign.node.children[0].children[index]
                        .addEventListener('change', (ev) => {
                            const revert = () => {
                                ev.target.value = elements[index].value;
                            }
                            el.callback(ev, ev.target.value, nameValue, revert)
                        }, true);
                    break;
                case 'string':
                    objectAttributeForeign.node.children[0].children[index]
                        .addEventListener('blur', (ev) => {
                            const revert = () => {
                                ev.target.innerText = elements[index].value;
                            }
                            el.callback(ev, ev.target.innerText, nameValue, revert)
                        }, true);
                    break;
                case 'float':
                case 'number':
                    objectAttributeForeign.node.children[0].children[index]
                        .addEventListener('blur', (ev) => {
                            const revert = () => {
                                ev.target.innerText = elements[index].value;
                            }
                            el.callback(ev, parseFloat(ev.target.innerText), nameValue, revert)
                        }, true);
                    break;
                case 'boolean':
                    objectAttributeForeign.node.children[0].children[index]
                        .addEventListener('change', (ev) => {
                            const revert = () => {
                                ev.target.value = elements[index].value;
                            }
                            el.callback(ev, ev.target.value === 'true', nameValue, revert)
                        }, true);
                    break;
                default:
                    console.warn('Invalid type');
                    break;
            }
            objectAttributeForeign.node.children[0].children[index].addEventListener('focus', (ev) => {
                if (el.type === 'string' || el.type === 'float' || el.type === 'number') {
                    const range = document.createRange();
                    range.selectNodeContents(ev.target);
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                }

                const handleBlur = (ev1) => {
                    if (!ev1.path?.includes(objectAttributeForeign.node)) {
                        ev.target.blur();
                    }
                }

                objectAttributeForeign.node.addEventListener('blur', (ev) => {
                    window.removeEventListener('touchstart', handleBlur);
                    window.removeEventListener('pointerdown', handleBlur);
                });

                window.addEventListener('touchstart', handleBlur);
                window.addEventListener('pointerdown', handleBlur);
            });
        }
    });

    objectAttributeForeign.node.addEventListener('input', (ev) => {
        objectAttributeForeign.width(constants.foreignObjectMaxWidth);
        objectAttributeForeign.width(nameValueHTML.node.offsetWidth + constants.boxPadding);
        updateBoundingBoxWidth(nameValue.parent('.bbox'));
    }, true);

    if (boundingBox) {
        createBoundingBox(nameValueBbox, nameValue.bbox(), constants.nameValueBboxColor, constants.nameValueBboxOpacity);
    }

    return nameValue;
}