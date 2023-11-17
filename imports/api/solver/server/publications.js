import {Meteor} from "meteor/meteor";

import {Solver} from "../collection";

Meteor.publish('Solver', () => {
    return Solver.find();
});