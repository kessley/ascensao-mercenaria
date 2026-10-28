import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installStoreSounds } from "./audio/storeSounds";
import "./index.css";

installStoreSounds();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
