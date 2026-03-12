import type { EditorSession, ModuleRepository } from "../../types/session";
import { formatOrdinal } from "../../utils/formatter";
import { Access, Arithmetic, Assign, Call, Cast, Compare, Concat, Declare, For, Function, If, Literal, Logical, Operand, Operator, Ret, StmtExpr, Type, Unary, Variable, While, type AST, type BuildResult, type FunctionSignature, type ParseError } from "./ast";
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

export function parse(tokens: TokenQueue, session: EditorSession) {
    return new Parser(tokens, session.modules).parse();
}

class Parser {
    
    public readonly tokens: TokenQueue;

    // todo: improve this
    public readonly moduleRepository: ModuleRepository;

    private context: ParserContext = new ParserContext();

    private errors: ParseError[] = [];

    private ast: AST = {
        imports: [],
        signatures: [],
        functions: {},
        scopes_tree: new Scope([0, 0]),
    };

    constructor(tokens: TokenQueue, modules: ModuleRepository) {
        this.tokens = tokens;
        this.moduleRepository = modules;
        this.ast.scopes_tree.endPosition = [2048, 2048];
        this.context.scopes.push(this.ast.scopes_tree);

        Object.values(modules).forEach(module => this.ast.signatures.push(...module.functions));
    }

    parse(): BuildResult {
        try {
            while (!this.tokens.isEmpty()) {
                const nextToken = this.tokens.peek();

                // allowed in root context:
                // - imports
                // - structs
                // - global variables
                // - functions

                // skip comments and semicolons
                if (nextToken?.startsWith("//") || nextToken === ";") {
                    this.tokens.advance();
                    continue;
                }

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
                }
            }
        } catch (e: any) {
            // todo: remember token columns as well!
            if (e instanceof ParserException) {
                const error = e as ParserException;
                this.errors.push({
                    startColumn: 1 + error.column,
                    endColumn: 1 + error.column + (error.token?.length || 0),
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
            errors: this.errors,
        };
    }

    parseImport() {
        const tokenLine = this.tokens.getLine();
        const tokenColumn = this.tokens.getColumn();
        this.tokens.advance();

        const tokenLine1 = this.tokens.getLine();
        const tokenColumn2 = this.tokens.getColumn();
        const name = this.tokens.next();
        if (name === null)
            throw new ParserException(" ", tokenLine, tokenColumn + "import ".length, "Expected module name.");

        if (this.tokens.peek() !== ";") {
            this.errors.push({
                startLineNumber: tokenLine1,
                endLineNumber: tokenLine1,
                startColumn: tokenColumn2 + name.length,
                endColumn: tokenColumn2 + name.length + 1,
                severity: monaco.MarkerSeverity.Error,
                message: "Missing semicolon (;)."
            });
        } else {
            this.tokens.advance();
        }

        const module = this.moduleRepository[name];
        if (module === null || module === undefined || name === "lang") {
            this.tokens.rollback();
            this.tokens.rollback();
            throw new ParserException(name, this.tokens.getLine(), this.tokens.getColumn(), "Unknown module '" + name + "'.");
        }

        this.ast.imports.push(name);

        for (const fun of Object.values(module.functions)) {
            this.ast.signatures.push(fun);
        }
    }

    parseFunctionOrVariable() {
        const rawType = this.tokens.next();

        if (rawType === null)
            // todo: throw an error
            return;

        const type = this.parseType(rawType);

        // todo: check if it's variable or function anyway and then throw exception with more useful message
        if (type === null) {
            this.tokens.rollback();
            throw new ParserException(rawType, this.tokens.getLine(), this.tokens.getColumn(), "Unexpected token '" + rawType + "'.");
        }

        const name = this.tokens.next();
        if (name === null)
            // todo: throw an error
            return;

        const differentiator = this.tokens.peek();

        if (differentiator === "(") {
            // it's a function
            this.parseFunction(type, name);
            return;
        }
        if (differentiator === "=" || differentiator === ";") {
            this.parseVariableDeclare(type, name);
            return;
        }
    }

    parseFunction(type: Type, name: string): void {
        this.expect(this.tokens.next(), "(");
        const functionScope = this.context.getCurrentScope().createChild([this.tokens.getLine(), this.tokens.getColumn()], false);
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
            if (parameterName === null)
                // todo: throw ane error
                return;

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
            completion: name + "($1)$0",
            parameter_types: parameterTypes.slice(0, parameterCount)
        };
        this.ast.signatures.push(signature);

        this.context.currentFunction = signature;

        this.expect(this.tokens.next(), "{", this.tokens.getPrevLine(), this.tokens.getPrevColumn());

        // todo: parse function body
        const body = this.parseBody();

        this.expect(this.tokens.next(), "}");
        functionScope.endPosition = [this.tokens.getPrevLine(), this.tokens.getPrevColumn()];

        const fun = new Function(signature, body);
        this.ast.functions[name] = fun;

        this.context.currentFunction = null;
    }

    parseBody(): StmtExpr[] {
        const body = new Array(128);
        let statementCount = 0;

        for (; statementCount < body.length; statementCount++) {
            if (this.tokens.peek() === "}")
                break;

            if (this.tokens.peek() === ";") {
                this.tokens.advance();
                statementCount--;
                continue;
            }

            const statement = this.parseStatement();
            if (statement === null)
                break;

            if ((!(statement instanceof If) && !(statement instanceof For)) || (statement instanceof While && (statement as While).isDoWhile)) {
                if (this.tokens.peek() !== ";") {
                    this.errors.push({
                        startLineNumber: this.tokens.getPrevLine(),
                        endLineNumber: this.tokens.getPrevLine(),
                        startColumn: this.tokens.getColumn() + 1,
                        endColumn: this.tokens.getColumn() + 1,
                        severity: monaco.MarkerSeverity.Error,
                        message: "Missing semicolon (;)."
                    });
                } else {
                    this.tokens.advance();
                }
            }

            body[statementCount] = statement;
        }

        return body.slice(0, statementCount);
    }

    parseStatement(forInitExpr: boolean = false): StmtExpr | null {
        const tokenColumn = this.tokens.getColumn();
        const nextToken = this.tokens.peek();

        if (!forInitExpr) {
            switch (nextToken) { 
                case "if":
                    return this.parseIf();
                case "while":
                    return this.parseWhile();
                case "do":
                    return this.parseDoWhile();
                case "for":
                    return this.parseFor();
                case "return":
                    return this.parseReturn();
                default:
                    break;
            }
        }

        this.tokens.advance();

        // variable declare
        const parameterType = this.parseType(nextToken as string);
        if (parameterType != null) {
            // todo: check if name is null and throw an error if it is
            return this.parseVariableDeclare(parameterType, this.tokens.next()!);
        }

        // variable assign
        if (this.tokens.peek() === "=") {
            this.tokens.advance();

            return this.parseVariableAssign(nextToken as string);
        }

        this.tokens.rollback();

        const expression = this.parseExpression();
        if (expression?.isStatement()) {
            expression!.column = tokenColumn;
            return expression;
        }

        throw new ParserException("", this.tokens.getLine(), tokenColumn, "Can not use " + expression + " as a statement.");
    }

    parseVariableDeclare(type: Type, name: string): Declare | null {
        let initialValue: Operand | null;
        const tokenLine = this.tokens.getPrevLine();
        const tokenColumn = this.tokens.getPrevColumn();

        // no assignment
        if (this.tokens.peek() === ";") {
            // todo: arrays
            initialValue = null;
        }
        else if (this.tokens.peek() === "=") {
            this.tokens.advance();
            const tokenColumn = this.tokens.getColumn();
            initialValue = this.parseExpression();

            if (type != initialValue?.getResultType()) {
                if (type == Type.FLOAT && initialValue?.getResultType() == Type.INT) {
                    initialValue = new Cast(initialValue, Type.FLOAT);
                    initialValue.column = tokenColumn;
                } else {
                    throw new ParserException(" ", this.tokens.getLine(), tokenColumn, "Type mismatch: can not convert '" + initialValue?.getResultType().name + "' to '" + type.name + "'.");
                }
            }
        }
        else return null;

        if (type === Type.VOID) {
            this.errors.push({
                startColumn: tokenColumn + 1,
                endColumn: tokenColumn + name.length + 1,
                startLineNumber: tokenLine,
                endLineNumber: tokenLine,
                message: `Variable can not be of type void.`,
                severity: monaco.MarkerSeverity.Error,
            });
        }

        if (this.context.getCurrentScope().localVariables[name]) {
            this.tokens.rollback();
            throw new ParserException(name, tokenLine, tokenColumn, "Variable with name '" + name + "' already exists in this scope.");
        }

        const variable = new Variable(type, this.context.scopes.length === 1, this.context.getCurrentScope().nextVariableOffset++, 1);
        this.context.getCurrentScope().variables[name] = variable;
        this.context.getCurrentScope().localVariables[name] = variable;
        return new Declare(type, initialValue, [ 1 ]);
    }

    parseVariableAssign(name: string) {
        const value = this.parseExpression();
        const variable = this.context.getCurrentScope().variables[name];

        if (variable == null)
            throw new ParserException(name, this.tokens.getLine(), this.tokens.getColumn(), "Unknown variable '" + name + "'.");

        if (value && variable.type != value.getResultType())
            throw new ParserException(value.getResultType().name, this.tokens.getLine(), this.tokens.getColumn(), "Type mismatch: can not convert '" + value.getResultType() + "' to '" + variable.type + "'.");

        return new Assign(variable, new Array(0), value as StmtExpr);
    }

    parseExpression(): StmtExpr | null {
        const stack: string[] = [];
        const postfix: Operand[] = [];

        stack.push("#");

        let expectsOperator = false;
        let parenthesisOpen = 0;

        while (!this.tokens.isEmpty()) {
            const next = this.tokens.peek() as string;
            this.tokens.advance();

            if (expectsOperator && !isOperator(next)) {
                this.tokens.rollback();
                break;
            }

            if (next === ")" && parenthesisOpen === 0) {
                this.tokens.rollback();
                break;
            }

            if (next === ";") {
                this.tokens.rollback();
                break;
            }

            if (isNumber(next)) {
                postfix.push(new Literal(Literal.INT, parseInt(next)));
                expectsOperator = true;
            }

            else if (isFloat(next)) {
                console.log("IT IS A FLOAT!");
                postfix.push(new Literal(Literal.FLOAT, parseFloat(next)));
                expectsOperator = true;
            }

            else if (isCastOperator(next)) {
                postfix.push(new Cast(this.parseExpression() as StmtExpr, next === "(int)" ? Type.INT : Type.FLOAT));
            }

            else if (isOperator(next)) {
                if (next === "(") {
                    stack.push(next);
                    parenthesisOpen++;
                } else {
                    if (next === ")") {
                        if (stack.length === 0)
                            return null;

                        while (stack[stack.length - 1] !== "(") {
                            const popInParenthesis = stack.pop();
                            // second argument was a string in old code. if this breaks that's the cause
                            const operator = this.parseOperator(popInParenthesis as string);
                            postfix.push(operator !== null ? operator : new Literal(Literal.INT, parseInt(popInParenthesis as string)));
                        }

                        parenthesisOpen--;
                        stack.pop(); // pop out '('
                    } else {

                        if (getPrecedence(next) > getPrecedence(stack[stack.length - 1])) {
                            stack.push(next);
                        } else {
                            while (getPrecedence(next) <= getPrecedence(stack[stack.length - 1])) {
                                // todo: operator might be ( or ) but i highly doubt it
                                postfix.push(this.parseOperator(stack.pop() as string) as Operand);
                            }

                            stack.push(next);
                        }

                        expectsOperator = false;
//                    }
//                }
                    }
                }
            } else {

                // Check if it's a record instantiation
//                if (next.equals("new")) {
//                    var recordInstantiate = nextRecordInstantiate();
//                    if (recordInstantiate == null)
//                        break;
//
//                    expectsOperator = true;
//                    postfix.add(recordInstantiate);
//                    continue;
//                }
//
                 // can not mix strings with numbers here!
//                if (next.startsWith("\"") && next.endsWith("\"")) {
//                    postfix.add(new Literal(next.substring(1, next.length() - 1), LiteralExpression.STRING));
//                } else {
                    this.tokens.rollback();

                    // todo: function calls or array access
                    const memberAccess = this.parseVariableAccessOrCall();
                    if (memberAccess === null) {
                        break;
                    } else {
                        postfix.push(memberAccess);
                    }
//                }

                expectsOperator = true;

            }
        }

        while (stack[stack.length - 1] !== "#") {
            const pop = stack.pop();
            postfix.push(this.parseOperator(pop as string) as Operand);
        }

        for (let i = 0; i < postfix.length; i++) {
            const operand = postfix[i];
            if (operand instanceof Operator) {
                const operator = operand as Operator;

                // consume two literals
                const prev2 = postfix.splice(i - 1, 1)[0];
                i--;

                const prev1 = postfix.splice(i - 1, 1)[0];
                i--;

                // todo: check if operation can be performed on these two operands
                postfix.splice(i, 1);

                if (operator.type >= 30) {
                    if (!(prev1 instanceof Access))
                        // todo: find location of this in code
                        throw new ParserException("", 0, 0, "Can not assign to non variable.");

                    const access = prev1 as Access;
                    postfix.splice(i, 0, new Assign(access.variable, new Array(0), prev2 as Operand));
                }
                else if (operator.type >= 20) {
                    postfix.splice(i, 0, new Compare(prev1 as Operand, operator.type, prev2 as Operand));
                }
                else if (operator.type >= 10) {
                    postfix.splice(i, 0, new Logical([ prev1 as Operand, operator, prev2 as Operand ]));
                } else {
                    if (prev1?.getResultType() == Type.STRING || prev2?.getResultType() == Type.STRING) {
                        if (operator.type != Operator.ADD.type)
                            // todo: find location of this in code
                            throw new ParserException("", 0, 0, "Invalid operation on string.");

                        postfix.splice(i, 0, new Concat(prev1 as Operand, prev2 as Operand));
                    } else {
                        postfix.splice(i, 0, new Arithmetic([ prev1 as Operand, prev2 as Operand, operator ]));
                    }
                }
            }
        }

        return postfix[0];
    }

    parseVariableAccessOrCall(): Operand | null {
        if (this.tokens.peek() === null)
            return null;

        if (this.tokens.peek()?.startsWith("\"") && this.tokens.peek()?.endsWith("\""))
            return new Literal(Literal.STRING, this.tokens.peek()?.substring(1, this.tokens.next()!.length - 1) as string);

        let prefix = 0;
        let postfix = 0;

        if (this.tokens.peek() === "++") {
            this.tokens.advance();
            prefix = Unary.PREFIX_INCREMENT;
        }
        else if (this.tokens.peek() === "--") {
            this.tokens.advance();
            prefix = Unary.PREFIX_DECREMENT;
        }

        let tokenColumn = this.tokens.getColumn();
        let tokenLine = this.tokens.getLine();
        const nextToken = this.tokens.next()!;
        if ((prefix == 0) && (this.tokens.peek() === "(") || this.tokens.peek() === ".") {
            let moduleName: string | null;
            let functionName: string | null;

            const tokenColumnName = this.tokens.getColumn();
            const tokenLineName = this.tokens.getLine();
            
            if (this.tokens.peek() === ".") {
                tokenColumn = this.tokens.getPrevColumn();
                tokenLine = this.tokens.getPrevLine();
                this.tokens.advance();
                moduleName = nextToken;
                functionName = this.tokens.next();
                this.expect(this.tokens.peek() as string, "(");
            } else {
                moduleName = null;
                functionName = nextToken;
            }
            this.tokens.advance();

            if (moduleName !== null && (this.moduleRepository[moduleName] === undefined || !this.ast.imports.includes(moduleName)))
                throw new ParserException(moduleName, tokenLine, tokenColumn, "Module '" + moduleName + "' is not imported or does not exist.");

            const fun = this.ast.signatures.find(s => s.name === functionName && moduleName === s.module) || null;
            if (fun === null)
                throw new ParserException(functionName, tokenLineName, tokenColumnName, "Function '" + functionName + "' does not exist.");

            const args: Operand[] = new Array(8);
            let argumentCount = 0;
            for (; argumentCount < args.length; argumentCount++) {
                if (this.tokens.peek() === ")") {
                    this.tokens.advance();
                    break;
                }

                const argument = this.parseExpression();
                if (argument && argumentCount < fun.parameter_types.length && !fun.parameter_types[argumentCount].accepts(argument.getResultType())) {
                    this.errors.push({
                        startLineNumber: tokenLineName,
                        endLineNumber: tokenLineName,
                        startColumn: tokenColumnName + 1,
                        endColumn: tokenColumnName + (functionName?.length || 0) + 1,
                        message: `Expected ${fun.parameter_types[argumentCount].name} as ${formatOrdinal(argumentCount + 1)} parameter but received ${argument.getResultType().name} instead.`,
                        severity: monaco.MarkerSeverity.Error,
                    });
                }

                args[argumentCount] = argument as Operand;

                if (this.tokens.peek() === ")") {
                    this.tokens.advance();
                    argumentCount++;
                    break;
                }
                this.expect(this.tokens.next(), ",");
            }

            if (fun.parameter_types.length !== argumentCount) {
                this.errors.push({
                    startColumn: tokenColumnName + 1,
                    endColumn: tokenColumnName + fun.name.length + 1,
                    startLineNumber: tokenLine,
                    endLineNumber: tokenLine,
                    message: `Function "${fun.name}" expects ${fun.parameter_types.length} arguments but ${argumentCount} are provided.`,
                    severity: monaco.MarkerSeverity.Error,
                });
            }
            return new Call(fun, args.slice(0, argumentCount));
        }
        else {
            const variable = this.context.getCurrentScope().variables[nextToken];
            if (prefix == 0) {
                if (this.tokens.peek() === "++") {
                    // is postfix
                    this.tokens.advance();
                    postfix = Unary.POSTFIX_INCREMENT;
                }
                else if (this.tokens.peek() === "--") {
                    this.tokens.advance();
                    postfix = Unary.POSTFIX_DECREMENT;
                }
            }

            if (variable != null) {
                if ((prefix | postfix) != 0) {
                    return new Unary(new Access(variable, new Array(0)), (prefix | postfix));
                }
                return new Access(variable, new Array(0));
            }
        }

        throw new ParserException(nextToken, tokenLine, tokenColumn, "Variable '" + nextToken + "' does not exist.");
    }

    parseReturn(): Ret {
        this.tokens.advance();
        const tokenLine = this.tokens.getLine();
        const tokenColumn = this.tokens.getColumn();
        const value = this.parseExpression();
        if (value?.getResultType() !== this.context.currentFunction?.return_type)
            throw new ParserException("", tokenLine, tokenColumn, "Type mismatch: can not convert '" + value?.getResultType().name + "' to '" + this.context.currentFunction?.return_type.name + "'.");

        return new Ret(value as Operand);
    }

    parseIf(): If {
        this.tokens.advance();
        this.expect(this.tokens.next(), "(");

        const condition = this.parseExpression();

        this.expect(this.tokens.next(), ")");
        this.expect(this.tokens.next(), "{");

        const body = this.parseBody();

        this.expect(this.tokens.next(), "}");

        if (this.tokens.peek() !== "else") {
            return new If(condition, body, null);
        }

        this.tokens.advance();
        if (this.tokens.peek() === "if") {
            return new If(condition, body, this.parseIf());
        } else {
            this.expect(this.tokens.next(), "{");
            const elseBody = this.parseBody();
            this.expect(this.tokens.next(), "}");
            return new If(condition, body, new If(null, elseBody, null));
        }
    }

    parseWhile(): While {
        this.tokens.advance();
        this.expect(this.tokens.next(), "(");

        const condition = this.parseExpression();

        this.expect(this.tokens.next(), ")");
        this.expect(this.tokens.next(), "{");
        const body = this.parseBody();
        this.expect(this.tokens.next(), "}");

        return new While(condition as Operand, body);
    }

    parseDoWhile(): While {
        this.tokens.advance();
        this.expect(this.tokens.next(), "{");
        const body = this.parseBody();
        this.expect(this.tokens.next(), "}");

        this.expect(this.tokens.next(), "while");
        this.expect(this.tokens.next(), "(");
        const condition = this.parseExpression();
        this.expect(this.tokens.next(), ")");

        return new While(condition as Operand, body, true);
    }

    parseFor(): For {
        this.tokens.advance();
        this.expect(this.tokens.next(), "(");

        const init = this.tokens.peek() === ";" ? null : this.parseStatement(true);

        this.expect(this.tokens.next(), ";");

        const condition = this.parseExpression();
        this.expect(this.tokens.next(), ";");

        const update = this.parseExpression();

        this.expect(this.tokens.next(), ")");
        this.expect(this.tokens.next(), "{");
        const body = this.parseBody();
        this.expect(this.tokens.next(), "}");

        return new For(init, condition, update, body);
    }

    parseOperator(raw: string): Operand | null {
        switch (raw) {
            case "+": return Operator.ADD;
            case "-": return Operator.SUB;
            case "*": return Operator.MUL;
            case "/": return Operator.DIV;

            case "&&": return Operator.AND;
            case "||": return Operator.OR;

            case "==": return Operator.EQUALS;
            case "!=": return Operator.NOT_EQUALS;
            case "<" : return Operator.LESS_THAN;
            case "<=": return Operator.LESS_EQUALS;
            case ">": return Operator.GREATER_THAN;
            case ">=": return Operator.GREATER_EQUALS;

            case "=": return Operator.ASSIGN;
            default: return null;
        };
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

    expect(token: string | null, expected: string, line: number = this.tokens.getLine(), column: number = this.tokens.getColumn(), message = `Unexpected token: '${token}'. Was expecting "${expected}".`) {
        if (token !== expected) {
            throw new ParserException(token, line, column, message);
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
    return input.match(/^\d+$/) !== null;
}

export function isFloat(input: string): boolean {
    return input.match(/^-?((\d+\.\d+f?)|(\d+f))$/) !== null;
}

export function isBoolean(input: string): boolean {
    return input === "true" || input === "false";
}

export function getPrecedence(input: string) {
    switch (input) {
        case "(":
        case ")":
        case "#": return 1; // was 1
        case "=": return 2; // maybe above NEEDS to be 1. check if breaks
        case "||": return 3;
        case "&&": return 4;
        case "<":
        case ">":
        case "==":
        case "!=":
        case "<=":
        case ">=": return 7;
        case "+":
        case "-": return 8;
        case "*":
        case "/": return 9;
        default: return 0;
    };
}

export class ParserException extends Error {
    public readonly line: number;
    public readonly column: number;
    public readonly token: string | null;

    constructor(token: string | null, line: number, column: number, error: string) {
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

    owner: null = null;

    beginPosition: [ number, number ];

    endPosition: [ number, number ] = [0, 0];

    variables: Record<string, Variable> = {};

    parameterVariables: Record<string, Variable> = {};

    localVariables: Record<string, Variable> = {};

    nextVariableOffset = 1;

    children: Scope[] = [];

    constructor(beginPosition: [ number, number ]) {
        this.beginPosition = beginPosition;
    }

    createChild(beginPosition: [ number, number ], copyLocals: boolean): Scope {
        const child = new Scope(beginPosition);
        this.children.push(child);

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