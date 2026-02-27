import type { Monaco } from "./Monaco";

export function setupHighlighting(monaco: Monaco) {
    monaco.languages.setMonarchTokensProvider("cbs", {
	tokenizer: {
		root: [
			[/\b(int|float|if|else|return|import|void|string|struct|while|do|for)\b/, "keyword"],
			[/[A-Za-z_]\w*/, "identifier"],
			[/\d+/, "number"],
			[/".*?"/, "string"],
			[/\/\/.*$/, "comment"],
		]
	}
});
}