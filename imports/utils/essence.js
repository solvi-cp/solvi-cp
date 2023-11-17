import {getAttributeValue, getConstraintParts, getRelationshipRelated} from "./api";
import {Things} from "../api/things/collection";
import {isNumber} from "../../svg.js/src/modules/core/regex";

export const sanitiseName = (name) => {
    if (typeof name !== 'string') return name;
    let output = name;
    if (!output) return;
    output = output.replace(/ /g, '_');
    output = output.replace(/[^A-Za-z0-9_]/g, '');
    return 'vis' + output;
}

export const operatorReversal = (text) => {
    switch (text) {
        case 'greaterThan':
            return 'lessThan';
        case 'greaterThanEqual':
            return 'lessThanEqual';
        case 'lessThan':
            return 'greaterThan';
        case 'lessThanEqual':
            return 'greaterThanEqual';
        case 'equals':
            return 'equals';
        case 'notEqual':
            return 'notEqual';
        case 'and':
            return 'and';
        case 'or':
            return 'or';
        case 'not':
            return 'not';
        default:
            return undefined;
    }
}

export const mathTextToSymbol = (text) => {
    switch (text) {
        case 'plus':
            return '+';
        case 'minus':
            return '-';
        case 'times':
            return 'x';
        case 'divide':
            return '/';
        case 'greaterThan':
            return '>';
        case 'greaterThanEqual':
            return '>=';
        case 'lessThan':
            return '<';
        case 'lessThanEqual':
            return '<=';
        case 'equals':
            return '=';
        case 'notEqual':
            return '!=';
        case 'and':
            return '/\\';
        case 'or':
            return '\\/';
        case 'not':
            return '!';
        case 'implication':
            return '->';
        case 'maximise':
            return 'maximising';
        case 'minimise':
            return 'minimising';
        default:
            return text;
    }
}

export const essenceHeader = () => {
    return 'language Essence 1.3';
}

export const defineObjects = (type, objects) => {
    if (objects?.length) {
        return `letting ${sanitiseName(type)} be new type enum {${objects.map(e => `${sanitiseName(e)}`).join(',')}}`;
    }
}

export const attributeFunction = (attributes, attributesMap, indexMap) => {
    let output = `letting ${sanitiseName(attributes)} be function\n`;
    output += `(\n`;
    Object.entries(attributesMap).forEach(([key, value]) => {
        output += `${indexMap ? indexMap[key] : key} --> ${indexMap ? value : sanitiseName(value)},\n`;
    });
    output += `)`;
    return output;
}

export const objectTypeSelectorRepresentative = (selectorName, things, selectorAttributeConstraints, indexMap) => {
    let output = `letting ${sanitiseName(selectorName)} be [a | a: int(`;
    output += things.map(el => indexMap[el]).join(', ');
    output += '), ';
    if (selectorAttributeConstraints?.length) {
        output += selectorAttributeConstraints.join(', ');
    }
    output += ']';
    return output;
}

export const containerTypeSelectorRepresentative = (selectorName, things, selectorAttributeConstraints, indexMap) => {
    let output = `letting ${sanitiseName(selectorName)} be [a | a: int(`;
    output += things.map(el => indexMap[el]).join(', ');
    output += ')';
    if (selectorAttributeConstraints?.length && selectorAttributeConstraints.filter(e => e).length) {
        output += ', '
        output += selectorAttributeConstraints.filter(e => e).join(', ');
    }
    output += ']';
    return output;
}

export const selectorRepresentativeConstraint = (selector, constraint, {
    repeated = false, ordered = false, isSelector = false, isPositional = false,
    selectorType = 'any'
}
    = {repeated: false, ordered: false, isSelector: false, isPositional: false, selectorType: 'any'}) => {
    let output = '';
    if (ordered) {
        output = `exists (_,x) in visseq_members(a) . ${constraint}`;
    } else {
        if (repeated) {
            output = `exists x in vismset_members(a) . ${constraint}`;
        } else {
            output = `exists x in visset_members(a) . ${constraint}`;
        }
    }
    if (isSelector) {
        return output;
    } else {
        switch (selectorType) {
            case 'any':
                if (isPositional) {
                    return `exists a in ${sanitiseName(selector)} . ${constraint}`;
                } else {
                    return `exists a in ${sanitiseName(selector)} . ` + output;
                }
            case 'all':
                if (isPositional) {
                    return `forAll a in ${sanitiseName(selector)} . ${constraint}`;
                } else {
                    return `forAll a in ${sanitiseName(selector)} . ` + output;
                }
            case 'none':
                //TODO
                break;
            case 'exists':
                //TODO
                break;
        }
    }
    //((sum([ toInt(n=x) | n <- visold_students ])) >= 1 /\ (sum([ toInt(n=x) | n <- visold_students ])) <= 99)
}

