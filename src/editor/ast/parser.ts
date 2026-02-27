import { Function, Type, Variable, type AST, type BuildResult, type FunctionSignature, type ParseError } from "./ast";
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
        signatures: [],
        functions: {},
    };

    private context: ParserContext = new ParserContext();

    constructor(tokens: TokenQueue) {
        this.tokens = tokens;
        this.moduleRepository.registerModule({
            name: "bot",
            functions: {
                move: {
                    module: null,
                    name: "move",
                    parameter_types: [
                        Type.INT,
                    ],
                    return_type: Type.INT
                }
            }
        });
        this.context.scopes.push(new Scope());
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
                    this.parseFunctionOrVariable();
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
            } else {
                console.log(e);
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

    parseFunctionOrVariable() {
        const rawType = this.tokens.next();
        const type = this.parseType(rawType);

        // todo: check if it's variable or function anyway and then throw exception with more useful message
        if (type === null) {
            this.tokens.rollback();
            throw new ParserException(rawType, this.tokens.getLine(), this.tokens.getColumn(), "Unexpected token '" + rawType + "'.");
        }

        const name = this.tokens.next();
        const differentiator = this.tokens.peek();

        if (differentiator === "(") {
            // it's a function
            this.parseFunction(type, name);
            return;
        }
        if (differentiator === "=" || differentiator === ";") {
            // todo:
            // this.parseVariableDeclare(type, name);
            return;
        }
    }

    parseFunction(type: Type, name: string): void {
        this.expect(this.tokens.next(), "(");
        const functionScope = this.context.getCurrentScope().createChild(false);
        this.context.scopes.push(functionScope);

        const parameterTypes: Type[] = new Array(8);
        const parameterVariables: Variable[] = new Array(8);
        let parameterCount = 0;
        for (; parameterCount < parameterTypes.length; parameterCount++) {
            const rawParameterType = this.tokens.peek();
            if (rawParameterType === ")")
                break;

            this.tokens.advance();
            const parameterType = this.parseType(rawParameterType as string);
            if (parameterType == null) {
                this.tokens.rollback();
                throw new ParserException(rawParameterType as string, this.tokens.getLine(), this.tokens.getColumn(), "Unexpected token '" + rawParameterType + "'.");
            }

            const parameterName = this.tokens.next();
            const parameterVariable = new Variable(parameterType, false, 0, 1);
            functionScope.variables[parameterName] = parameterVariable;
            functionScope.localVariables[parameterName] = parameterVariable;
            functionScope.parameterVariables[parameterName] = parameterVariable;

            parameterTypes[parameterCount] = parameterType;
            parameterVariables[parameterCount] = parameterVariable;

            if (this.tokens.peek() === ",") {
                this.tokens.advance();
                continue;
            }

            parameterCount++;
            break;
        }

        // set parameter offsets
        for (let i = 0; i < parameterCount; i++) {
            parameterVariables[i].offset = i - parameterCount - 1;
        }

        this.expect(this.tokens.next(), ")");

        const signature: FunctionSignature = {
            module: null,
            name,
            return_type: type,
            parameter_types: parameterTypes.slice(0, parameterCount)
        };
        this.ast.signatures.push(signature);

        this.context.currentFunction = signature;

        this.expect(this.tokens.next(), "{");

        // todo: parse function body
        // const body = this.parseBody();

        this.expect(this.tokens.next(), "}");

        const fun = new Function(signature, new Array(0));
        this.ast.functions[name] = fun;

        this.context.currentFunction = null;
    }

    parseType(token: string): Type | null {
        switch (token) {
            case "int":
                return Type.INT;
            case "float":
                return Type.FLOAT;
            case "string":
                return Type.STRING;
            case "void":
                return Type.VOID;
            default:
                return null;
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

export class ParserContext {

    scopes: Scope[] = [];

    currentFunction: FunctionSignature | null = null;

    getCurrentScope(): Scope {
        return this.scopes[this.scopes.length - 1];
    }

}

export class Scope {

    variables: Record<string, Variable> = {};

    parameterVariables: Record<string, Variable> = {};

    localVariables: Record<string, Variable> = {};

    nextVariableOffset = 1;

    createChild(copyLocals: boolean): Scope {
        const child = new Scope();
        for (const key in this.variables) {
            child.variables[key] = this.variables[key];
        }

        if (copyLocals)
            for (const key in this.variables) {
                child.localVariables[key] = this.localVariables[key];
            }

        return child;
    }

}