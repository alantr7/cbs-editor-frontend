import { isOperator, isUnaryOperator } from "./parser";

export function tokenize(input: string[]) {
    const lines: string[][] = [];
    const lineNumbers: number[] = [];
    for (let i = 0; i < input.length; i++) {
        const line = input[i];
        const tokenized = tokenizeLine(line);
        if (tokenized.length == 0)
            continue;

        lines.push(tokenized);
        lineNumbers.push(i + 1);

        console.log("['" + tokenized.join("', '") + "']");
    }

    return new TokenQueue(lines, lineNumbers)
}

const SYMBOLS = " ()[]{}<>=!,.\n+-?*/&|;";
function isSymbol(ch: string) {
    return SYMBOLS.includes(ch);
}

function tokenizeLine(line: string): string[] {
    const tokens: string[] = [];
    let quotes = false;
    let start = 0;

    for (let i = 1; i < line.length; i++) {
        const character = line.charAt(i);
        if (character == '"') {
            if (quotes) {
                tokens.push(line.substring(start, i + 1));
                start = i + 1;
            }
            quotes = !quotes;
            continue;
        }
        if (quotes)
            continue;

        if (isSymbol(character)) {
            let token: string | null = null;

            if (character == '=' && tokens[tokens.length - 1] != null) {
                const multicharSymbols = "<>=!";
                if (multicharSymbols.includes(tokens.pop() as string)) {
                    token = tokens.pop() + character;
                }
            }

            // todo: improve this ugly stuff
            else if ((character == '|' && "|" === tokens[tokens.length - 1]) || (character == '&' && "&" === tokens[tokens.length - 1]) || (character == '+' && "+" === tokens[tokens.length - 1]) || (character == '-' && "-" === tokens[tokens.length - 1])) {
                token = tokens.pop() + character;
            }

            else if (character == ')' && "(" === tokens[tokens.length - 1]) {
                const cast = line.substring(start, i);
                if (cast === "int" || cast === "float") {
                    token = "(" + cast + ")";
                    tokens.pop();
                }
            }

            if (token == null) {
                token = line.substring(start, i);
            }

            if (token.trim().length !== 0) {
                // Check if it's a negative number
                // todo: verify if works correctly!
                if (token.match(/$\d+$/) && tokens.length > 1) {
                    const previous = tokens[tokens.length - 1];
                    const previous2 = tokens[tokens.length - 2];

                    if (previous === "-" && previous2.length === 1 && isSymbol(previous2.charAt(0))) {
                        tokens.pop();
                        token = "-" + token;
                    }
                }
                tokens.push(token);
            }

            start = i + 1;

            if (character != ' ' && !isOperator(token) && !isUnaryOperator(token))
                tokens.push(character);
        }
    }

    var last = line.substring(start);
    if (last.trim().length !== 0)
        tokens.push(last);

    return tokens;
}

export class TokenQueue {
    public readonly lines: string[][];
    public readonly lineNumbers: number[];

    constructor(lines: string[][], lineNumbers: number[]) {
        this.lines = lines;
        this.lineNumbers = lineNumbers;
    }
}