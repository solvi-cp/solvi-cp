import {Meteor} from "meteor/meteor";

import {Things} from "../collection";

Meteor.publish('Things', () => {
    return Things.find();
});