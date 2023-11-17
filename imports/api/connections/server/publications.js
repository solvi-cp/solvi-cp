import {Meteor} from "meteor/meteor";

import {Connections} from "../collection";

Meteor.publish('Connections', () => {
    return Connections.find();
});