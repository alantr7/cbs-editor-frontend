import { buildAST } from "./ast/ast";
import { setLatestAST } from "./intellisense";
import type { CodeEditor, Monaco } from "./Monaco";
import { editor as ed } from 'monaco-editor';

export function validate(editor: CodeEditor, monaco: Monaco) {
    const model = editor.getModel() as ed.ITextModel;
    const lines = model.getLinesContent();
    const markers: any[] = [];

    const { ast, errors } = buildAST(lines);
    console.log(ast);

    errors.forEach(error => {
        markers.push(error);
    });

    setLatestAST(ast);
    monaco.editor.setModelMarkers(model, "owner", markers);
}