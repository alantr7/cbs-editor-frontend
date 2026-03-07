import {useEffect, useRef, useState, type KeyboardEvent} from "react";
import type {CodeEditor, Monaco} from "../editor/Monaco.ts";
import {setupHighlighting} from "../editor/highlighting.ts";
import {setupIntellisense} from "../editor/intellisense.ts";
import {validate} from "../editor/validation.ts";
import {Editor} from "@monaco-editor/react";
import Sidebar from "../editor/Sidebar.tsx";
import { type BotFile } from "../types/editor-types.ts";
import { formatDate } from "../utils/formatter.ts";
import axios from "axios";
import type { EditorSession } from "../types/session.ts";
import { Type } from "../editor/ast/ast.ts";
import { useParams } from "react-router";

const defaultCode = `
import bot;

int main() {
   
}
`.trim();

export default function EditorPage() {
    const monacoRef = useRef<Monaco>(null);
    const editorRef = useRef<CodeEditor>(null);

    const [ session, setSession ] = useState<EditorSession>();
    const [ isLoading, setIsLoading ] = useState(true);
    const [ files, setFiles ] = useState<BotFile[]>([
        { name: "main.cbs", content: defaultCode, last_modified: Date.now(), },
        { name: "other.cbs", content: defaultCode, last_modified: Date.now(), },
    ].map((f: any) => ({
        ...f,
        is_saving: false,
        saved_content: f.content,
    })));
    const [ caretPos, setCaretPos ] = useState<[number, number]>([4, 4]);
    const [ currentFile, setCurrentFile ] = useState<number>(0);
    const [ fileSize, setFileSize ] = useState<number>(files[currentFile].content.length);
    const [ expiresIn, setExpiresIn ] = useState(0);
    
    function handleEditorWillMount(monaco: Monaco) {
        monaco.languages.register({id: "cbs"});
        setupHighlighting(monaco);
        setupIntellisense(monaco, session!);
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
        editor.onDidChangeCursorPosition(e => {
            setCaretPos([e.position.lineNumber, e.position.column]);
        });
    }

    function handleEditorChangeContent() {
        validate(editorRef.current as CodeEditor, monacoRef.current as Monaco, session!);
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
        
        updateLocalFile();
        setCurrentFile(idx);
    }

    const updateFile = (mapper: (file: BotFile) => void) => {
        setFiles(files => files.map((file, index) => {
            if (index !== currentFile)
                return file;

            const copy = { ...file };
            mapper(copy);
            return copy;
        }));
    }

    useEffect(() => {
        editorRef.current?.setValue(files[currentFile].content);
    }, [currentFile]);

    useEffect(() => {
        const interval = setInterval(() => {
            const expiresIn = Math.max(0, session!.expires_at - Date.now());
            setExpiresIn(expiresIn);

            if (expiresIn === 0) {
                clearInterval(interval);
                document.location.href = `/error?code=expired`;
            }
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const params = useParams();
    useEffect(() => {
        axios.get(`/api/sessions/${params.id}`).then(r => {
            const data = r.data;
            Object.values(data.modules).forEach((module: any) => module.functions.forEach((fun: any) => {
                fun.return_type = Type.parseType(fun.return_type as string)!;
                fun.parameter_types = fun.parameter_types.map((type: string) => Type.parseType(type));
            }));

            setSession(data);
            setIsLoading(false);
        });
    }, []);

    function handleSave(ev: KeyboardEvent) {
        if (ev.ctrlKey && ev.key.toLowerCase() === 's') {
            ev.preventDefault();
            ev.stopPropagation();

            handleSaveFile();
        }
    }

    function handleSaveFile() {
        if (files[currentFile].is_saving || files[currentFile].saved_content === editorRef.current?.getValue())
            return;

        updateLocalFile();
        updateFile(f => f.is_saving = true);

        if (session!.id === "demo") {
            updateFile(f => (f.saved_content = editorRef.current!.getValue(), f.is_saving = false));
            return;
        }

        axios.put(`/api/sessions/${session!.id}`, {
            files: [{
                id: files[currentFile].id,
                content: editorRef.current!.getValue()
            }]
        }).then(() => {
            updateFile(f => f.saved_content = editorRef.current!.getValue());
        }).finally(() => updateFile(f => f.is_saving = false));
    }

    return (
        <>
            <div className={`loading-overlay ${isLoading && "visible"}`}>
                Loading session<br />
                <small style={{fontSize: "14px"}}>Please wait - this won't take long</small>
            </div>
            {!isLoading && <div className="main-container">
                <div className="ribbon">
                    <div className="ribbon-sidebar">File Explorer</div>
                    <div className="ribbon-editor">
                        <div className="open-file">
                            Editing {files[currentFile].name}
                            <span className="file-details">Session expires in: <span style={{color: "lightgray"}}>{formatDate(new Date(expiresIn), "HH:MM:SS")}</span></span>
                            <span className="file-details"> Author: <img src="https://minotar.net/avatar/alant7/22" /> <span style={{color: "lightgray"}}>Demo</span></span>
                        </div>
                        <div className="content-buttons">
                            {<a style={{opacity: files[currentFile].is_saving ? 1 : 0}}>Saving in progress</a>}
                            <button className="save-button" onClick={handleSaveFile}
                                disabled={files[currentFile].is_saving || files[currentFile].saved_content === editorRef!.current?.getValue()}>
                                <img src="/icon-save.png" /> Save</button>
                        </div>
                    </div>
                </div>
                <div className="editor-container" onKeyDown={handleSave}>
                    <Sidebar files={files} currentFile={currentFile} openFile={handleOpenFile} />
                    <Editor
                        defaultLanguage="cbs"
                        options={{
                            minimap: { enabled: false },
                            suggest: {
                                showWords: false,
                            },
                            tabSize: 3,
                            fontSize: 18,
                            scrollBeyondLastLine: false,
                        }}
                        loading=""
                        beforeMount={handleEditorWillMount}
                        theme='catppuccin-mocha'
                        onMount={handleEditorDidMount}
                        onChange={handleEditorChangeContent} />
                </div>
                <div className="status-bar">
                    <span>Position: <span style={{color: "lightgray"}}>{caretPos[0]}, {caretPos[1]}</span></span>
                    <span>Size: <span style={{color: "lightgray"}}>{fileSize} / 2048</span></span>
                </div>
            </div>}
        </>
    )
}