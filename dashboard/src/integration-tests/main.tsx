import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./integration-tests.css";
import "../shared/plugin-selector.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
