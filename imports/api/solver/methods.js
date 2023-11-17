import {ValidatedMethod} from 'meteor/mdg:validated-method';
import SimpleSchema from "simpl-schema";

import {Random} from 'meteor/random';

import {Things} from "../things/collection";
import {Solver} from "./collection";
import {
    getAttributeById,
    getAttributeByReducerId,
    getAttributeValue, getCalculatedValues,
    getConstraintsOriginators,
    getReducers, getSelectors,
    walkTreeWithData
} from "../../utils/api";
import {
    aggregationSuchThat,
    attributeFunction,
    capacity,
    constraintContainerOrder, constraintGen,
    constraintWalk, containerTypeSelectorRepresentative,
    contains,
    defineObjects,
    essenceHeader,
    findStatements,
    notRepeatedType,
    objectTypeSelectorRepresentative,
    relationshipConstraintPartial,
    repeatedType,
    sanitiseName, selectorRepresentativeConstraint
} from "../../utils/essence";
import {Connections} from "../connections/collection";

const runSolverConjure = async (problemId, problem, optimisation = true) => {
    if (Meteor.isServer) {
        Solver.update({problemId: problemId}, {
            $set: {
                startTime: new Date()
            }
        });
        const fs = require('fs');
        const util = require('util');
        const execFile = util.promisify(require('child_process').execFile);

        await fs.promises.mkdir(`/tmp/${problemId}`);
        const problemFilePath = `/tmp/${problemId}/${problemId}.essence`;
        const solutionJSONFilePath = `/tmp/${problemId}/conjure-output/model000001.solutions.json`;
        const solutionFilePath = `/tmp/${problemId}/conjure-output/model000001.solutions`;
        const problemFile = await fs.promises.open(problemFilePath, 'w');
        await problemFile.writeFile(problem);
        await problemFile.close();

        try {
            const solutionsJSON = new Set();
            const solutionsRaw = new Set();
            const stdoutArray = [];
            const stderrArray = [];
            for (let i = 0; i < 10; i++) {
                let hasSolutions = false;
                const {stdout, stderr} = await execFile('conjure', ['solve',
                    '--solver=chuffed',
                    // '--solver=cadical',
                    '--solutions-in-one-file',
                    '--limit-time=600',
                    '--output-format=json',
                    problemFilePath], {cwd: `/tmp/${problemId}`});

                console.log(stdout);
                stdoutArray.push(stdout + '\n');

                if (stderr) {
                    console.error(stderr);
                    stderrArray.push(stderr + '\n');
                    continue;
                }

                if (stdout.includes('No solutions found.')) {
                    continue;
                } else {
                    hasSolutions = true;
                }
                if (hasSolutions) {
                    const solutionFile = await fs.promises.open(solutionFilePath, 'r');
                    const solutionJSONFile = await fs.promises.open(solutionJSONFilePath, 'r');
                    const solution = await solutionFile.readFile({encoding: 'utf8'});
                    const solutionJSON = await solutionJSONFile.readFile({encoding: 'utf8'});
                    await solutionFile.close();
                    await solutionJSONFile.close();

                    // console.log(solution);
                    // console.log(solutionJSON);

                    const solutionJSONLines = solutionJSON.split('}\n').filter(el => el).map(el => el + '}')
                        .join('');

                    solutionsRaw.add('Solution ' + (i + 1) + '\n' + solution);
                    solutionsJSON.add(solutionJSONLines);
                    if (solutionsJSON.size >= 10) {
                        break;
                    }
                }
            }

            if (solutionsJSON.size) {
                Solver.update({problemId: problemId}, {
                    $set: {
                        endTime: new Date(),
                        ran: true,
                        stdout: stdoutArray.join('\n'),
                        stderr: stderrArray.join('\n'),
                        solution: [...solutionsRaw].join('\n'),
                        solutionJson: [...solutionsJSON],
                        solved: true
                    }
                });
            } else {
                Solver.update({problemId: problemId}, {
                    $set: {
                        endTime: new Date(),
                        solved: false,
                        ran: true,
                        stdout: stdoutArray.join('\n'),
                        stderr: stderrArray.join('\n'),
                        error: 'no solutions'
                    }
                });
            }
        } catch (err) {
            console.error(err);
            Solver.update({problemId: problemId}, {
                $set: {
                    endTime: new Date(),
                    solved: false,
                    ran: true,
                    stdout: err.stdout,
                    stderr: err.stderr,
                    error: err.toString()
                }
            });
        } finally {
            await fs.promises.rmdir(`/tmp/${problemId}`, {recursive: true});
        }
    }
}

