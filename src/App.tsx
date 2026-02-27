import { Editor } from '@monaco-editor/react'
import './main.css';
import { useRef } from 'react';
import type { CodeEditor, Monaco } from './editor/Monaco';
import { setupIntellisense } from './editor/intellisense';
import { setupHighlighting } from './editor/highlighting';
import { validate } from './editor/validation';

const defaultCode = `
import bot;

int main() {
    
}
`.trim();

function App() {
  const monacoRef = useRef<Monaco>(null);
  const editorRef = useRef<CodeEditor>(null);

  function handleEditorWillMount(monaco: Monaco) {
    monaco.languages.register({id: "cbs"});
    setupHighlighting(monaco);
    setupIntellisense(monaco);
  }

  function handleEditorDidMount(editor: CodeEditor, monaco: Monaco) {
    monacoRef.current = monaco;
    editorRef.current = editor;
    editor.focus();
    editor.setPosition({lineNumber: 4, column: 5});
  }

  function handleEditorChangeContent(value: string | undefined, ev: any) {
    console.clear();
    validate(editorRef.current as CodeEditor, monacoRef.current as Monaco);
  }

  return (
    <>
      <Editor
        height="100vh"
        width="100vw"
        defaultLanguage="cbs"
        options={{
          suggest: {
            showWords: false,
          }
        }}
        defaultValue={defaultCode}
        beforeMount={handleEditorWillMount}
        onMount={handleEditorDidMount}
        onChange={handleEditorChangeContent} />
    </>
  )
}

export default App