export const findStatements = (type, findTarget, objectDomain, {
    minSize = 0, maxSize = 99,
    repeated = false, ordered = false
} =
    {minSize: 0, maxSize: 99, repeated: false, ordered: false}) => {
    minSize = Math.min(minSize, objectDomain?.length ?? 0);
    maxSize = repeated ? Math.min(maxSize, 99) : Math.min(maxSize, objectDomain?.length ?? 0);
    if (type.includes('container')) {
        if (ordered) {
            if (repeated) {
                return `find ${sanitiseName(findTarget)} : sequence (minSize ${minSize}, maxSize ${maxSize
                }) of int(${objectDomain.map(sanitiseName).join(',')})`
            } else {
                return `find ${sanitiseName(findTarget)} : sequence (minSize ${minSize}${maxSize === 99 ? '' :
                    ', maxSize ' + maxSize}, injective) of int(${objectDomain.map(sanitiseName).join(',')})`
            }
        } else {
            if (repeated) {
                return `find ${sanitiseName(findTarget)} : mset (minSize ${minSize}, maxSize ${maxSize
                }) of int(${objectDomain.map(sanitiseName).join(',')})`
            } else {
                return `find ${sanitiseName(findTarget)} : set (minSize ${minSize}${maxSize === 99 ? '' :
                    ', maxSize ' + maxSize}) of int(${objectDomain.map(sanitiseName).join(',')})`
            }
        }
    } else {
        //TODO generate bounds using max(attr) * count
        return `find ${sanitiseName(findTarget)} : int(-10000..10000)`
    }
}

export const aggregationSuchThat = (reducer, targetAttribute, reducerAttributeChain,
                                    containerToTypeAttributes, indexToThings) => {
    if (reducer.icon === 'avg') {
        return `such that ${sanitiseName(reducer.icon + '_' + targetAttribute + '_' + reducer._id)} = ${
            aggregationEssence(
                'sum',
                reducerAttributeChain,
                targetAttribute,
                containerToTypeAttributes,
                indexToThings
            )} / ${
            aggregationEssence(
                'sum',
                reducerAttributeChain,
                null,
                containerToTypeAttributes,
                indexToThings
            )}`;
    } else if (reducer.icon === 'spread') {
        return `such that ${sanitiseName(reducer.icon + '_' + targetAttribute + '_' + reducer._id)} = ${
            aggregationEssence(
                'max',
                reducerAttributeChain,
                targetAttribute,
                containerToTypeAttributes,
                indexToThings
            )} - ${
            aggregationEssence(
                'min',
                reducerAttributeChain,
                targetAttribute,
                containerToTypeAttributes,
                indexToThings
            )}`;
    } else {
        return `such that ${sanitiseName(reducer.icon + '_' + targetAttribute + '_' + reducer._id)} = ${
            aggregationEssence(
                reducer.icon === 'count' ? 'sum' : reducer.icon,
                reducerAttributeChain,
                reducer.icon === 'count' ? null : targetAttribute,
                containerToTypeAttributes,
                indexToThings
            )}`;
    }
}

export const constraintContainerOrder = (container, contained, containedInt, ordered) => {
    return `such that (${container.map((e, i) => '(forAll ' + (ordered[i] ? '(_, n)' : 'n') + ' in ' +
        sanitiseName(e) + ' . n != ' + containedInt + ')').join(' /\\ ')}) -> |${sanitiseName(contained)}| = 0`;
}

export const aggregationEssence = (aggregator, objectChain, attribute,
                                   containerToTypeAttributes, indexToThings) => {

    const parts = objectChain.reduce((acc, el, i, array) => {
        const lastChar = i > 0 ? String.fromCharCode('a'.charCodeAt(0) + i - 1) : null;
        const currentChar = String.fromCharCode('a'.charCodeAt(0) + i);
        const lastArray = i > 0 ? array[i - 1] : null;
        const isSequence = containerToTypeAttributes?.[indexToThings?.[lastArray?.[0]]]?.ordered;
        const isRepeated = containerToTypeAttributes?.[indexToThings?.[lastArray?.[0]]]?.repeated;
        return (lastArray ?
                [...acc, {
                    type: 'comprehension',
                    child: isSequence ? `(_,${currentChar})` : `${currentChar}`,
                    parent: `${isSequence ? sanitiseName('seq_members')
                        + '(' + lastChar + ')'
                        : (isRepeated ? sanitiseName('mset_members')
                            + '(' + lastChar + ')'
                            : sanitiseName('set_members')
                            + '(' + lastChar + ')')}`
                }] :
                [...acc, {
                    type: 'comprehension',
                    child: currentChar,
                    parent: `{${el.join(', ')}}`
                }]
        )
    }, []);

    const lastChar = String.fromCharCode('a'.charCodeAt(0) + objectChain.length - 1);

    if (aggregator === 'allDiff') {
        generateComprehension([{reducer: aggregator, listItemPair: parts}], `${lastChar}`);
    }

    return generateComprehension([{reducer: aggregator, listItemPair: parts}], attribute ?
        `${sanitiseName(attribute)} (${lastChar})` : '1');
}

