import React from "react";
import {createRoot} from "react-dom/client";

import {App} from "./App";
import {ErrorBoundary} from "./components/ErrorBoundary";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
