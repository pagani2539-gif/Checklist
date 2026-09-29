import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App.jsx";
import "./styles/tokens.css";
import "./styles/foundation.css";
import "./styles/redesign.css";
import "./styles/workspace-layout.css";
import "./styles/presentation-cover.css";
import "./styles/contracts.css";
import "./styles/contract-agreement-print.css";
import "./styles/vehicle-report.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
