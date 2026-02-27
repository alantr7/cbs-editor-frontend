import type { FunctionSignature } from "./ast";

export class ModuleRepository {

    private modules: Record<string, Module> = {};

    getModule(name: string): Module {
        return this.modules[name];
    }

    registerModule(module: Module): void {
        this.modules[module.name] = module;
    }

}

export interface Module {
    name: string,
    functions: Record<string, FunctionSignature>,
}