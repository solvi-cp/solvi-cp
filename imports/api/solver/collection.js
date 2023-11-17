import {Mongo} from 'meteor/mongo';
import SimpleSchema from "simpl-schema";

export const Solver = new Mongo.Collection('Solver');

Solver.deny({
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

export const solverSchema = new SimpleSchema({
    problemId: {
        type: String,
        index: true
    },
    problemEssence: {
        type: String,
    },
    indexMap: {
        type: Object,
        blackbox: true
    },
    problemState: {
        type: Object,
        blackbox: true
    },
    problemHash: {
        type: String,
        index: true
    },
    solution: {
        type: String,
        optional: true
    },
    solutionJson: {
        type: Array,
        optional: true
    },
    'solutionJson.$': {
        type: String,
        optional: true
    },
    createTime: {
        type: Date
    },
    startTime: {
        type: Date,
        optional: true
    },
    endTime: {
        type: Date,
        optional: true
    },
    ran: {
        type: Boolean,
        defaultValue: false
    },
    solved: {
        type: Boolean,
        defaultValue: false
    },
    error: {
        type: String,
        optional: true
    },
    stdout: {
        type: String,
        optional: true
    },
    stderr: {
        type: String,
        optional: true
    },
});

Solver.attachSchema(solverSchema);