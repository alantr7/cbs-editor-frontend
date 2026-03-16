import type { BotFile } from "../types/editor-types";

interface SidebarProps {
    files: BotFile[],
    currentFile: number,
    openFile: (index: number) => void,
    openChangelog: () => void,
}

export default function Sidebar({files, currentFile, openFile, openChangelog}: SidebarProps) {
    return <div className="sidebar">
        <div className="files-container">
            {files.map((file, idx) => <div key={file.name} className={`file ${idx === currentFile && "active"}`} onClick={() => openFile(idx)}>
                {file.name}
            </div>)}
            <hr />
            <a href="https://github.com/alantr7/codebots/wiki/Scripting-Language" target="_blank">
                <div className="file docs">SCRIPT DOCS</div>
            </a>
        </div>
        <div className="footer">
            <p>cbs-editor v2.0</p>
            <button onClick={openChangelog}>see changelog</button>
        </div>
    </div>
}