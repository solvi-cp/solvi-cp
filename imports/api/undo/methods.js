import {ValidatedMethod} from 'meteor/mdg:validated-method';
import SimpleSchema from "simpl-schema";

import {Things} from "../things/collection";
import {Connections} from "../connections/collection";
import {Undo} from "./collection";
import {Redo} from "./collection";

export const saveUndo = new ValidatedMethod({
    name: 'Undo.saveUndo',
    validate: null,
    run() {
        const thingsObjects = Things.find().fetch();
        const connectionObjects = Connections.find().fetch();

        Undo.insert({
            createTime: new Date(),
            state: {
                things: thingsObjects,
                connections: connectionObjects
            }
        });
        pruneUndo.call();
        resetRedo.call();
    }
});

export const undo = new ValidatedMethod({
    name: 'Undo.undo',
    validate: null,
    run() {
        const lastUndo = Undo.findOne({},{
           sort:{
               createTime: -1
           }
        });

        if (lastUndo) {
            const thingsObjects = Things.find().fetch();
            const connectionObjects = Connections.find().fetch();
            Redo.insert({
                createTime: new Date(),
                state: {
                    things: thingsObjects,
                    connections: connectionObjects
                }
            });
            Things.remove({});
            Connections.remove({});
            lastUndo?.state?.things?.forEach(el => {
                Things.insert(el);
            });
            lastUndo?.state?.connections?.forEach(el => {
                Connections.insert(el);
            });
            Undo.remove({_id: lastUndo._id});
        }
    }
});

export const redo = new ValidatedMethod({
    name: 'Undo.redo',
    validate: null,
    run() {
        const lastRedo = Redo.findOne({},{
            sort:{
                createTime: -1
            }
        });

        if(lastRedo) {
            const thingsObjects = Things.find().fetch();
            const connectionObjects = Connections.find().fetch();
            Undo.insert({
                createTime: new Date(),
                state: {
                    things: thingsObjects,
                    connections: connectionObjects
                }
            });
            Things.remove({});
            Connections.remove({});
            lastRedo?.state?.things?.forEach(el => {
                Things.insert(el);
            });
            lastRedo?.state?.connections?.forEach(el => {
                Connections.insert(el);
            });
            Redo.remove({_id: lastRedo._id});
        }
    }
});

export const pruneUndo = new ValidatedMethod({
    name: 'Undo.pruneUndo',
    validate: null,
    run() {
        const undoList = Undo.find({}, {
            sort: {
                createTime: 1
            }
        });
        if (undoList.count() > 20) {
            const undoCount = undoList.count();
            undoList.forEach((doc, index, cursor) => {
                if (index < undoCount - 20) {
                    Undo.remove({_id: doc._id});
                }
            });
        }
        resetRedo.call();
    }
});


export const resetUndo = new ValidatedMethod({
    name: 'Undo.resetUndo',
    validate: null,
    run() {
        Undo.remove({})
        resetRedo.call();
    }
});

export const resetRedo = new ValidatedMethod({
    name: 'Undo.resetRedo',
    validate: null,
    run() {
        Redo.remove({});
    }
});