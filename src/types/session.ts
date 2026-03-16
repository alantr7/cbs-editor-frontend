import type { FunctionSignature } from "../editor/ast/ast";

export type ModuleRepository = Record<string, Module>;

export interface EditorSession {
    id: string,
    expires_at: number,
    author?: string,
    modules: ModuleRepository,
}

export interface Module {
    name: string,
    functions: FunctionSignature[],
}