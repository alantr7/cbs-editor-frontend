import * as monaco from 'monaco-editor';
import { tokenize } from './tokenizer';
import { parse, Scope } from './parser';
import type { EditorSession } from '../../types/session';

export function buildAST(lines: string[], session: EditorSession): BuildResult {
    const tokens = tokenize(lines);
    const ast = parse(tokens, session);

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
    imports: string[],
    signatures: FunctionSignature[],
    functions: Record<string, Function>,
    scopes_tree: Scope,
}

export interface FunctionSignature {
    module: string | null,
    name: string,
    completion: string,
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

export abstract class StmtExpr {
    column: number = 0;
    length: number = 0;
    abstract isStatement(): boolean;
    abstract isExpression(): boolean;
    abstract getResultType(): Type;
}

export abstract class Operand extends StmtExpr {
}

export class Declare extends StmtExpr {
    type: Type;
    value: Operand | null;
    lengths: number[];

    constructor(type: Type, value: Operand | null, lengths: number[]) {
        super();
        this.type = type;
        this.value = value;
        this.lengths = lengths;
    }
    
    isStatement(): boolean {
        return true;
    }
    isExpression(): boolean {
        return true;
    }
    getResultType(): Type {
        return this.type;
    }
}

export class Assign extends StmtExpr {
    variable: Variable;
    indices: Operand[];
    value: Operand;

    static SET: number = 30;

    constructor(variable: Variable, indices: Operand[], value: Operand) {
        super();
        this.variable = variable;
        this.indices = indices;
        this.value = value;
    }
    
    isStatement(): boolean {
        return true;
    }
    isExpression(): boolean {
        return true;
    }
    getResultType(): Type {
        return this.variable.type;
    }
}

export class Cast extends StmtExpr {
    operand: Operand;
    type: Type;

    constructor(operand: Operand, type: Type) {
        super();
        this.operand = operand;
        this.type = type;
    }

    isStatement(): boolean {
        return false;
    }
    isExpression(): boolean {
        return true;
    }
    getResultType(): Type {
        return this.type;
    }
}

export class If extends StmtExpr {
    expression: Operand | null;
    body: StmtExpr[];
    elseStmt: If | null;

    constructor(expression: Operand | null, body: StmtExpr[], elseStmt: If | null) {
        super();
        this.expression = expression;
        this.body = body;
        this.elseStmt = elseStmt;
    }

    isStatement(): boolean {
        return true;
    }
    isExpression(): boolean {
        return false;
    }
    getResultType(): Type {
        return Type.VOID;
    }
}

export class While extends If {
    isDoWhile: boolean;
    constructor(expression: Operand, body: StmtExpr[], isDoWhile: boolean = false) {
        super(expression, body, null);
        this.isDoWhile = isDoWhile;
    }
}

export class For extends StmtExpr {
    init: StmtExpr | null;
    condition: Operand | null;
    update: Operand | null;
    body: StmtExpr[];

    constructor(init: StmtExpr | null, condition: Operand | null, update: Operand | null, body: StmtExpr[]) {
        super();
        this.init = init;
        this.condition = condition;
        this.update = update;
        this.body = body;
    }

    isExpression(): boolean {
        return false;
    }
    isStatement(): boolean {
        return true;
    }
    getResultType(): Type {
        // SHOULD NOT HAPPEN!
        return Type.VOID;
    }
}

export class LoopCommand extends StmtExpr {
    static CONTINUE = 0;
    static BREAK = 1;

    type: number;

    constructor(type: number) {
        super();
        this.type = type;
    }

    isExpression(): boolean {
        return false;
    }
    isStatement(): boolean {
        return true;
    }
    getResultType(): Type {
        return Type.VOID;
    }
}

export class Literal extends Operand {
    static INT = 0;
    static FLOAT = 1;
    static STRING = 5;

    value: number | string;
    type: number;

    constructor(type: number, value: number | string) {
        super();
        this.type = type;
        this.value = value;
    }

    isExpression(): boolean {
        return true;
    }
    isStatement(): boolean {
        return true;
    }
    getResultType(): Type {
        return this.type == Literal.INT ? Type.INT : this.type === Literal.FLOAT ? Type.FLOAT : Type.STRING;
    }
}

export class Access extends Operand {
    variable: Variable;
    indices: Operand[];

    constructor(variable: Variable, indices: Operand[]) {
        super();
        this.variable = variable;
        this.indices = indices;
    }

    isExpression(): boolean {
        return true;
    }
    isStatement(): boolean {
        return true;
    }
    getResultType(): Type {
        return this.variable.type;
    }
}

export class Compare extends Operand {
    left: Operand;
    right: Operand;
    operation: number;

    static EQUALS = 20;
    static NOT_EQUALS = 21;
    static LESS_THAN = 22;
    static GREATER_THAN = 23;
    static LESS_EQUALS = 24;
    static GREATER_EQUALS = 25;

