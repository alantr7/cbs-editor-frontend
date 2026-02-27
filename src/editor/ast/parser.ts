import type { AST, BuildResult, ParseError } from "./ast";
import { ModuleRepository } from "./module-repository";
import type { TokenQueue } from "./tokenizer";
import * as monaco from 'monaco-editor';

const OPERATORS = [
      "(", ")",
      "*", "/",
      "+", "-",
      ">", "<", ">=", "<=",
      "==", "!=",
      "&",
      "^",
      "|",
      "&&",
      "||",
      "="
];

export function isOperator(input: string): boolean {
    if (input.length > 2 || input.trim().length === 0)
        return false;

    return OPERATORS.includes(input);
}

const UNARY = ["++", "--"];
const CAST = ["(int)", "(float)"];

export function parse(tokens: TokenQueue) {
    return new Parser(tokens).parse();
}

class Parser {
    
    public readonly tokens: TokenQueue;

    // todo: improve this
    public readonly moduleRepository = new ModuleRepository();

    private ast: AST = {
        signatures: []
    };

    constructor(tokens: TokenQueue) {
        this.tokens = tokens;
        this.moduleRepository.registerModule({
            name: "bot",
            functions: {
                move: {
                    name: "move",
                    parameter_types: [
                        "string"
                    ],
                    return_type: "int"
                }
            }
        });
    }

    parse(): BuildResult {
        const errors: ParseError[] = [];
        try {
            while (!this.tokens.isEmpty()) {
                const nextToken = this.tokens.peek();

                // allowed in root context:
                // - imports
                // - structs
                // - global variables
                // - functions

                if (nextToken === "import") {
                    this.parseImport();
                }
                // else if (nextToken.equals("struct")) {
                    // parse struct
                    // tokens.advance();
                // }
                else {
                    // try to find out if it's a variable or a function
                    // parseFunctionOrVariable();
                    break;
                }
            }
        } catch (e: any) {
            // todo: remember token columns as well!
            if (e instanceof ParserException) {
                const error = e as ParserException;
                errors.push({
                    startColumn: 1 + error.column,
                    endColumn: 1 + error.column + error.token.length,
                    startLineNumber: error.line,
                    endLineNumber: error.line,
                    message: e.message,
                    severity: monaco.MarkerSeverity.Error
                });
            }
        }

        return {
            ast: this.ast,
            errors
        };
    }

    parseImport() {
        this.tokens.advance();
        const name = this.tokens.next();
        
        this.expect(this.tokens.next(), ";");

        const module = this.moduleRepository.getModule(name);
        if (module == null) {
            this.tokens.rollback();
            this.tokens.rollback();
            throw new ParserException(name, this.tokens.getLine(), this.tokens.getColumn(), "Unknown module '" + name + "'.");
        }

        for (const fun of Object.values(module.functions)) {
            this.ast.signatures.push(fun);
            console.log("imported " + fun.name);
        }
    }

    expect(token: string, expected: string, line: number = this.tokens.getLine(), column: number = this.tokens.getColumn()) {
        if (token !== expected) {
            throw new ParserException(token, line, column, "Unexpected token: \"" + token + "\". Was expecting \"" + expected + "\".");
        }
    }

}

export function isUnaryOperator(input: string): boolean {
    return UNARY.includes(input) || CAST.includes(input);
}

export function isCastOperator(input: string): boolean {
    return CAST.includes(input);
}

export function isNumber(input: string): boolean {
    return input.match(/$\d+$/) !== undefined;
}

export function isBoolean(input: string): boolean {
    return input === "true" || input === "false";
}

export class ParserException extends Error {
    public readonly line: number;
    public readonly column: number;
    public readonly token: string;

    constructor(token: string, line: number, column: number, error: string) {
        super(error);
        this.token = token;
        this.line = line;
        this.column = column;
    }
}