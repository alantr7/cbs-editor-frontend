import {useRef} from "react";
import type {CodeEditor, Monaco} from "./editor/Monaco.ts";
import {setupHighlighting} from "./editor/highlighting.ts";
import {setupIntellisense} from "./editor/intellisense.ts";
import {validate} from "./editor/validation.ts";
import {Editor} from "@monaco-editor/react";
import Sidebar from "./editor/Sidebar.tsx";

const defaultCode = `
import bot;

int main() {
   
}
`.trim();

export default function EditorPage() {
    const monacoRef = useRef<Monaco>(null);
    const editorRef = useRef<CodeEditor>(null);

    function handleEditorWillMount(monaco: Monaco) {
        monaco.languages.register({id: "cbs"});
        setupHighlighting(monaco);
        setupIntellisense(monaco);
        monaco.typescript.typescriptDefaults.setEagerModelSync(false);
        monaco.typescript.typescriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: true,
            noSyntaxValidation: true,
        });
        monaco.editor.defineTheme("catppuccin-mocha", {
            base: "vs-dark",
            inherit: true,
            rules: [
                { token: "comment", foreground: "6c7086" },
                { token: "keyword", foreground: "cba6f7" },
                { token: "string", foreground: "a6e3a1" },
                { token: "number", foreground: "f9e2af" },
                { token: "identifier", foreground: "cdd6f4" },
            ],
            colors: {
                "editor.background": "#282c34",
                "editor.foreground": "#cdd6f4",
                "editorLineNumber.foreground": "#6c7086",
                "editorCursor.foreground": "#f5e0dc",
                "editor.selectionBackground": "#45475a",
                "editor.lineHighlightBackground": "#6699ff0b"
            },
        });
    }

    function handleEditorDidMount(editor: CodeEditor, monaco: Monaco) {
        monacoRef.current = monaco;
        editorRef.current = editor;
        editor.focus();
        editor.setPosition({lineNumber: 4, column: 4});
    }

    function handleEditorChangeContent(value: string | undefined, ev: any) {
        console.clear();
        validate(editorRef.current as CodeEditor, monacoRef.current as Monaco);
    }

    return (
        <>
            <div className="main-container">
                <div className="ribbon">
                    <div className="ribbon-sidebar">Program Explorer</div>
                    <div className="ribbon-editor">
                        <div className="open-file">
                            Editing file-1
                            <span className="file-details">Size: <span style={{color: "lightgray"}}>22 / 2048</span></span>
                            <span className="file-details">Session expires in: <span style={{color: "lightgray"}}>02:48:44</span></span>
                            <span className="file-details"> Author: <img src="https://minotar.net/avatar/hey/24" /> <span style={{color: "lightgray"}}>hey!</span></span>
                        </div>
                        <div className="content-buttons">
                            <a>Saving in progress...</a>
                            <button className="save-button">
                                <img src="/save.png"/> Save
                            </button>
                        </div>
                    </div>
                </div>
                <div className="editor-container">
                    <Sidebar />
                    <Editor
                        defaultLanguage="cbs"
                        options={{
                            minimap: { enabled: false },
                            suggest: {
                                showWords: false,
                            },
                            tabSize: 3,
                            fontSize: 18,
                        }}
                        defaultValue={defaultCode}
                        beforeMount={handleEditorWillMount}
                        theme='catppuccin-mocha'
                        onMount={handleEditorDidMount}
                        onChange={handleEditorChangeContent} />
                </div>
            </div>
        </>
    )
}