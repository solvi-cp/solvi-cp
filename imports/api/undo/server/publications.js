import {Meteor} from "meteor/meteor";

import {Undo} from "../collection";
import {Redo} from "../collection";

Meteor.publish('Undo', () => {
    return Undo.find();
});

Meteor.publish('Redo', () => {
    return Redo.find();
});