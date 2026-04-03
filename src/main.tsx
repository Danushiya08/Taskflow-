import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

(globalThis as any).global = globalThis;

import App from "./App";
import { Toaster } from "sonner";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <Toaster richColors position="top-right" />
  </StrictMode>
);