export const constraintWalk = (constraint, reducers, relationships, thingsToIndex, isSuchThat = true) => {
    switch (constraint?.icon) {
        case 'maximise':
        case 'minimise':
            const reducer = getConstraintParts(constraint._id)[0];
            const reducerName = reducers[reducer._id];
            return reducerName ? `${mathTextToSymbol(constraint.icon)} ${sanitiseName(reducerName)}` : '';
        default:
            const statement = constraintGen(constraint, reducers, relationships, thingsToIndex)
            return statement ? (isSuchThat ? `such that ${statement}` : statement) : '';
    }
}

export const relationshipConstraintPartial = (type, relationship = [], props = {}) =>
    relationship.map(el => [el.relationshipAttributeId, (final, other, operator = '=') => {
        if (type === 'container') {
            switch (el.relationshipAttribute) {
                case 'contains':
                    return contains([sanitiseName(props.name)], final, props.isOrdered,
                        el.relationshipAttributeRange[0] >= 0 ? el.relationshipAttributeRange[0] : undefined,
                        el.relationshipAttributeRange[1] >= 0 ? el.relationshipAttributeRange[1] : undefined)
                case 'contains_all':
                    return //contains()
                case 'count0':
                    return `|${sanitiseName(props.name)}| ${final}`
                case 'first':
                case 'last':
                case 'before':
                case 'after':
                case 'previous':
                case 'next':
                case 'adjacent':
                    const relatedObject = getRelationshipRelated(el.relationshipAttributeId);
                    return positionalRelationshipConstraint(
                        el.relationshipAttribute,
                        sanitiseName(props.name),
                        props.isCircular,
                        props.thingsToIndex[relatedObject?.typeAttributes.name],
                        final,
                        undefined,
                        undefined,
                        operator
                    );
            }
        } else if (type === 'container_type') {
            switch (el.relationshipAttribute) {
                case 'contains':
                    // TODO Make more robust, currently just looks for integer
                    if (Number.isInteger(parseInt(other))) {
                        return contains([`[${other}]`], final,
                            false,
                            el.relationshipAttributeRange[0] >= 0 ? el.relationshipAttributeRange[0] : undefined,
                            el.relationshipAttributeRange[1] >= 0 ? el.relationshipAttributeRange[1] : undefined)
                    } else {
                        return contains(other ? [sanitiseName(other)] :
                                props.containerTypeToContainerArray[props.name].map(e => sanitiseName(e)), final,
                            props?.isOrdered,
                            el.relationshipAttributeRange[0] >= 0 ? el.relationshipAttributeRange[0] : undefined,
                            el.relationshipAttributeRange[1] >= 0 ? el.relationshipAttributeRange[1] : undefined)
                    }
                case 'contains_all':
                    return //contains()
                case 'count0':
                    return props.containerTypeToContainerArray[props.name]
                        .map(e => `toInt(|${sanitiseName(e)}| > 0)`).join(' + ') + ' ' + final
                case 'count1':
                    return props.containerTypeToContainerArray[props.name]
                        .map(e => `|${sanitiseName(e)}|`).join(' + ') + ' ' + final
                case 'first':
                case 'last':
                case 'before':
                case 'after':
                case 'previous':
                case 'next':
                case 'adjacent':
                    // TODO Fix
                    let members = ''
                    if (props?.isOrdered) {
                        members = 'visseq_members(a)';
                    } else {
                        if (props?.isRepeated) {
                            members = 'vismset_members(a)';
                        } else {
                            members = 'visset_members(a)';
                        }
                    }
                    const relatedObject = getRelationshipRelated(el.relationshipAttributeId);
                    const relatedId = props.thingsToIndex[relatedObject?.typeAttributes?.name];
                    const otherId = parseInt(other);
                    if (Number.isInteger(otherId)) {
                        return positionalRelationshipConstraint(
                            el.relationshipAttribute,
                            members,
                            props.isCircular,
                            relatedId ?? 'i)',
                            ' = ' + otherId,
                            relatedId ? undefined : `(${
                                relatedObject?.selectorType === 'any' ? 'exists' : 'forAll'} i in ${
                                sanitiseName(relatedObject?.typeAttributes?.name)} . `,
                            undefined,
                            operator
                        );
                    } else {
                        const otherObject = Things.findOne({'typeAttributes.name': other});
                        return positionalRelationshipConstraint(
                            el.relationshipAttribute,
                            members,
                            props.isCircular,
                            relatedId ?? 'i)',
                            ' = j)',
                            relatedId ? undefined : `(${
                                relatedObject?.selectorType === 'any' ? 'exists' : 'forAll'} i in ${
                                sanitiseName(relatedObject?.typeAttributes?.name)} . `,
                            relatedId ? undefined : `(${
                                otherObject?.selectorType === 'any' ? 'exists' : 'forAll'} j in ${
                                sanitiseName(otherObject?.typeAttributes?.name)} . `,
                            operator
                        );
                    }
            }
        }
    },
        ['first', 'last', 'before', 'after', 'previous', 'next', 'adjacent'].includes(el.relationshipAttribute)])
        .filter(el => el[1]);

