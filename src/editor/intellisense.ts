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