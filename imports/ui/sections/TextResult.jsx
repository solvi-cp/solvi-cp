import React, {useState, useMemo, useRef, useEffect, useCallback} from 'react';
import {Slate, Editable, ReactEditor, withReact, useSlate} from 'slate-react';
import {Editor, Transforms, Text, createEditor} from 'slate';
import {css} from '@emotion/css';
import {withHistory} from 'slate-history';

import {Button, Icon, Menu, Portal} from '../components/text/Components';
import {Range} from 'slate';
import {getAttributeValue, getReducerAttributeMap} from "../../utils/api";

import i18n from 'meteor/universe:i18n';
import {sanitiseName} from "../../utils/essence";
import {Things} from "../../api/things/collection";

const objectsToEditorText = (things, solverState) => {
    const objectsEditorText = [];

    if (solverState.findable.length) {
        const reducerMap = getReducerAttributeMap(solverState.reducers);
        solverState.findable.forEach((f, i) => {
            const thing = things.find(el => el._id === f);
            const currentText = [];
            currentText.push(
                {text: 'Find items that go into '},
                {text: thing?.typeAttributes?.name ?? '', context: true},
                {text: '.'}
            );
            if (reducerMap[f]?.length) {
                currentText.push(
                    {text: '\n'},
                    {text: 'Outputting attributes:'}
                );
                reducerMap[f]?.forEach(el => {
                    currentText.push(
                        {text: '\n'},
                        {text: el[0].icon, context: true},
                        {text: ' of '},
                        {text: el[1].key, context: true}
                    );
                });
            }
            objectsEditorText.push({
                type: 'paragraph',
                children: currentText
            });
        });
    }

    if (solverState.activeSolver) {
        if (solverState.solving && !solverState.solved) {
            objectsEditorText.push({
                type: 'paragraph',
                children: [
                    {text: 'solving...'},
                ]
            });
        } else if (solverState.solved && solverState.error) {
            objectsEditorText.push({
                type: 'paragraph',
                children: [
                    {text: 'something is wrong with the model or the solver ran out of time'},
                ]
            });
        } else if (solverState.solved && !solverState.solutions?.length) {
            objectsEditorText.push({
                type: 'paragraph',
                children: [
                    {text: 'no solutions found'},
                ]
            });
        }

        const reducerMap = getReducerAttributeMap(solverState.reducers);
        solverState.solutions.forEach((solution, i) => {
            const currentText = [];
            currentText.push(
                {text: 'Solution '},
                {text: (i + 1).toString()}
            );
            currentText.push(
                {text: '\n'},
                {text: '--------------'}
            );

            const attributesToDisplay = new Set();

            if (Object.keys(solution).length && Object.keys(reducerMap ?? {})?.length) {
                objectsEditorText.push(
                    {text: '\n'},
                    {text: 'With constraint attributes:'}
                );
                Object.entries(reducerMap).forEach(([key, value]) => {
                    const thingName = Things.findOne(key)?.typeAttributes?.name;
                    value.forEach(el => {
                        attributesToDisplay.add(el[1].key);
                        currentText.push(
                            {text: '\n'},
                            {text: el[0].icon, context: true},
                            {text: ' of '},
                            {text: el[1].key, context: true},
                            {text: ' on '},
                            {text: thingName, context: true},
                            {text: ' is '},
                            {
                                text: solverState.rawSolutions[i]
                                    [sanitiseName(el[0].icon + '_' + el[1].key
                                    + '_' + el[0]._id)].toString(), context: true
                            }
                        );
                    });
                });
            }

            const textSolution = (objectMap, rawSolution, initial = false, level = 0) => {
                const indent = (level) => ({text: (new Array(level)).fill('\t').join('')})

                if (Object.keys(objectMap).length === 0) {
                    return [{text: '\n'},
                        indent(level),
                        {text: 'nothing'}
                    ]
                }

                return Object.keys(objectMap).reduce((acc, current) => {
                    const currentText = [];
                    const thing = things.find(el => sanitiseName(el?.typeAttributes?.name) === current) ??
                        things.find(el => sanitiseName(el?.typeAttributes?.name) === current
                            .split('_').slice(0, -1).join('_'));

                    if (['object', 'object_type'].includes(thing.type)) {
                        if (thing.type === 'object_type') {
                            currentText.push(
                                {text: '\n'},
                                indent(level),
                                {text: i18n.__('types.object') + ' '},
                                {text: current + ' of ' + thing?.typeAttributes?.name ?? '', context: true}
                            );
                        } else {
                            currentText.push(
                                {text: '\n'},
                                indent(level),
                                {text: i18n.__('types.' + thing.type) + ' '},
                                {text: thing?.typeAttributes?.name ?? '', context: true}
                            );
                        }
                    } else if (['container', 'container_type'].includes(thing.type)) {
                        if (thing.type === 'container_type') {
                            currentText.push(
                                {text: '\n'},
                                indent(level),
                                {text: i18n.__('types.container') + ' '},
                                {text: current + ' of ' + thing?.typeAttributes?.name ?? '', context: true},
                                {text: ' contains'}
                            );
                        } else {
                            currentText.push(
                                {text: '\n'},
                                indent(level),
                                {text: i18n.__('types.' + thing.type) + ' '},
                                {text: thing?.typeAttributes?.name ?? '', context: true},
                                {text: ' contains'}
                            );
                        }
                    }

                    if (attributesToDisplay.size) {
                        const attributeText = [];
                        attributesToDisplay.forEach(el => {
                            const attributeValue = solverState.problemState
                                    .attributeToObjectsValue[el]?.[thing?.typeAttributes?.name] ??
                                solverState.problemState
                                    .attributeToContainersValue[el]?.[thing?.typeAttributes?.name] ?? null;

                            if (attributeValue !== null) {
                                attributeText.push(
                                    {text: '\n'},
                                    indent(level),
                                    {text: el, context: true},
                                    {text: ' is '},
                                    {text: attributeValue.toString(), context: true}
                                );
                            }
                        });

                        if (attributeText.length) {
                            currentText.push(
                                {text: '\n'},
                                indent(level),
                                {text: 'With attributes:'}
                            );
                            currentText.push(...attributeText);
                        }
                    }

                    if (objectMap[current] !== null) {
                        currentText.push(...textSolution(objectMap[current], rawSolution,
                            false, level + 1));
                    }

                    return [...acc, ...currentText];
                }, []);
            }
            currentText.push(...textSolution(solution, solverState.rawSolutions[i]));

            objectsEditorText.push({
                type: 'paragraph',
                children: currentText
            });
        });
    }
    if (!objectsEditorText.length) {
        objectsEditorText.push({
            type: 'paragraph', children: [{
                text: 'switch to solve mode and ' +
                    'drag container(s) drawings and attribute reducers into left placeholder, ' +
                    'switch back to pan to solve'
            }]
        });
    }
    return objectsEditorText;
}

