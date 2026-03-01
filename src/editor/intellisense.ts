import type { AST } from "./ast/ast";
import type { Scope } from "./ast/parser";
import type { Monaco } from "./Monaco";
import { Position } from 'monaco-editor';

const ast: Record<string, Record<string, Record<string, any[]>>> = {
	"modules": {
		"bot": {
			"functions": [
				{
					"name": "print", "return_type": "int", "parameters": ["string"], "completion": "print(\"$1\")$0",
				},
				{
					"name": "move", "return_type": "int", "parameters": ["string"], "completion": "move(\"$1\")$0",
				}
			]
		}
	}
};

let latestAst: AST;
export function setLatestAST(ast: AST) {
    latestAst = ast;
}

export function setupIntellisense(monaco: Monaco) {
    monaco.languages.setLanguageConfiguration("cbs", {
        autoClosingPairs: [
            { open: "(", close: ")" },
            { open: "[", close: "]" },
            { open: "{", close: "}" },
            { open: '"', close: '"' },
        ],
        brackets: [['{', '}']]
    });

    // if statement snippet
    registerSnippet(monaco, "i", "if", "if ($1) {\n\t$0\n}");
    registerSnippet(monaco, "w", "while", "while ($1) {\n\t$0\n}");
    registerSnippet(monaco, "d", "do", "do {\n\t$0\n} while ($1);");
    registerSnippet(monaco, "f", "for", "for ($1; $2; $3) {\n\t$0\n}");
    registerSnippet(monaco, "r", "return", "return $1;");

    // imported functions
    monaco.languages.registerCompletionItemProvider("cbs", {
        triggerCharacters: ["."],
        provideCompletionItems: function (model, position) {
            const textUntilPosition = model.getValueInRange({
                startLineNumber: position.lineNumber,
                startColumn: 1,
                endLineNumber: position.lineNumber,
                endColumn: position.column
            });

            const match = textUntilPosition.match(/([a-zA-Z_]\w*)\.$/);
            if (!match) return { suggestions: [] };

            const moduleName = match[1];
            const functions = ast.modules[moduleName].functions;
            if (!functions) return { suggestions: [] };

            const suggestions: any[] = functions.map(fn => ({
                label: fn.name,
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: fn.completion,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            }));
            return { suggestions };
        }
    });

    // pressing ctrl + space. modules + variable names + functions
    monaco.languages.registerCompletionItemProvider("cbs", {
        triggerCharacters: [],
        provideCompletionItems: function (model, position) {
            const suggestions: any[] = [];

            // modules
            suggestions.push(...Object.keys(ast.modules).map(m => ({
                label: m,
                kind: monaco.languages.CompletionItemKind.Module,
                insertText: m + ".",
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            })));

            // local variables
            const scope = getScopeRecursively(latestAst.scopes_tree, position);
            console.log('latest scope: ', latestAst.scopes_tree, scope);
            
            suggestions.push(...Object.keys(scope.variables).map(v => ({
                label: v,
                kind: monaco.languages.CompletionItemKind.Variable,
                insertText: v,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            })));

            // functions
            suggestions.push(...latestAst.signatures.filter(f => f.module === null).map(f => ({
                label: f.name,
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: f.name + "($1)$0",
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            })));

            return { suggestions };
        }
    });
}

function getScopeRecursively(scope: Scope, position: Position) {
    for (const child of scope.children) {
        if (position.lineNumber > child.beginPosition[0] && position.lineNumber < child.endPosition[0])
            return getScopeRecursively(child, position);

        if (position.lineNumber === child.beginPosition[0] || position.lineNumber === child.endPosition[0])
            if (position.column >= child.beginPosition[1] && position.column <= child.endPosition[1])
                return getScopeRecursively(child, position);
    }
    return scope;
}

function registerSnippet(monaco: Monaco, trigger: string, label: string, text: string) {
    monaco.languages.registerCompletionItemProvider("cbs", {
        triggerCharacters: [trigger],
        provideCompletionItems: function () {
            const suggestions: any[] = [{
                label: label,
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: text,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            }];
            return { suggestions };
        }
    });
}