const runSolverAthanor = async (problemId, problem, optimisation = true) => {
    if (Meteor.isServer) {
        Solver.update({problemId: problemId}, {
            $set: {
                startTime: new Date()
            }
        });
        const fs = require('fs');
        const util = require('util');
        const execFile = util.promisify(require('child_process').execFile);

        await fs.promises.mkdir(`/tmp/${problemId}`);
        const problemFilePath = `/tmp/${problemId}/problem.essence`;
        const solutionFilePath = `/tmp/${problemId}/solution.essence`;
        const problemFile = await fs.promises.open(problemFilePath, 'w');
        await problemFile.writeFile(problem);
        await problemFile.close();

        try {
            const solutionsJSON = new Set();
            const solutionsRaw = new Set();
            const stdoutArray = [];
            const stderrArray = [];
            for (let i = 0; i < 10; i++) {
                let hasSolutions = false;
                const {stdout, stderr} = await execFile('athanor',
                    ['--spec', problemFilePath, '--save-best-solution', solutionFilePath, '--real-time-limit'
                        , '10'],
                    {cwd: `/tmp/${problemId}`});

                console.log(stdout);
                stdoutArray.push(stdout + '\n');

                if (stderr) {
                    console.error(stderr);
                    stderrArray.push(stderr + '\n');
                    continue;
                }

                if (!stdout.includes('solution start')) {
                    continue;
                } else {
                    hasSolutions = true;
                }

                if (hasSolutions) {
                    const {stdout, stderr} = await execFile('conjure',
                        ['pretty', '--output-format=json', solutionFilePath],
                        {cwd: `/tmp/${problemId}`});

                    const solutionFile = await fs.promises.open(solutionFilePath, 'r');
                    const rawSolution = await solutionFile.readFile({encoding: 'utf8'})
                    solutionsRaw.add('Solution ' + (i + 1) + '\n' + rawSolution);
                    solutionsJSON.add(stdout);

                    await solutionFile.close();

                    if (solutionsJSON.size >= 10) {
                        break;
                    }
                }
            }

            if (solutionsJSON.size) {
                Solver.update({problemId: problemId}, {
                    $set: {
                        endTime: new Date(),
                        ran: true,
                        stdout: stdoutArray.join('\n'),
                        stderr: stderrArray.join('\n'),
                        solution: [...solutionsRaw].join('\n'),
                        solutionJson: [...solutionsJSON],
                        solved: true
                    }
                });
            } else {
                Solver.update({problemId: problemId}, {
                    $set: {
                        endTime: new Date(),
                        solved: false,
                        ran: true,
                        stdout: stdoutArray.join('\n'),
                        stderr: stderrArray.join('\n'),
                        error: 'no solutions'
                    }
                });
            }
        } catch (err) {
            console.error(err);
            Solver.update({problemId: problemId}, {
                $set: {
                    endTime: new Date(),
                    solved: false,
                    ran: true,
                    stdout: err.stdout,
                    stderr: err.stderr,
                    error: 'run error'
                }
            });
        } finally {
            await fs.promises.rmdir(`/tmp/${problemId}`, {recursive: true});
        }
    }
}

