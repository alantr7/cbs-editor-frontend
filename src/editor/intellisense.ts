import type { EditorSession } from "../types/session";
import type { AST } from "./ast/ast";
import type { Scope } from "./ast/parser";
import type { Monaco } from "./Monaco";
import { Position } from 'monaco-editor';

let latestAst: AST;
export function setLatestAST(ast: AST) {
    latestAst = ast;
}

export function setupIntellisense(monaco: Monaco, session: EditorSession) {
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
    registerSnippet(monaco, "c", "continue", "continue;");
    registerSnippet(monaco, "b", "break", "break;");
    registerSnippet(monaco, "r", "return", "return $1;");

    // pressing ctrl + space. modules + variable names + functions
    monaco.languages.registerCompletionItemProvider("cbs", {
        triggerCharacters: ["", ".", " "],
        provideCompletionItems: function (model, position) {
            const textUntilPosition = model.getValueInRange({
                startLineNumber: position.lineNumber,
                startColumn: 1,
                endLineNumber: position.lineNumber,
                endColumn: position.column
            });
            const suggestions: any[] = [];

            // check if inside a string
            let isInsideString = false;
            for (let i = 0; i < textUntilPosition.length; i++) {
                // todo: handling quote escaping
                if (textUntilPosition[i] === '"') {
                    isInsideString = !isInsideString;
                }
            }

            if (isInsideString) {
                return  { suggestions };
            }

            const scope = getScopeRecursively(latestAst.scopes_tree, position);
            console.log('latest scope: ', latestAst.scopes_tree, scope);

            const matchModuleAccess = textUntilPosition.match(/([a-zA-Z_]\w*)\.$/);
            if (matchModuleAccess) {
                const moduleName = matchModuleAccess[1];
                const functions = session.modules[moduleName].functions;
                if (!functions || moduleName === "lang") return { suggestions: [] };

                const suggestions: any[] = functions.map(fn => ({
                    label: {
                        label: `${fn.name}`,
                        detail: `(${fn.parameter_types.map(param => param.name).join(", ")})`,
                        description: fn.return_type?.name,
                    },
                    kind: monaco.languages.CompletionItemKind.Function,
                    insertText: fn.completion,
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                }));
                return { suggestions };
            }

            const matchModuleImport = textUntilPosition.match(/import( )+$/);
            if (matchModuleImport) {
                const suggestions: any[] = Object.keys(session.modules).filter(m => m !== "lang").map(module => ({
                    label: module,
                    kind: monaco.languages.CompletionItemKind.Function,
                    insertText: module + ";",
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                }));
                return { suggestions };
            }

            // modules
            suggestions.push(...Object.keys(session.modules).filter(m => m !== "lang").map(m => ({
                label: m,
                kind: monaco.languages.CompletionItemKind.Module,
                insertText: m + ".",
                sortText: "1_" + m,
                detail: "module",
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                command: {
                    id: "editor.action.triggerSuggest"
                }
            })));

            // local variables            
            suggestions.push(...Object.keys(scope.variables).map(v => ({
                label: v,
                kind: monaco.languages.CompletionItemKind.Variable,
                insertText: v,
                sortText: "0_" + v,
                detail: scope.variables[v].type.name,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            })));

            // functions
            suggestions.push(...latestAst.signatures.filter(f => f.module === null).map(f => ({
                label: f.name,
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: f.name + "($1)$0",
                sortText: "2_" + f.name,
                detail: f.return_type.name,
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
        provideCompletionItems: function (model, position) {
            const textUntilPosition = model.getValueInRange({
                startLineNumber: position.lineNumber,
                startColumn: 1,
                endLineNumber: position.lineNumber,
                endColumn: position.column
            });

            // check if inside a string
            let isInsideString = false;
            for (let i = 0; i < textUntilPosition.length; i++) {
                // todo: handling quote escaping
                if (textUntilPosition[i] === '"') {
                    isInsideString = !isInsideString;
                }
            }

            if (isInsideString) {
                return  { suggestions: [] };
            }

            const scope = getScopeRecursively(latestAst.scopes_tree, position);
            if (scope && scope.beginPosition[0] !== 0) {
                const suggestions: any[] = [{
                    label: label,
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: text,
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                }];
                return { suggestions };
            }
            return { suggestions: [] };
        }
    });
}