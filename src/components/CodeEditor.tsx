import { javascript } from '@codemirror/lang-javascript';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { useEffect, useRef } from 'react';

interface CodeEditorProps {
  value: string;
  onChange(value: string): void;
  language: 'glsl' | 'javascript';
}

export function CodeEditor({ value, onChange, language }: CodeEditorProps) {
  const root = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | undefined>(undefined);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!root.current) return;
    const view = new EditorView({
      parent: root.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          keymap.of([indentWithTab, ...defaultKeymap]),
          ...(language === 'javascript' ? [javascript()] : []),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': '작업 코드', spellcheck: 'false' }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
        ],
      }),
    });
    editor.current = view;
    return () => view.destroy();
  }, [language]);

  useEffect(() => {
    const view = editor.current;
    if (!view || view.state.doc.toString() === value) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }, [value]);

  const insert = (text: string) => {
    const view = editor.current;
    if (!view) return;
    const range = view.state.selection.main;
    view.dispatch({ changes: { from: range.from, to: range.to, insert: text }, selection: { anchor: range.from + text.length } });
    view.focus();
  };

  return (
    <div className="code-editor-shell">
      <div className="code-editor" ref={root} />
      <div className="symbol-row" aria-label="코드 기호 입력">
        {['()', '{}', '[]', ';', '.', '=', '+', '-', '*', '/'].map((symbol) => (
          <button type="button" key={symbol} onClick={() => insert(symbol)}>{symbol}</button>
        ))}
      </div>
    </div>
  );
}
