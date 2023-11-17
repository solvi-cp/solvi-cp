import {createBoundingBox} from "./Components";
import {constants} from "../../helpers/shared";

export const Sketch = (parentId, parentSvg, paths) => {

    /*
    paths: array of [timestamp, path element]

        return this
        - class: sketch
        - svg data:
            - parentId
     */

    const sketchBbox = parentSvg.group();
    sketchBbox.data('id', parentId);
    sketchBbox.addClass('sketch');
    sketchBbox.addClass('bbox');

    const sketch = sketchBbox.group();
    sketch.addClass('sketch');
    sketch.addClass('inner');

    paths.forEach(path => {
        sketch.path(path.map(line => line[1]).join(' ')).fill('none').stroke({
            color: constants.sketchLineColor,
            width: constants.sketchLineWidth
        });
    });

    createBoundingBox(sketchBbox, sketch.bbox(), constants.sketchBboxColor, constants.sketchBboxOpacity,
        undefined, constants.sketchBoxMinimum);

    return sketch;
}