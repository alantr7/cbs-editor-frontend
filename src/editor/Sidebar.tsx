export default function Sidebar() {
    return <div className="sidebar">
        <div className="files-container">
            <div className="file active">file-1</div>
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