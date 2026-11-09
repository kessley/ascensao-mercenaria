import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installStoreSounds } from "./audio/storeSounds";
import { loadPixelFont } from "./ui/pixelFont";
import { installPixelFrames } from "./ui/pixelFrames";
import "./index.css";

installStoreSounds();
// As molduras e os botões (G5): imagens feitas por código, postas como variáveis do CSS
installPixelFrames();

// A fonte de pixel (G5) é montada antes: o Phaser desenha os nomes com ela desde o primeiro quadro
void loadPixelFont().finally(() =>
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  ),
);
