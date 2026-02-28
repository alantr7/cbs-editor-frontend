import type { Monaco } from "./Monaco";

export function setupHighlighting(monaco: Monaco) {
	monaco.editor.defineTheme("catppuccin-mocha", {
				base: "vs-dark",
				inherit: true,
				rules: [
					{ token: "comment", foreground: "9cdba4" },
					{ token: "module-accessor", foreground: "9e9e9e" },
					{ token: "keyword", foreground: "e98282" },
					{ token: "string", foreground: "a6e3a1" },
					// { token: "number", foreground: "f9e2af" },
					{ token: "identifier", foreground: "cdd6f4" },
					{ token: "function", foreground: "89b4fa" },
				],
				colors: {
					"editor.background": "#282c34",
					"editor.foreground": "#cdd6f4",
					"editorLineNumber.foreground": "#6c7086",
					"editorCursor.foreground": "#f5e0dc",
					"editor.selectionBackground": "#45475a",
					"editor.lineHighlightBackground": "#6699ff0b"
				},
			});
    monaco.languages.setMonarchTokensProvider("cbs", {
	tokenizer: {
		root: [
			[/\b(int|float|if|else|return|import|void|string|struct|while|do|for)\b/, "keyword"],
			[/[A-Za-z_]\w*/, "identifier"],
			[/\d+/, "number"],
			[/".*?"/, "string"],
			[/\./, "module-accessor"],
			[/\/\/.*$/, "comment"],
		]
	}
});
}