export const solve = new ValidatedMethod({
    name: 'Solver.solve',
    validate: new SimpleSchema({
        find: {type: Array},
        'find.$': {type: String}
    }).validator(),
    run({find}) {
        function addToObjectMaps(name, newData, objectsToTypeArray,
                                 typeToObjectArray, objectsToAttributesValue, attributeToObjectsValue) {
            objectsToTypeArray[name] = newData.types;
            newData.types.forEach(type => {
                typeToObjectArray[type] = [
                    ...typeToObjectArray[type] ?? [],
                    name
                ]
            });
            objectsToAttributesValue[name] = newData.attributes;
            Object.entries(newData.attributes).forEach(([key, value]) => {
                attributeToObjectsValue[key] = {
                    ...attributeToObjectsValue[key],
                    [name]: value
                }
            });
        }

        function addContainerToMap(name, newData, container, containersToContainerTypeArray,
                                   containerTypeToContainerArray, containerToAttributeValue,
                                   attributeToContainersValue, containerToTypeAttributes) {
            containersToContainerTypeArray[name] = newData.types;
            newData.types.forEach(type => {
                containerTypeToContainerArray[type] = [
                    ...containerTypeToContainerArray[type] ?? [],
                    name
                ]
            });
            containerToAttributeValue[name] = newData.attributes;
            Object.entries(newData.attributes).forEach(([key, value]) => {
                attributeToContainersValue[key] = {
                    ...attributeToContainersValue[key],
                    [name]: value
                }
            });
            containerToTypeAttributes[name] = {
                ordered: container.typeAttributes.ordered,
                circular: container.typeAttributes.circular,
                capacity: container.typeAttributes.capacity,
                repeated: container.typeAttributes.repeated
            }
        }

        try {
            const output = [];
            let optimising = false;
            const problemState = {};

            /*
            Stage 1
            Maps to Create:
            Object -> Type
            Type -> Object
            Object -> Attribute -> Value
            Attribute -> Object -> Value
             */
            const objectsToTypeArray = {};
            const typeToObjectArray = {};
            const objectsToAttributesValue = {};
            const attributeToObjectsValue = {};

            const objectTypesObj = Things.find({type: 'object_type'});
            objectTypesObj.forEach(el => {
                const isInstance = Object.keys(el.outConnections?.instanceOf ?? {}).some(el => {
                    const thing = Things.findOne(el);
                    return ['object', 'container', 'object_type', 'container_type'].includes(thing?.type)
                });
                if (!isInstance) {
                    walkTreeWithData(el._id,
                        (id) => {
                            const node = Things.findOne(id);
                            return Object.keys(node?.outConnections?.instanceOf ?? {})
                        },
                        (id) => {
                            const node = Things.findOne(id);
                            return Object.keys(node?.inConnections?.instanceOf ?? {})
                        },
                        (id, initial, data) => {
                            const object = Things.findOne(id);
                            if (!object) return data;
                            const attributes = {};
                            object.attributes.forEach(el => {
                                const value = getAttributeValue(el.attributeId);
                                if (value !== undefined && value !== null) {
                                    attributes[el.key] = value;
                                }
                            });

                            const name = object.typeAttributes.name;
                            let newData = {
                                ...data ?? {},
                                attributes: {
                                    ...data?.attributes ?? {},
                                    ...attributes
                                }
                            };

                            if (object.type === 'object_type') {
                                newData = {
                                    ...newData,
                                    types: [...data?.types ?? [], name]
                                }
                            }

                            if (object.type === 'object') {
                                addToObjectMaps(name, newData, objectsToTypeArray, typeToObjectArray,
                                    objectsToAttributesValue, attributeToObjectsValue);
                            } else if (object.type === 'object_type') {
                                if (object.typeAttributes.amount >
                                    Object.keys(object.inConnections?.instanceOf ?? {}).length) {
                                    const difference = object.typeAttributes.amount -
                                        Object.keys(object.inConnections?.instanceOf ?? {}).length;
                                    for (let i = 0; i < difference; i++) {
                                        addToObjectMaps(name + ' auto' + i, newData, objectsToTypeArray,
                                            typeToObjectArray, objectsToAttributesValue,
                                            attributeToObjectsValue);
                                    }
                                }
                            }
                            return newData;
                        },
                        0, undefined, false);
                }
            });

            const objectsObj = Things.find({type: 'object'});
            objectsObj.forEach(el => {
                const isInstance = Object.keys(el.outConnections?.instanceOf ?? {}).some(el => {
                        const thing = Things.findOne(el);
                        return ['object', 'container', 'object_type', 'container_type'].includes(thing?.type)
                    }) ||
                    Object.keys(el.inConnections?.instanceOf ?? {}).some(el => {
                        const thing = Things.findOne(el);
                        return ['object', 'container', 'object_type', 'container_type'].includes(thing?.type)
                    });
                if (!isInstance) {
                    const attributes = {};
                    el.attributes.forEach(el => {
                        const value = getAttributeValue(el.attributeId);
                        if (value !== undefined && value !== null) {
                            attributes[el.key] = value;
                        }
                    });
                    const name = el.typeAttributes.name;
                    addToObjectMaps(name, {
                            attributes: attributes,
                            types: []
                        }, objectsToTypeArray, typeToObjectArray, objectsToAttributesValue,
                        attributeToObjectsValue);
                }
            });

            console.log('objectsToTypeArray');
            console.log(objectsToTypeArray);
            console.log('typeToObjectArray');
            console.log(typeToObjectArray);
            console.log('objectsToAttributesValue');
            console.log(objectsToAttributesValue);
            console.log('attributeToObjectsValue');
            console.log(attributeToObjectsValue);

            problemState['objectsToTypeArray'] = objectsToTypeArray;
            problemState['typeToObjectArray'] = typeToObjectArray;
            problemState['objectsToAttributesValue'] = objectsToAttributesValue;
            problemState['attributeToObjectsValue'] = attributeToObjectsValue;

            /*
           Stage 2
           Maps to Create:
           Container -> Container Type
           Container Type -> Container
           Container -> Attribute -> Value
           Attribute -> Container -> Value
           Container -> Type Attr -> Value
           Container Type  -> Type Attr -> Value
            */
            const containersToContainerTypeArray = {};
            const containerTypeToContainerArray = {};
            const containerToAttributeValue = {};
            const attributeToContainersValue = {};
            const containerToTypeAttributes = {};
            const containerTypeToTypeAttributes = {};

            const containerToRelationshipAttributes = {};
            const containerTypeToRelationshipAttributes = {};

            const containerTypesObj = Things.find({type: 'container_type'});
            containerTypesObj.forEach(el => {
                const isInstance = Object.keys(el.outConnections?.instanceOf ?? {})
                    .some(el => {
                        const thing = Things.findOne(el);
                        return ['object', 'container', 'object_type', 'container_type'].includes(thing?.type)
                    });
                if (!isInstance) {
                    walkTreeWithData(el._id,
                        (id) => {
                            const node = Things.findOne(id);
                            return Object.keys(node.outConnections?.instanceOf ?? {})
                        },
                        (id) => {
                            const node = Things.findOne(id);
                            return Object.keys(node.inConnections?.instanceOf ?? {})
                        },
                        (id, initial, data) => {
                            const container = Things.findOne(id);
                            const attributes = {};
                            container.attributes.forEach(el => {
                                const value = getAttributeValue(el.attributeId);
                                if (el.initial && value !== undefined && value !== null) {
                                    attributes[el.key] = value;
                                }
                            });

                            const name = container.typeAttributes.name;
                            let newData = {
                                ...data ?? {},
                                attributes: {
                                    ...data?.attributes ?? {},
                                    ...attributes
                                }
                            };

                            if (container.type === 'container_type') {
                                newData = {
                                    ...newData,
                                    types: [...data?.types ?? [], name]
                                }
                            }

                            if (container.type === 'container') {
                                addContainerToMap(name, newData, container, containersToContainerTypeArray,
                                    containerTypeToContainerArray, containerToAttributeValue,
                                    attributeToContainersValue, containerToTypeAttributes);
                                const relationshipAttributes = container.pickedRelationships
                                    .filter(el => el.relationshipAttribute)
                                if (relationshipAttributes.length) {
                                    containerToRelationshipAttributes[name] = relationshipAttributes;
                                }
                            } else if (container.type === 'container_type') {
                                if (container.typeAttributes.amount >
                                    Object.keys(container.inConnections?.instanceOf ?? {}).length) {
                                    const difference = container.typeAttributes.amount -
                                        Object.keys(container.inConnections?.instanceOf ?? {}).length;
                                    for (let i = 0; i < difference; i++) {
                                        addContainerToMap(name + ' auto' + i, newData, container,
                                            containersToContainerTypeArray, containerTypeToContainerArray,
                                            containerToAttributeValue, attributeToContainersValue,
                                            containerToTypeAttributes);
                                    }
                                }
                                //add container type, type attr
                                containerTypeToTypeAttributes[name] = {
                                    capacity: container.typeAttributes.capacity,
                                    typeRepeated: container.typeAttributes.typeRepeated,
                                    ordered: container.typeAttributes.ordered,
                                    circular: container.typeAttributes.circular
                                }
                                const relationshipAttributes = container.pickedRelationships
                                    .filter(el => el.relationshipAttribute)
                                if (relationshipAttributes.length) {
                                    containerTypeToRelationshipAttributes[name] = relationshipAttributes;
                                }
                            }
                            return newData;
                        },
                        0, undefined, false);
                }
            });

            const containersObj = Things.find({type: 'container'});
            containersObj.forEach(el => {
                const isInstance = Object.keys(el.outConnections?.instanceOf ?? {})
                        .some(el => {
                            const thing = Things.findOne(el);
                            return ['object', 'container', 'object_type', 'container_type'].includes(thing?.type)
                        }) ||
                    Object.keys(el.inConnections?.instanceOf ?? {}).some(el => {
                        const thing = Things.findOne(el);
                        return ['object', 'container', 'object_type', 'container_type'].includes(thing?.type)
                    });
                if (!isInstance) {
                    const attributes = {};
                    el.attributes.forEach(el => {
                        const value = getAttributeValue(el.attributeId);
                        if (el.initial && value !== undefined && value !== null) {
                            attributes[el.key] = value;
                        }
                    });
                    const name = el.typeAttributes.name;
                    addContainerToMap(name, {attributes: attributes, types: []},
                        el, containersToContainerTypeArray, containerTypeToContainerArray,
                        containerToAttributeValue, attributeToContainersValue, containerToTypeAttributes);
                    const relationshipAttributes = el.pickedRelationships.filter(el => el.relationshipAttribute);
                    if (relationshipAttributes.length) {
                        containerToRelationshipAttributes[name] = relationshipAttributes;
                    }
                }
            });

            console.log('containersToContainerTypeArray');
            console.log(containersToContainerTypeArray);
            console.log('containerTypeToContainerArray');
            console.log(containerTypeToContainerArray);
            console.log('containerToAttributeValue');
            console.log(containerToAttributeValue);
            console.log('attributeToContainersValue');
            console.log(attributeToContainersValue);
            console.log('containerToTypeAttributes');
            console.log(containerToTypeAttributes);
            console.log('containerTypeToTypeAttributes');
            console.log(containerTypeToTypeAttributes);

            console.log('containerToRelationshipAttributes');
            console.log(containerToRelationshipAttributes);
            console.log('containerTypeToRelationshipAttributes');
            console.log(containerTypeToRelationshipAttributes);

            problemState['containersToContainerTypeArray'] = containersToContainerTypeArray;
            problemState['containerTypeToContainerArray'] = containerTypeToContainerArray;
            problemState['containerToAttributeValue'] = containerToAttributeValue;
            problemState['attributeToContainersValue'] = attributeToContainersValue;
            problemState['containerToTypeAttributes'] = containerToTypeAttributes;
            problemState['containerTypeToTypeAttributes'] = containerTypeToTypeAttributes;
            problemState['containerToRelationshipAttributes'] = containerToRelationshipAttributes;
            problemState['containerTypeToRelationshipAttributes'] = containerTypeToRelationshipAttributes;

            // Objects and Containers to index maps
            const thingsToIndex = {};
            const indexToThings = {};
            Object.keys(objectsToTypeArray).concat(Object.keys(containersToContainerTypeArray))
                .forEach((el, i) => {
                    thingsToIndex[el] = i;
                    indexToThings[i] = el;
                });

            console.log('thingsToIndex');
            console.log(thingsToIndex);
            console.log('indexToThings');
            console.log(indexToThings);

            problemState['thingsToIndex'] = thingsToIndex;
            problemState['indexToThings'] = indexToThings;

            /*
            Stage 3
            Container To Objects Mapping
            Array of [object (type)/container (type), container (type)]

            For each find container,

             */
            const putIntoMap = {};
            const putIntoReverseMap = {};
            const containersToProcess = find;
            while (containersToProcess.length > 0) {
                const containerProcessing = containersToProcess.pop();
                const findObject = Things.findOne(containerProcessing);
                const findObjectArray = typeToObjectArray[findObject.typeAttributes.name] ??
                    containerTypeToContainerArray[findObject.typeAttributes.name] ?? [findObject.typeAttributes.name];
                Object.keys(findObject.inConnections?.putInto ?? {}).forEach(el => {
                    const connectedObject = Things.findOne(el);
                    const connectedObjectArray = typeToObjectArray[connectedObject.typeAttributes.name] ??
                        containerTypeToContainerArray[connectedObject.typeAttributes.name] ??
                        [connectedObject.typeAttributes.name];
                    if (connectedObject?.type?.includes('object') || connectedObject?.type?.includes('container')) {
                        findObjectArray.forEach(obj => {
                            connectedObjectArray.forEach(connectedObj => {
                                putIntoMap[connectedObj] = [
                                    ...putIntoMap[connectedObj] ?? [],
                                    obj
                                ]
                                putIntoReverseMap[obj] = [
                                    ...putIntoReverseMap[obj] ?? [],
                                    connectedObj
                                ]
                                if (connectedObj in containerToTypeAttributes) {
                                    putIntoReverseMap[connectedObj] = [
                                        ...putIntoReverseMap[connectedObj] ?? []
                                    ]
                                }
                            })
                        });
                    }
                    if (connectedObject?.type?.includes('container')) {
                        containersToProcess.push(el);
                    }
                });
            }

            console.log('putIntoMap');
            console.log(putIntoMap);
            console.log('putIntoReverseMap');
            console.log(putIntoReverseMap);

            problemState['putIntoMap'] = putIntoMap;
            problemState['putIntoReverseMap'] = putIntoReverseMap;

            /*
            Stage 4
            Parse selectors

             */


            /*
            Stage 5
            Construct essence
             */

            output.push(essenceHeader());

            Object.entries(indexToThings).forEach(([key, value]) => {
                output.push(`$ ${key} --> ${value}`);
            });

            output.push(defineObjects('types', Object.keys(typeToObjectArray)));

            //need to create type map

            Object.entries(attributeToObjectsValue).forEach(([key, value]) => {
                output.push(attributeFunction(key, value, thingsToIndex));
            });

            Object.entries(attributeToContainersValue).forEach(([key, value]) => {
                output.push(attributeFunction(key, value, thingsToIndex));
            });

            const containerMembers = [];

            const containerTypesToProcess = new Set();
            const relationships = {};

            const containerOrderToConstraint = new Set();

            // finds for containers

            Object.entries(putIntoReverseMap).forEach(([key, value]) => {
                const containedContainers = [];
                output.push(findStatements('container', key, value.map(el => thingsToIndex[el]),
                    {
                        minSize: containerToTypeAttributes[key].capacity[0] >= 0 ?
                            containerToTypeAttributes[key].capacity[0] : undefined,
                        maxSize: containerToTypeAttributes[key].capacity[1] >= 0 ?
                            containerToTypeAttributes[key].capacity[1] : undefined,
                        repeated: containerToTypeAttributes[key].repeated,
                        ordered: containerToTypeAttributes[key].ordered
                    }));
                if (containersToContainerTypeArray[key]?.length) {
                    containerTypesToProcess.add(containersToContainerTypeArray[key][0]);
                }
                value.forEach(el => {
                    const containedObj = Things.findOne({'typeAttributes.name': el ?? ''}) ??
                        Things.findOne({'typeAttributes.name': containersToContainerTypeArray[el]?.[0] ?? ''});
                    if (containedObj?.type?.includes('container')) {
                        containerOrderToConstraint.add(el);
                        containedContainers.push(el);
                    }
                });
                containerMembers.push(attributeFunction(key + '_members',
                    _.pick(indexToThings, containedContainers.map(el => thingsToIndex[el]))));
                relationshipConstraintPartial('container', containerToRelationshipAttributes[key],
                    {
                        name: key, isCircular: containerToTypeAttributes[key].circular, thingsToIndex,
                        isOrdered: containerToTypeAttributes[key].ordered
                    })
                    .forEach(el => {
                        if (Array.isArray(el)) {
                            const [k, v] = el;
                            relationships[k] = v;
                        }
                    });
            });

            containerTypesToProcess.forEach(el => {
                output.push(capacity(
                    containerTypeToContainerArray[el],
                    containerTypeToTypeAttributes[el].capacity[0] >= 0 ?
                        containerTypeToTypeAttributes[el].capacity[0] : undefined,
                    containerTypeToTypeAttributes[el].capacity[1] >= 0 ?
                        containerTypeToTypeAttributes[el].capacity[1] : undefined
                ));
                if (!containerTypeToTypeAttributes[el].typeRepeated) {
                    output.push(notRepeatedType(containerTypeToContainerArray[el],
                            [...new Set(Object.keys(putIntoReverseMap).filter(e =>
                                containerTypeToContainerArray[el].includes(e))
                                .reduce((acc, e) => [...acc, ...putIntoReverseMap[e]], [])
                                .map(e => thingsToIndex[e]))], containerTypeToTypeAttributes[el].ordered
                        )
                    );
                }
                relationshipConstraintPartial('container_type', containerTypeToRelationshipAttributes[el],
                    {
                        name: el, containerTypeToContainerArray, thingsToIndex,
                        isOrdered: containerTypeToTypeAttributes[el].ordered
                    })
                    .forEach(([k, v]) => {
                        relationships[k] = v;
                    });
            });

            output.push(...[...containerOrderToConstraint].map(el =>
                constraintContainerOrder(putIntoMap[el], el,
                    thingsToIndex[el], putIntoMap[el].map(e => containerToTypeAttributes[e].ordered))
            ));

            output.push(...containerMembers);
            output.push(attributeFunction('set_members',
                _.pick(indexToThings, Object.keys(thingsToIndex).filter(el => el in containerToTypeAttributes &&
                    !containerToTypeAttributes[el]?.ordered &&
                    !containerToTypeAttributes[el]?.repeated).map(el => thingsToIndex[el]))));
            output.push(attributeFunction('mset_members',
                _.pick(indexToThings, Object.keys(thingsToIndex).filter(el => el in containerToTypeAttributes &&
                    !containerToTypeAttributes[el]?.ordered &&
                    containerToTypeAttributes[el]?.repeated).map(el => thingsToIndex[el]))));
            output.push(attributeFunction('seq_members',
                _.pick(indexToThings, Object.keys(thingsToIndex).filter(el => el in containerToTypeAttributes &&
                    containerToTypeAttributes[el]?.ordered).map(el => thingsToIndex[el]))));

            const putIntoConnectors = Connections.find({type: 'putInto'});

            putIntoConnectors.forEach(el => {
                const sourceThing = Things.findOne(el.sourceId);
                const destinationThing = Things.findOne(el.destinationId);
                if (!(Object.keys(putIntoMap).some(e => e.includes(sourceThing?.typeAttributes?.name)) &&
                    Object.keys(putIntoReverseMap).some(e => e.includes(destinationThing?.typeAttributes?.name))
                )) {
                    return;
                }
                if (sourceThing.type.endsWith('type')) {
                    // TODO also need case for object type into container/cont type
                } else {
                    output.push('such that ' + contains((containerTypeToContainerArray[
                                destinationThing?.typeAttributes?.name] ??
                            [destinationThing?.typeAttributes?.name]).map(e => sanitiseName(e)),
                        ' = ' + thingsToIndex[sourceThing?.typeAttributes?.name],
                        destinationThing?.typeAttributes?.ordered, el.connectorAttributes?.howMany[0] >= 0 ?
                            el.connectorAttributes?.howMany[0] : undefined,
                        el.connectorAttributes?.howMany[1] >= 0 ? el.connectorAttributes?.howMany[1] : undefined))
                }
            });

            const calculatedValues = getCalculatedValues();
            const constraints = getConstraintsOriginators();

            const reducerMap = {};
            const reducers = getReducers();

            const aggregationEssence = [];

            reducers.forEach(reducer => {
                const reducerAttribute = getAttributeByReducerId(reducer._id);
                if (reducerAttribute[1]?.type === 'selector' || reducerAttribute[1]?.type === 'representative') {
                    console.log(reducerAttribute);
                    return;
                }
                if (Object.keys(putIntoReverseMap).includes(reducerAttribute[1]?.typeAttributes?.name) ||
                    Object.keys(putIntoReverseMap).filter(el =>
                        containerTypeToContainerArray[reducerAttribute[1]
                            ?.typeAttributes?.name]?.includes(el)).length) {
                    output.push(findStatements('icon', reducer.icon + '_' + reducerAttribute[0].key
                        + '_' + reducer._id));
                    reducerMap[reducer._id] = reducer.icon + '_' + reducerAttribute[0].key + '_' + reducer._id;
                    const targetAttribute = reducerAttribute[0].key;
                    const startingContainers = containerTypeToContainerArray[
                        reducerAttribute[1].typeAttributes.name] ?? [reducerAttribute[1].typeAttributes.name];
                    const reducerAttributeChain = [];
                    let nextContainers = startingContainers;
                    do {
                        reducerAttributeChain.push(nextContainers.map(e => thingsToIndex[e]));
                        if (!containerToAttributeValue[nextContainers[0]] ||
                            targetAttribute in containerToAttributeValue[nextContainers[0]]) break;
                        nextContainers = nextContainers.reduce((acc, cur) =>
                            _.union(acc, putIntoReverseMap[cur]), [])
                    } while (nextContainers);
                    aggregationEssence.push(aggregationSuchThat(reducer, targetAttribute, reducerAttributeChain,
                        containerToTypeAttributes, indexToThings));
                }
            });

            const calculatedAttributeToObjectsValue = {};
            const calculatedAttributeToContainerValue = {};

            calculatedValues.forEach(([connector, sourceObj, destinationObj]) => {
                const reducerAttribute = getAttributeByReducerId(sourceObj._id);
                const calculatedAttribute = getAttributeById(connector.destinationId);
                if (destinationObj?.type.includes('object')) {
                    calculatedAttributeToObjectsValue[calculatedAttribute[0].key] = {
                        ...calculatedAttributeToObjectsValue[calculatedAttribute[0].key],
                        [destinationObj.typeAttributes.name]: sanitiseName(sourceObj.icon + '_' +
                            reducerAttribute[0].key + '_' + sourceObj._id)
                    }
                } else if (destinationObj?.type.includes('container')) {
                    calculatedAttributeToContainerValue[calculatedAttribute[0].key] = {
                        ...calculatedAttributeToContainerValue[calculatedAttribute[0].key],
                        [destinationObj.typeAttributes.name]: sanitiseName(sourceObj.icon + '_' +
                            reducerAttribute[0].key + '_' + sourceObj._id)
                    }
                }
            });

            Object.entries(calculatedAttributeToObjectsValue).forEach(([key, value]) => {
                output.push(attributeFunction(key, value, thingsToIndex));
            });

            Object.entries(calculatedAttributeToContainerValue).forEach(([key, value]) => {
                output.push(attributeFunction(key, value, thingsToIndex));
            });

            output.push(...aggregationEssence);

            console.log('reducerMap');
            console.log(reducerMap);
            console.log('relationships');
            console.log(relationships);

            constraints.forEach(constraint => {
                output.push(`${constraintWalk(constraint, reducerMap, relationships, thingsToIndex)}`);
                if (['maximise', 'minimise'].includes(constraint.icon)) {
                    optimising = true;
                }
            });

            const selectors = getSelectors();

            console.log('selectors');
            console.log(selectors)

            selectors.forEach(selector => {
                const sourceObj = Things.findOne(Object.keys(selector?.inConnections?.selector ?? {})[0] ?? '');
                if (sourceObj?.type === 'object_type') {
                    const selectedAttribute = [];
                    selector.pickedAttributes.forEach(el => {
                        constraints.forEach(constraint => {
                            const part = constraintGen(constraint, {
                                    [el.attributeId]:
                                        (side) =>
                                            `${sanitiseName(getAttributeById(el.parentAttributeId)[0].key)}(a) ${side}`
                                },
                                {}, thingsToIndex);
                            if (part) {
                                selectedAttribute.push(part);
                            }
                        });
                    });
                    output.push(objectTypeSelectorRepresentative(
                        selector.typeAttributes.name,
                        typeToObjectArray[sourceObj.typeAttributes.name],
                        selectedAttribute,
                        thingsToIndex
                    ));
                } else if (sourceObj?.type === 'container') {
                    //TODO
                } else if (sourceObj?.type === 'container_type') {
                    const selectedAttribute = [];
                    selector.pickedAttributes.forEach(el => {
                        constraints.forEach(constraint => {
                            const part = constraintGen(constraint, {
                                    [el.attributeId]:
                                        (side) =>
                                            `${sanitiseName(getAttributeById(el.parentAttributeId)[0].key)}(a) ${side}`
                                },
                                {}, thingsToIndex);
                            if (part) {
                                selectedAttribute.push(part);
                            }
                        });
                    });
                    const representativeRelationships = {};
                    relationshipConstraintPartial('container_type', selector.pickedRelationships,
                        {
                            name: selector.typeAttributes.name, containerTypeToContainerArray, thingsToIndex,
                            isOrdered: false //containerTypeToTypeAttributes[sourceObj?.typeAttributes.name].ordered
                        })
                        .forEach(([k, v]) => {
                            representativeRelationships[k] = (otherSide) => {
                                return selectorRepresentativeConstraint(selector.typeAttributes.name, v(' = x',
                                    otherSide.substring(otherSide.indexOf(' ') + 1),
                                    otherSide.substring(0, otherSide.indexOf(' '))),
                                    {
                                    repeated: containerTypeToTypeAttributes[sourceObj?.typeAttributes.name].repeated,
                                    ordered: containerTypeToTypeAttributes[sourceObj?.typeAttributes.name].ordered,
                                    isSelector: true
                                });
                            }
                        });
                    constraints.forEach(constraint => {
                        selectedAttribute.push(`${constraintWalk(constraint, {},
                            representativeRelationships, thingsToIndex, false)}`);
                    });
                    output.push(containerTypeSelectorRepresentative(
                        selector.typeAttributes.name,
                        containerTypeToContainerArray[sourceObj.typeAttributes.name],
                        selectedAttribute,
                        thingsToIndex
                    ));
                }
            });

            selectors.forEach(selector => {
                const sourceObj = Things.findOne(Object.keys(selector?.inConnections?.selector ?? {})[0] ?? '');
                if (sourceObj?.type === 'container_type') {
                    const representative = Things.findOne(
                        Object.keys(selector?.outConnections?.representative ?? {})[0] ?? '');
                    if (representative) {
                        representative.pickedAttributes.forEach(el => {
                            //TODO
                        });
                        const representativeRelationships = {};
                        relationshipConstraintPartial('container_type', representative.pickedRelationships,
                            {
                                name: selector.typeAttributes.name, containerTypeToContainerArray, thingsToIndex,
                                isOrdered: containerTypeToTypeAttributes[sourceObj?.typeAttributes.name].ordered,
                                isRepeated: containerTypeToTypeAttributes[sourceObj?.typeAttributes.name]
                                    .repeated,
                            })
                            .forEach(([k, v, a]) => {
                                representativeRelationships[k] = (otherSide) => {
                                    return selectorRepresentativeConstraint(selector.typeAttributes.name, v(
                                        ' = x',
                                        otherSide.substring(otherSide.indexOf(' ') + 1),
                                        otherSide.substring(0, otherSide.indexOf(' '))),
                                        {
                                        repeated: containerTypeToTypeAttributes[sourceObj?.typeAttributes.name]
                                            .repeated,
                                        ordered: containerTypeToTypeAttributes[sourceObj?.typeAttributes.name]
                                            .ordered,
                                        isSelector: false,
                                        isPositional: a,
                                        selectorType: selector.selectorType
                                    });
                                }
                            });
                        constraints.forEach(constraint => {
                            output.push(`${constraintWalk(constraint, {},
                                representativeRelationships, thingsToIndex)}`);
                        });
                    }
                }
            });

            console.log('==============');

            const outputString = output.filter(el => el).join('\n');

            const crypto = require('crypto');
            const problemHash = crypto.createHash('sha1').update(outputString).digest('hex');

            const problemInDb = Solver.findOne({problemHash: problemHash});

            console.log(outputString);
            console.log('==============');

            if (!problemInDb) {
                const problemId = Random.id()
                Solver.insert({
                    problemId: problemId,
                    problemEssence: outputString,
                    indexMap: indexToThings,
                    problemState: problemState,
                    problemHash: problemHash,
                    createTime: new Date(),
                    solved: false,
                    ran: false
                })
                // runSolverAthanor(problemId, outputString, optimising).then();
                runSolverConjure(problemId, outputString, optimising).then();
                return problemId;
            } else {
                console.log('cached result');
                return problemInDb.problemId;
            }
        } catch (err) {
            console.error(err);
        }
    }
});

