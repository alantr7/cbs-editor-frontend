import axios from "axios";
import { useEffect, useState } from "react";
import ReactModal from "react-modal";

interface ChangelogsProps {
    close(): void,
}
export function Changelogs({ close }: ChangelogsProps) {
    const [ logs, setLogs ] = useState<any[]>([]);

    useEffect(() => {
        axios.get("/changelog/v2.0.json").then(r => {
            setLogs([r.data]);
        });
    }, []);

    return <ReactModal isOpen={true} className="changelog" overlayClassName="changelog-overlay" onRequestClose={close}>
        <h3>Changelogs</h3>
        {logs.map(log => <div>
            <h4>Version v{log.title}</h4>
            <small>{log.date}</small><br />
            <ul>
                Changes:
                {log.items.map((item: any, idx: number) => <li key={idx}>
                    {item}
                </li>)}
            </ul>
        </div>)}
    </ReactModal>
}