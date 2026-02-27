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
    functions: Record<string, Function>,
}

export interface FunctionSignature {
    module: string | null,
    name: string,
    return_type: Type,
    parameter_types: Type[],
}

export class Variable {
    type: Type;
    global: boolean;
    offset: number;
    lengths: number[];
    length: number;

    constructor(type: Type, global: boolean, offset: number, lengths: number | number[]) {
        this.type = type;
        this.global = global;
        this.offset = offset;
        this.lengths = Array.isArray(lengths) ? lengths : [ lengths ];
        if (Array.isArray(lengths)) {
            this.length = 1;
            for (const num of lengths) {
                this.length *= num;
            }
        } else {
            this.length = lengths;
        }
    }
}

export class Function {
    signature: FunctionSignature;
    body: any[];

    constructor(signature: FunctionSignature, body: any[]) {
        this.signature = signature;
        this.body = body;
    }
}

export class Type {
    static INT      = new Type();
    static FLOAT    = new Type();
    static STRING   = new Type();
    static VOID     = new Type();
}