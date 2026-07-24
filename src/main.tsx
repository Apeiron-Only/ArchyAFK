import "@fontsource-variable/inter";
import "./styles/globals.css";

import React from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";

const root = document.getElementById("root");

if (!root) {
  throw new Error("React kök düğümü bulunamadı");
}

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
