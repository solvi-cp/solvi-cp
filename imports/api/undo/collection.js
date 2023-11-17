import {Mongo} from 'meteor/mongo';

export const Undo = new Mongo.Collection('Undo');
export const Redo = new Mongo.Collection('Redo');

Undo.deny({
    insert() {
        return true;
    },
    update() {
        return true;
    },
    remove() {
        return true;
    }
});

Redo.deny({
    insert() {
        return true;
    },
    update() {
        return true;
    },
    remove() {
        return true;
    }
});