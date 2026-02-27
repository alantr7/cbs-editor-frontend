import * as monaco from 'monaco-editor';
import { tokenize } from './tokenizer';

export function buildAST(lines: string[]): BuildResult {
    const tokens = tokenize(lines);


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

export interface FunctionSignature {
    name: string,
    return_type: string,
    parameter_types: string[],
}