    constructor(left: Operand, operation: number, right: Operand) {
        super();
        this.left = left;
        this.right = right;
        this.operation = operation;
    }

    isStatement(): boolean {
        return false;
    }
    isExpression(): boolean {
        return true;
    }
    getResultType(): Type {
        return Type.INT;
    }
}

export class Logical extends Operand {
    operands: Operand[];

    static AND = 10;
    static OR = 11;

    constructor(operands: Operand[]) {
        super();
        this.operands = operands;
    }

    isStatement(): boolean {
        return false;
    }
    isExpression(): boolean {
        return true;
    }
    getResultType(): Type {
        return Type.INT;
    }
}

export class Unary extends Operand {
    operand: Access;
    operation: number;

    static PREFIX_INCREMENT = 40;
    static POSTFIX_INCREMENT = 41;
    static PREFIX_DECREMENT = 42;
    static POSTFIX_DECREMENT = 43;

    constructor(operand: Access, operation: number) {
        super();
        this.operand = operand;
        this.operation = operation;
    }

    isExpression(): boolean {
        return true;
    }
    isStatement(): boolean {
        return true;
    }
    getResultType(): Type {
        return this.operand.variable.type;
    }
}

export class Arithmetic extends Operand {
    operands: Operand[];

    static ADD = 0;
    static SUB = 1;
    static MUL = 2;
    static DIV = 3;
    static MOD = 4;

    constructor(operands: Operand[]) {
        super();
        this.operands = operands;
    }

    isExpression(): boolean {
        return true;
    }
    isStatement(): boolean {
        return true;
    }
    getResultType(): Type {
        // todo: check this based on operands
        return Type.INT;
    }
}

export class Operator extends Operand {
    type: number;

    public static ADD = new Operator(Arithmetic.ADD);
    public static SUB = new Operator(Arithmetic.SUB);
    public static MUL = new Operator(Arithmetic.MUL);
    public static DIV = new Operator(Arithmetic.DIV);

    public static AND = new Operator(Logical.AND);
    public static OR = new Operator(Logical.OR);

    public static EQUALS = new Operator(Compare.EQUALS);
    public static NOT_EQUALS = new Operator(Compare.NOT_EQUALS);
    public static LESS_THAN = new Operator(Compare.LESS_THAN);
    public static GREATER_THAN = new Operator(Compare.GREATER_THAN);
    public static LESS_EQUALS = new Operator(Compare.LESS_EQUALS);
    public static GREATER_EQUALS = new Operator(Compare.GREATER_EQUALS);

    public static ASSIGN = new Operator(Assign.SET);

    public static PREFIX_INCREMENT = new Operator(Unary.PREFIX_INCREMENT);
    public static POSTFIX_INCREMENT = new Operator(Unary.POSTFIX_INCREMENT);
    public static PREFIX_DECREMENT = new Operator(Unary.PREFIX_DECREMENT);
    public static POSTFIX_DECREMENT = new Operator(Unary.POSTFIX_DECREMENT);

    constructor(type: number) {
        super();
        this.type = type;
    }

    isExpression(): boolean {
        return true;
    }
    isStatement(): boolean {
        return false;
    }
    getResultType() {
        // todo: this should not happen!
        return Type.INT;
    }
}

export class Call extends Operand {
    fun: FunctionSignature;
    args: Operand[];

    constructor(fun: FunctionSignature, args: Operand[]) {
        super();
        this.fun = fun;
        this.args = args;
    }

    isExpression(): boolean {
        return true;
    }
    isStatement(): boolean {
        return true;
    }
    getResultType(): Type {
        return this.fun.return_type;
    }
}

export class Ret extends StmtExpr {
    value: Operand;
    constructor(value: Operand) {
        super();
        this.value = value;
    }

    isExpression(): boolean {
        return false;
    }
    isStatement(): boolean {
        return true;
    }
    getResultType(): Type {
        return this.value.getResultType();
    }
}

export class Concat extends Operand {
    left: Operand;
    right: Operand;

    constructor(left: Operand, right: Operand) {
        super();
        this.left = left;
        this.right = right;
    }

    isExpression(): boolean {
        return true;
    }
    isStatement(): boolean {
        return false;
    }
    getResultType(): Type {
        return Type.STRING;
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
    public readonly name: string;
    constructor(name: string) {
        this.name = name;
    }

    static INT      = new Type("int");
    static FLOAT    = new Type("float");
    static STRING   = new Type("string");
    static VOID     = new Type("void");

    accepts(type: Type): boolean {
        if (type === this)
            return true;
        
        if (type !== Type.INT)
            return false;

        return this == Type.FLOAT;
    }

    static parseType(input: string): Type | null {
        switch (input) {
            case "int":     return Type.INT;
            case "float":   return Type.FLOAT;
            case "string":  return Type.STRING;
            case "void":    return Type.VOID;
            default:        return null;
        }
    }

}