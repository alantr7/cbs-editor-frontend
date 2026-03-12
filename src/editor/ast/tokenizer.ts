import { isFloat, isOperator, isUnaryOperator } from "./parser";

export function tokenize(input: string[]) {
    const lines: string[][] = [];
    const lineNumbers: number[] = [];
    const columns: number[][] = [];

    for (let i = 0; i < input.length; i++) {
        const line = input[i];
        const tokenized = tokenizeLine(line);
        if (tokenized[0].length == 0)
            continue;

        lines.push(tokenized[0]);
        columns.push(tokenized[1]);
        lineNumbers.push(i + 1);

        console.log("['" + tokenized[0].join("', '") + "']");
    }

    return new TokenQueue(lines, lineNumbers, columns)
}

const SYMBOLS = " ()[]{}<>=!,.\n+-?*/&|;";
function isSymbol(ch: string) {
    return SYMBOLS.includes(ch);
}

function tokenizeLine(line: string): [string[], number[]] {
    const columnsOffset = line.length - line.trimStart().length;
    line = line.trim();
    const tokens: string[] = [];
    const columns: number[] = [];
    let quotes = false;
    let start = 0;

    if (line.startsWith("//")) {
        return [tokens, columns];
    }

    for (let i = 1; i < line.length; i++) {
        const character = line.charAt(i);
        if (character == '"') {
            if (quotes) {
                tokens.push(line.substring(start, i + 1));
                columns.push(start + columnsOffset);
                start = i + 1;
            }
            quotes = !quotes;
            continue;
        }
        if (quotes)
            continue;

        if (isSymbol(character)) {
            if (character == '.' && line.substring(start, i).match(/^\d+/))
                continue;

            let token: string | null = null;

            if (character == '=' && tokens[tokens.length - 1] !== undefined) {
                const multicharSymbols = "<>=!";
                if (multicharSymbols.includes(tokens[tokens.length - 1] as string)) {
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

            if (token === null) {
                token = line.substring(start, i);
            }

            if (token.trim().length !== 0) {
                // Check if it's a negative number
                // todo: verify if works correctly!
                if (token.match(/^(\d+\.\d+)|(\d+)f?$/) && tokens.length > 1) {
                    const previous = tokens[tokens.length - 1];
                    const previous2 = tokens[tokens.length - 2];

                    if (previous === "-" && previous2.length === 1 && isSymbol(previous2.charAt(0))) {
                        tokens.pop();
                        token = "-" + token;
                    }

                    if (isFloat(token)) {
                        tokens.push(token);
                        start = i;
                        continue;
                    }
                }
                tokens.push(token);
                columns.push(start + columnsOffset);
            }

            start = i + 1;

            if (character !== ' ' && !isOperator(token) && !isUnaryOperator(token)) {
                tokens.push(character);
                columns.push(start + columnsOffset);
            }
        }
    }

    const last = line.substring(start);
    if (last.trim().length !== 0) {
        tokens.push(last);
        columns.push(start + columnsOffset);
    }

    return [ tokens, columns ];
}

export class TokenQueue {
    public readonly queue: string[][];
    public readonly lines: number[];
    public readonly columns: number[][];
    public offset: number = 0;
    public row: number = 0;
    public col: number = 0;
    public prevRow: number = 0;
    public prevCol: number = 0;

    constructor(lines: string[][], lineNumbers: number[], columns: number[][]) {
        this.queue = lines;
        this.lines = lineNumbers;
        this.columns = columns;

        if (lines[0].length === 0)
            this.advance();
    }

    peek(): string | null {
        if (this.isEmpty())
            return null;

        return this.queue[this.row][this.col];
    }

    next(): string | null {
        const token = (this.queue[this.row] || [])[this.col] || null;
        if (token) {
            this.advance();
        }

        return token;
    }

    rollback(): void {
        this.col--;
        this.offset--;

        if (this.col < 0) {
            this.row--;
            this.col = this.queue[this.row].length - 1;
        }
    }

    advance(): void {
        this.prevRow = this.row;
        this.prevCol = this.col;
        this.col++;

        if (this.col >= this.queue[this.row].length) {
            this.row++;
            this.col = 0;
        }

        if (!this.isEmpty() && this.queue[this.row].length == 0)
            this.advance();
    }

    getLine(): number {
        return this.lines[this.row];
    }

    getPrevLine(): number {
        return this.lines[this.prevRow];
    }

    getColumn(): number {
        return (this.columns[this.row] || [0])[this.col] || 0;
    }

    getPrevColumn(): number {
        return (this.columns[this.prevRow] || [0])[this.prevCol] || 0;
    }

    isEmpty(): boolean {
        return this.row >= this.queue.length;
    }

}