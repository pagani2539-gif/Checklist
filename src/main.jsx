import themeReady from "./theme-preference.js";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App.jsx";
import "./styles/tokens.css";
import "./styles/foundation.css";
import "./styles/redesign.css";
import "./styles/workspace-layout.css";
import "./styles/shell-contract-context.css";

themeReady.then(() => {
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
import "./styles/plum-theme.css";
import "./styles/dark-theme.css";
import "./styles/monochrome-theme.css";
import "./styles/interaction-states.css";
