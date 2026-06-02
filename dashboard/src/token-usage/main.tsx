import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "../performance-dashboard/performance-dashboard.css";
import "./token-usage.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
