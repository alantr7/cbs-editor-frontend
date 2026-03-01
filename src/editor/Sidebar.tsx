import type { BotFile } from "../types/editor-types";

interface SidebarProps {
    files: BotFile[],
    openFile: (index: number) => void,
}

export default function Sidebar({files, openFile}: SidebarProps) {
    return <div className="sidebar">
        <div className="files-container">
            {files.map((file, idx) => <div key={file.name} className="file" onClick={() => openFile(idx)}>
                {file.name}
            </div>)}
            <hr />
            <a href="https://github.com/alantr7/codebots/wiki/Scripting-Language" target="_blank">
                <div className="file docs">SCRIPT DOCS</div>
            </a>
        </div>
        <div className="footer">
            <p>cbs-editor v2.0</p>
            <button>see changelog</button>
        </div>
    </div>
}