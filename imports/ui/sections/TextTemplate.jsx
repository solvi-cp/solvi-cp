import React, {useState, useMemo, useRef, useEffect} from 'react';
import {Slate, Editable, ReactEditor, withReact, useSlate} from 'slate-react';
import {Editor, Transforms, Text, createEditor} from 'slate';
import {css} from 'emotion';
import {withHistory} from 'slate-history';

import {Button, Icon, Menu, Portal} from '../components/text/Components';
import {Range} from 'slate';
import {getAttributeValue, walkTree} from "../../utils/api";

import i18n from 'meteor/universe:i18n';

const objectsToEditorText = () => {
    const objectsEditorText = [{
        children: [
            {text: 'This is a test.'},
        ]
    }];
    return objectsEditorText;
}

const toggleFormat = (editor, format) => {
    const isActive = isFormatActive(editor, format);
    Transforms.setNodes(
        editor,
        {[format]: isActive ? null : true},
        {match: Text.isText, split: true}
    );
}

const isFormatActive = (editor, format) => {
    const [match] = Editor.nodes(editor, {
        match: n => n[format] === true,
        mode: 'all',
    });
    return !!match;
}

const Leaf = ({attributes, children, leaf}) => {

    if (leaf.context) {
        children = <span
            style={{
                padding: '3px 3px 2px',
                margin: '0 1px',
                verticalAlign: 'baseline',
                display: 'inline-block',
                borderRadius: '4px',
                backgroundColor: '#eee',
                fontSize: '0.9em',
            }}
        >
            {children}
        </span>
    }

    if (leaf.bold) {
        children = <strong>{children}</strong>
    }

    if (leaf.italic) {
        children = <em>{children}</em>
    }

    if (leaf.underlined) {
        children = <u>{children}</u>
    }

    return <span {...attributes}>{children}</span>
}

const HoveringToolbar = () => {
    const ref = useRef(null);
    const editor = useSlate();

    useEffect(() => {
        const el = ref.current;
        const {selection} = editor;

        if (!el) {
            return;
        }

        if (
            !selection ||
            !ReactEditor.isFocused(editor) ||
            Range.isCollapsed(selection) ||
            Editor.string(editor, selection) === ''
        ) {
            el.removeAttribute('style');
            return;
        }

        const domSelection = window.getSelection();
        const domRange = domSelection.getRangeAt(0);
        const rect = domRange.getBoundingClientRect();
        el.style.opacity = 1;
        el.style.top = `${rect.top + rect.height + window.pageYOffset + 8}px`;
        el.style.left = `${rect.left + window.pageXOffset - el.offsetWidth / 2 + rect.width / 2}px`;
        document.activeElement.blur();
    })

    return (
        <Portal>
            <Menu
                ref={ref}
                className={css`
                  padding: 8px 7px 6px;
                  position: absolute;
                  z-index: 1;
                  top: -10000px;
                  left: -10000px;
                  margin-top: -6px;
                  opacity: 0;
                  background-color: #222;
                  border-radius: 4px;
                  transition: opacity 0.75s;
                `}
            >
                <FormatButton format="object"/>
                <FormatButton format="container"/>
            </Menu>
        </Portal>
    )
}

const FormatButton = ({format, icon}) => {
    const editor = useSlate();
    return (
        <Button
            reversed
            active={isFormatActive(editor, format)}
            onMouseDown={event => {
                event.preventDefault()
                toggleFormat(editor, format)
            }}
        >
            {format}
            <Icon>{icon}</Icon>
        </Button>
    )
}

const TextPane = (props) => {
    const objectsEditorText = useMemo(() => objectsToEditorText(),
        []);

    const [value, setValue] = useState([]);
    useEffect(() => {
        setValue(objectsEditorText ? objectsEditorText : []);
    }, [objectsEditorText]);
    const editor = useMemo(() => withHistory(withReact(createEditor())), []);

    return (
        <div style={{padding: 10}}>
            <Slate editor={editor} value={value} onChange={value => setValue(value)}>
                <HoveringToolbar/>
                <Editable
                    renderLeaf={props => <Leaf {...props} />}
                    placeholder="Enter some text..."
                    onDOMBeforeInput={event => {
                        event.preventDefault()
                        switch (event.inputType) {
                            case 'formatBold':
                                return toggleFormat(editor, 'bold')
                            case 'formatItalic':
                                return toggleFormat(editor, 'italic')
                            case 'formatUnderline':
                                return toggleFormat(editor, 'underline')
                        }
                    }}
                />
            </Slate>
        </div>
    )
}

export default TextPane;