/*
EXAMPLE OUTPUT

conjure solve --solutions-in-one-file --number-of-solutions="all" --limit-time=10 --output-format=json test.essence

Error: Not supported for optimisation problems:


Running with a time limit of 5 seconds.
I20200430-18:31:10.869(1)? Generating models for /tmp/9QwNGmvia6iKmstxB/9QwNGmvia6iKmstxB.essence
I20200430-18:31:10.869(1)? Generated models: model000001.eprime
I20200430-18:31:10.869(1)? Saved under: conjure-output
I20200430-18:31:10.870(1)? Savile Row: model000001.eprime
I20200430-18:31:10.870(1)? Running minion for domain filtering.
I20200430-18:31:10.870(1)? Running solver: minion
I20200430-18:31:10.870(1)? Copying solution to: /tmp/9QwNGmvia6iKmstxB/9QwNGmvia6iKmstxB.solution

model000001.eprime
model000001.eprime-minion
model000001.eprime-info
model000001.eprime-infor
model000001-solution000001.eprime-solution

model000001-solution000001.solution
model000001-solution000001.solution.json

with sols one file

Running with a time limit of 10 seconds.
Generating models for knapsack.essence
Generated models: model000001.eprime
Saved under: conjure-output
Savile Row: model000001.eprime
Running minion for domain filtering.
Running solver: minion

model000001.eprime
model000001.eprime-info
model000001.eprime-infor
model000001.eprime-minion
model000001.eprime-solutions
model000001.solutions
model000001.solutions.json

Error on timeout
Running with a time limit of 1 seconds.
Generating models for knapsack.essence
Error: Timed out. Total CPU time used by Conjure is 0.984 seconds.


*/