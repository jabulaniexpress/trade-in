import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import JabulaniReLife from "../jabulani-relife-tradein.jsx";

createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <JabulaniReLife />
    </React.StrictMode>,
);