export const contains = (container, object, isSequence = false, min = 0, max = 99) => {
    return `(${container.map(e => 'sum([ toInt(n' + object + ') | ' + (isSequence ? '(_,n)' : 'n') +
        ' <- ' + e + ' ])').join(' + ')
    }) >= ${min} /\\ (${container.map(e => 'sum([ toInt(n' + object + ') | ' + (isSequence ? '(_,n)' : 'n') +
        ' <- ' + e + ' ])').join(' + ')}) <= ${max}`
}

export const capacity = (containers = [], min = 0, max = 99) => {
    return `such that (${containers.map(el => '|' + sanitiseName(el) + '|').join(' + ')
    }) >= ${min} /\\ (${containers.map(el => '|' + sanitiseName(el) + '|').join(' + ')}) <= ${max}`
}

export const notRepeatedType = (containers, objects, isSequence) => {
    return `such that forAll o: int(${objects.join(', ')}) . (${
        containers.map(e => 'toInt(sum([ toInt(n = o) | ' + (isSequence ?
            '(_, n)' : 'n') + ' <- ' + sanitiseName(e) + ']) >= 1)').join(' + ')}) <= 1`
}

export const positionalRelationshipConstraint = (relationshipType, sequence, isCircular,
                                                 relatedObject, targetObject,
                                                 relatedPrefix = '', targetPrefix = '',
                                                 operator = '=') => {
    switch (relationshipType) {
        case 'first':
            return `${targetPrefix}${sequence}(1) ${targetObject}`;
        case 'last':
            return `${targetPrefix}${sequence}(|${sequence}|) ${targetObject}`;
        case 'before':
            //TODO not before
            return `forAll (i1, o1) in ${sequence} . forAll (i2, o2) in ${sequence
            } . ${relatedPrefix}o1 = ${relatedObject} /\\ ${targetPrefix}o2${targetObject} -> i1 < i2`;
        case 'after':
            //TODO not after
            return `forAll (i1, o1) in ${sequence} . forAll (i2, o2) in ${sequence
            } . ${relatedPrefix}o1 = ${relatedObject} /\\ ${targetPrefix}o2${targetObject} -> i1 > i2`;
        case 'previous':
            if (isCircular) {
                return `forAll (i1, o1) in ${sequence} . forAll (i2, o2) in ${sequence
                } . ${relatedPrefix}o1 = ${relatedObject} /\\ ${targetPrefix}o2${
                    targetObject} -> ((i1 + 1) % |${sequence}|) + 1 ${operator} i2`;
            }
            return `forAll (i1, o1) in ${sequence} . forAll (i2, o2) in ${sequence
            } . ${relatedPrefix}o1 = ${relatedObject} /\\ ${targetPrefix}o2${targetObject} -> i1 + 1 ${operator} i2`;
        case 'next':
            if (isCircular) {
                return `forAll (i1, o1) in ${sequence} . forAll (i2, o2) in ${sequence
                } . ${relatedPrefix}o1 = ${relatedObject} /\\ ${targetPrefix}o2${
                    targetObject} -> i1 ${operator} ((i2 + 1) % |${sequence}|) + 1`;
            }
            return `forAll (i1, o1) in ${sequence} . forAll (i2, o2) in ${sequence
            } . ${relatedPrefix}o1 = ${relatedObject} /\\ ${targetPrefix}o2${targetObject} -> i1 ${operator} i2 + 1`
        case 'adjacent':
            return `(${positionalRelationshipConstraint('previous', sequence, isCircular,
                relatedObject, targetObject)}) \\/ (${
                positionalRelationshipConstraint('next', sequence, isCircular,
                    relatedObject, targetObject)})`;
        default:
            return '';
    }
}

