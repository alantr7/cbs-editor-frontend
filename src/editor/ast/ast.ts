import * as monaco from 'monaco-editor';

export function buildAST(lines: string[]): BuildResult {
    return {
        ast: {},
        errors: []
    }
}

export interface BuildResult {
    ast: AST,
    errors: ParseError[]
}

export interface ParseError {
    severity: monaco.MarkerSeverity,
    message: string,
    startLineNumber: number,
    startColumn: number,
    endLineNumber: number,
    endColumn: number,
}

export interface AST {

}
