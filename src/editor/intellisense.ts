import type { Monaco } from "./Monaco";

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

export function setupIntellisense(monaco: Monaco) {
    monaco.languages.setLanguageConfiguration("cbs", {
        autoClosingPairs: [
            { open: "(", close: ")" },
            { open: "[", close: "]" },
            { open: "{", close: "}" },
        ],
        brackets: [['{', '}']]
    });

    // if statement snippet
    registerSnippet(monaco, "i", "if", "if ($1) {\n\t$0\n};");
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
}

function registerSnippet(monaco: Monaco, trigger: string, label: string, text: string) {
    monaco.languages.registerCompletionItemProvider("cbs", {
        triggerCharacters: [trigger],
        provideCompletionItems: function (model, position) {
            const suggestions: any[] = [{
                label: label,
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: text,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            }];
            return { suggestions };
        }
    });
}