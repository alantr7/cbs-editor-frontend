import { ModuleRepository } from "./module-repository";
import type { TokenQueue } from "./tokenizer";

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
    new Parser(tokens);
}

class Parser {
    
    public readonly tokens: TokenQueue;

    // todo: improve this
    public readonly moduleRepository = new ModuleRepository();

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