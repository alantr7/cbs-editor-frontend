import {useEffect, useMemo, useRef, useState, type KeyboardEvent} from "react";
import type {CodeEditor, Monaco} from "../editor/Monaco.ts";
import {setupHighlighting} from "../editor/highlighting.ts";
import {setupIntellisense} from "../editor/intellisense.ts";
import {validate} from "../editor/validation.ts";
import {Editor} from "@monaco-editor/react";
import Sidebar from "../editor/Sidebar.tsx";
import { type BotFile } from "../types/editor-types.ts";

const defaultCode = `
import bot;

int main() {
   
}
`.trim();

export default function EditorPage() {
    const monacoRef = useRef<Monaco>(null);
    const editorRef = useRef<CodeEditor>(null);

    const [ files, setFiles ] = useState<BotFile[]>([
        { name: "main.cbs", content: defaultCode, last_modified: Date.now(), },
        { name: "other.cbs", content: defaultCode, last_modified: Date.now(), },
    ].map((f: any) => ({
        ...f,
        is_saving: false,
        saved_content: f.content,
    })));
    const [ currentFile, setCurrentFile ] = useState<number>(0);
    const [ fileSize, setFileSize ] = useState<number>(files[currentFile].content.length);
    const [ expiresIn, setExpiresIn ] = useState(0);

    function handleEditorWillMount(monaco: Monaco) {
        monaco.languages.register({id: "cbs"});
        setupHighlighting(monaco);
        setupIntellisense(monaco);
        monaco.typescript.typescriptDefaults.setEagerModelSync(false);
        monaco.typescript.typescriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: true,
            noSyntaxValidation: true,
        });
    }

    function handleEditorDidMount(editor: CodeEditor, monaco: Monaco) {
        monacoRef.current = monaco;
        editorRef.current = editor;
        editor.focus();
        editor.setValue(files[currentFile].content);
        editor.setPosition({lineNumber: 4, column: 4});
    }

    function handleEditorChangeContent() {
        validate(editorRef.current as CodeEditor, monacoRef.current as Monaco);
        setFileSize(editorRef.current?.getValue().length || 0);
    }

    const updateLocalFile = () => {
        setFiles(files => {
            const newFiles = [...files];
            newFiles[currentFile].content = editorRef.current!.getValue();
            
            return newFiles;
        });
    };
    
    function handleOpenFile(idx: number) {
        if (idx === currentFile)
            return;
        
        console.log('updated ' + currentFile);
        updateLocalFile();
        setCurrentFile(idx);
    }

    useEffect(() => {
        editorRef.current?.setValue(files[currentFile].content);
    }, [currentFile]);

    function handleSave(ev: KeyboardEvent) {
        if (ev.ctrlKey && ev.key.toLowerCase() === 's') {
            ev.preventDefault();
        }
    }

    return (
        <>
            <div className="main-container">
                <div className="ribbon">
                    <div className="ribbon-sidebar">File Explorer</div>
                    <div className="ribbon-editor">
                        <div className="open-file">
                            Editing {files[currentFile].name}
                            <span className="file-details">Size: <span style={{color: "lightgray"}}>{fileSize} / 2048</span></span>
                            <span className="file-details">Session expires in: <span style={{color: "lightgray"}}>02:48:44</span></span>
                            <span className="file-details"> Author: <img src="https://minotar.net/avatar/hey/24" /> <span style={{color: "lightgray"}}>hey!</span></span>
                        </div>
                        <div className="content-buttons">
                            <a>Saving in progress...</a>
                            <button className="save-button">
                                <img src="/icon-save.png"></img> Save
                            </button>
                        </div>
                    </div>
                </div>
                <div className="editor-container" onKeyDown={handleSave}>
                    <Sidebar files={files} openFile={handleOpenFile} />
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
                        beforeMount={handleEditorWillMount}
                        theme='catppuccin-mocha'
                        onMount={handleEditorDidMount}
                        onChange={handleEditorChangeContent} />
                </div>
            </div>
        </>
    )
}