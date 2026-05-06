import { useLocation } from "react-router";

const codeToMessageMap: Record<string, string> = {
    "no_access": "You have no access to this session.",
    "expired": "Session has expired.",
    "": "",
};

export default function ErrorPage() {
    const location = useLocation();
    const code = new URLSearchParams(location.search).get("code");

    let message: string = codeToMessageMap[code || ""] || "This page does not exist.";

    return <div id="error-page">
        <h3>Oops,</h3>
        <p>{message}</p>
    </div>
}