import {ValidatedMethod} from 'meteor/mdg:validated-method';
import SimpleSchema from "simpl-schema";
import {Things} from '../things/collection';
import {Connections} from '../connections/collection'
import {saveUndo} from "../undo/methods";

export const load = new ValidatedMethod({
    name: 'Save.load',
    validate: new SimpleSchema({
        state: {
            type: String
        }
    }).validator(),
    run({state}) {
        saveUndo.call();
        const stateObject = JSON.parse(state);
        Things.remove({});
        Connections.remove({});
        stateObject?.things?.forEach(el => {
            Things.insert(el);
        });
        stateObject?.connections?.forEach(el => {
            Connections.insert(el);
        });
    }
});

export const clear = new ValidatedMethod({
    name: 'Save.clear',
    validate: null,
    run() {
        saveUndo.call()
        Things.remove({});
        Connections.remove({});
    }
});