const TextResult = (props) => {

    const objectsEditorText = useMemo(() => objectsToEditorText(props.state.Things, props.solverState),
        [props.solverState]);

    const withInlineVoid = editor => {
        const {isInline, isVoid} = editor

        editor.isInline = element => {
            return element.type === 'inline' ? true : isInline(element)
        }

        editor.isVoid = element => {
            return element.type === 'void' ? true : isVoid(element)
        }

        return editor
    }

    const Element = useCallback(({attributes, children, element}) => {
        switch (element.type) {
            default:
                return <p
                    {...attributes}>{children}</p>
        }
    }, []);

    const Leaf = useCallback(({attributes, children, leaf}) => {
        if (leaf.context) {
            attributes = {
                ...attributes,
                style: {
                    ...attributes.style,
                    textDecoration: 'underline',
                }
            }
        }

        attributes = {
            ...attributes,
            style: {
                ...attributes.style,
                verticalAlign: 'baseline',
                borderRadius: '4px',
            }
        }

        return <span
            {...attributes}>{children}</span>
    }, []);

    const [value, setValue] = useState([]);
    useEffect(() => {
        setValue(objectsEditorText ? objectsEditorText : []);
    }, [objectsEditorText]);
    const editor = useMemo(() => withHistory(withReact(createEditor())), []);

    return (
        <div style={{padding: 10}}>
            <Slate editor={editor} initialValue={value} onChange={value => setValue(value)}>
                <Editable readOnly
                          renderElement={props => <Element {...props} />}
                          renderLeaf={props => <Leaf {...props} />}
                />
            </Slate>
        </div>
    )
}

export default TextResult;