export const constraintGen = (node, reducers, relationships, thingsToIndex) => {
    const parts = getConstraintParts(node._id);

    function shouldBeSecond(part) {
        if (['value', 'text'].includes(part.type)) {
            return true;
        } else if (['object', 'container'].includes(part.type)) {
            return true;
        } else if (['object_type', 'container_type'].includes(part.type)) {
            return true;
        } else if (['selector'].includes(part.type)) {
            return true;
        } else if (['representative'].includes(part.type)) {
            return true;
        } else {
            return false;
        }
    }

    function genPart(part) {
        let side = '';
        if (part._id in reducers) {
            side = sanitiseName(reducers[part._id]);
        } else if (part._id in relationships) {
            side = relationships[part._id];
        } else if (['value', 'text'].includes(part.type)) {
            side = part.value;
        } else if (['object', 'container'].includes(part.type)) {
            side = thingsToIndex[part?.typeAttributes?.name];
        } else if (['object_type', 'container_type'].includes(part.type)) {
            side = part?.typeAttributes?.name;
        } else if (['selector'].includes(part.type)) {
            side = part?.typeAttributes?.name;
        } else if (['representative'].includes(part.type)) {
            const selector = Things.findOne(Object.keys(part?.inConnections?.representative ?? {})[0] ?? '');
            side = selector?.typeAttributes?.name ?? part?.typeAttributes?.name;
        } else {
            side = constraintGen(part, reducers, relationships, thingsToIndex);
        }
        return side;
    }

    function genWrapper(part) {
        let side = '';
        if (['object_type', 'container_type'].includes(part?.type)) {
            // return () => {
            //
            // }
            //side = thingsToIndex[part?.typeAttributes?.name];
        } else if (['selector', 'representative'].includes(part?.type)) {
            // return () => {
            //
            // }
            //side = thingsToIndex[part?.typeAttributes?.name];
        }
        return side;
    }

    let constraint = '';
    if (node.icon === 'not') {
        if (!parts[0]) return;
        const right = genPart(parts[0]);
        const rightWrapper = genWrapper(parts[0]);
        const operator = mathTextToSymbol(node.icon);
        if (!operator || right === undefined || right === null) return;
        constraint = `(${operator} ${right})`
        if (typeof rightWrapper === 'function') {
            constraint = rightWrapper(constraint);
        }
    } else {
        if (!parts[0] || !parts[1]) return;
        const left = genPart(parts[0]);
        const right = genPart(parts[1]);
        const leftWrapper = genWrapper(parts[0]);
        const rightWrapper = genWrapper(parts[1]);
        const operator = mathTextToSymbol(node.icon);
        if (left === undefined || left === null || !operator || right === undefined || right === null) return;
        if (shouldBeSecond(parts[0]) && operatorReversal(node.icon)) {
            if (typeof left !== 'function' && typeof right === 'function') {
                constraint = `(${right(mathTextToSymbol(operatorReversal(node.icon)) + ' ' + left)})`
            } else if (typeof left !== 'function' && typeof right !== 'function') {
                constraint = `(${right} ${mathTextToSymbol(operatorReversal(node.icon))} ${left})`
            } else {
                return
            }
        } else {
            if (typeof left === 'function' && typeof right !== 'function') {
                constraint = `(${left(operator + ' ' + right)})`
            } else if (typeof left !== 'function' && typeof right !== 'function') {
                constraint = `(${left} ${operator} ${right})`
            } else {
                return;
            }
        }
        if (typeof leftWrapper === 'function') {
            constraint = leftWrapper(constraint);
        }
        if (typeof rightWrapper === 'function') {
            constraint = rightWrapper(constraint);
        }
    }
    return constraint;
}

export const generateComprehension = (parts, condition) => {
    return parts.reverse().reduce((acc, cur) => {
        return comprehensionTemplate(cur.reducer, acc, cur.listItemPair);
    }, condition)
}

export const comprehensionTemplate = (reducer, innerPart, listItemPair) => {
    return `${reducer}([${innerPart} | ${
        listItemPair.map(e => {
            switch (e.type) {
                case 'domain':
                    return e.domainName + ': ' + e.domainElements;
                case 'condition':
                    return e.condition;
                case 'comprehension':
                    return e.child + ' <- ' + e.parent;
            }
        }).join(', ')
    }])`
}