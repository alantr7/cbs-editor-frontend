import { buildAST } from "./ast/ast";
import type { CodeEditor, Monaco } from "./Monaco";
import { editor as ed } from 'monaco-editor';

export function validate(editor: CodeEditor, monaco: Monaco) {
    const model = editor.getModel() as ed.ITextModel;
    const lines = model.getLinesContent();
    const markers: any[] = [];

    const { ast, errors } = buildAST(lines);
    console.log(ast);

    lines.forEach((line, index) => {
        const trimmed = line.trim();

        if (trimmed === "" || trimmed.endsWith(";") || trimmed.endsWith("{") || trimmed.endsWith("}") || trimmed.startsWith("//"))
            return;

        markers.push({
            severity: monaco.MarkerSeverity.Error,
            message: "Missing semicolon",
            startLineNumber: index + 1,
            startColumn: line.length,
            endLineNumber: index + 1,
            endColumn: line.length + 1
        });
    });

    monaco.editor.setModelMarkers(model, "owner", markers);
}