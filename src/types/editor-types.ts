export interface BotFile {
    id: string,
    name: string,
    content: string,
    is_saving: boolean,
    saved_content: string,
    last_modified: number,
}