import * as monaco from 'monaco-editor';
import { tokenize } from './tokenizer';
import { parse } from './parser';

export function buildAST(lines: string[]): BuildResult {
    const tokens = tokenize(lines);
    const ast = parse(tokens);

    return ast;
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
    signatures: FunctionSignature[],
}

export interface FunctionSignature {
    name: string,
    return_type: string,
    parameter_types: string[],
}