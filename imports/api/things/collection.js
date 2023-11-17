import {Mongo} from 'meteor/mongo';
import SimpleSchema from "simpl-schema";

export const Things = new Mongo.Collection('Things');

Things.deny({
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

const typeAttributeSchema = new SimpleSchema({
    name: {
        type: String,
        min: 1,
        max: 40
    },
    ordered: {
        type: Boolean,
        optional: true
    },
    repeated: {
        type: Boolean,
        optional: true
    },
    typeRepeated: {
        type: Boolean,
        optional: true
    },
    circular: {
        type: Boolean,
        optional: true
    },
    amount: {
        type: SimpleSchema.Integer,
        optional: true
    },
    capacity: {
        type: Array,
        optional: true
    },
    'capacity.$': {
        type: SimpleSchema.Integer,
        optional: true
    },
    prototypeType: {
        type: String,
        allowedValues: ['anyOf', 'allOf'],
        optional: true
    }
});

const attributeSchema = new SimpleSchema({
    attributeId: {
        type: String
    },
    key: {
        type: String
    },
    parentAttributeId: {
        type: String,
        optional: true
    },
    initial: {
        type: Boolean
    },
    sourceObj: {
        type: Array,
        optional: true
    },
    'sourceObj.$': {
        type: String
    }
});

const relationshipSchema = new SimpleSchema({
    relationshipAttributeId: {
        type: String
    },
    relationshipAttribute: {
        type: String,
        allowedValues: ['first', 'last', 'before', 'after', 'next', 'previous', 'adjacent', 'contains', 'contains_all',
            'count0', 'count1', ''],
        optional: true
    },
    relationshipAttributeRange: {
        type: Array,
        optional: true
    },
    'relationshipAttributeRange.$': {
        type: SimpleSchema.Integer,
        optional: true
    }
});

const pickedAttributeSchema = new SimpleSchema({
    attributeId: {
        type: String
    },
    parentAttributeId: {
        type: String,
        optional: true
    }
});

export const thingsSchema = new SimpleSchema({
    type: {
        type: String,
        allowedValues: ['object', 'container', 'object_type',
            'container_type', 'value', 'text', 'icon', 'selector', 'representative']
    },
    createTime: {
        type: Date
    },
    updateTime: {
        type: Date
    },
    instancesExpanded: {
        type: Boolean,
        optional: true
    },
    typeAttributes: {
        type: typeAttributeSchema,
        optional: true
    },
    typeAttributesOrder: {
        type: Array,
        optional: true
    },
    'typeAttributesOrder.$': {
        type: String
    },
    repeatedLevels: {
        type: Array,
        optional: true
    },
    'repeatedLevels.$': {
        type: Boolean,
        optional: true
    },
    attributes: {
        type: Array,
        optional: true
    },
    'attributes.$': {
        type: attributeSchema
    },
    selectorType: {
        type: String,
        optional: true,
        allowedValues: ['any', 'all', 'none', 'exists']
    },
    selectorTypeRange: {
        type: Array,
        optional: true
    },
    'selectorTypeRange.$': {
        type: SimpleSchema.Integer,
        optional: true
    },
    pickedRelationships: {
        type: Array,
        optional: true
    },
    'pickedRelationships.$': {
        type: relationshipSchema,
        optional: true
    },
    pickedAttributes: {
        type: Array,
        optional: true
    },
    'pickedAttributes.$': {
        type: pickedAttributeSchema
    },
    x: {
        type: Number,
        optional: true
    },
    y: {
        type: Number,
        optional: true
    },
    paths: {
        type: Array,
        optional: true
    },
    'paths.$': {
        type: Array
    },
    'paths.$.$': {
        type: Array
    },
    'paths.$.$.$': {
        type: SimpleSchema.oneOf(Number, String)
    },
    value: {
        type: SimpleSchema.oneOf(Number, String),
        optional: true
    },
    icon: {
        type: String,
        optional: true
    },
    priority: {
        type: SimpleSchema.Integer,
        optional: true
    },
    reverseConnectors: {
        type: Boolean,
        defaultValue: false,
        optional: true
    },
    inConnections: {
        type: Object,
        blackbox: true,
        optional: true
    },
    outConnections: {
        type: Object,
        blackbox: true,
        optional: true
    },
    attributesAndValuesToLoad: {
        type: Array,
        optional: true,
    },
    'attributesAndValuesToLoad.$': {
        type: Object,
        blackbox:true,
        optional: true
    },
});

Things.attachSchema(thingsSchema);