// Apply the saved screen theme before mounting React. Dark-mode surface
// adjustments are large and only needed when dark mode is active.
const storageKey = "checklist.theme";
let preference = "system";

try {
  const saved = localStorage.getItem(storageKey);
  if (["light", "dark", "system"].includes(saved)) preference = saved;
} catch {
  // The theme still works when browser storage is unavailable.
}

const media = window.matchMedia("(prefers-color-scheme: dark)");
let darkThemeStylesPromise;
let applyVersion = 0;

function ensureDarkThemeStyles() {
  if (!darkThemeStylesPromise) {
    darkThemeStylesPromise = import("./styles/dark-theme-surfaces.css").catch((error) => {
      darkThemeStylesPromise = undefined;
      console.error("Unable to load dark theme surface styles", error);
    });
  }
  return darkThemeStylesPromise;
}

async function applyTheme() {
  const version = ++applyVersion;
  const theme = preference === "system" ? (media.matches ? "dark" : "light") : preference;
  if (theme === "dark") await ensureDarkThemeStyles();
  if (version !== applyVersion) return;

  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = preference;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#080808" : "#ffffff");
  window.dispatchEvent(new Event("checklist-theme-change"));
}

window.checklistTheme = {
  getPreference: () => preference,
  setPreference(value) {
    if (!["light", "dark", "system"].includes(value)) return;
    preference = value;
    try {
      localStorage.setItem(storageKey, value);
    } catch {
      // Keep the selection for this session when browser storage is unavailable.
    }
    return applyTheme();
  },
};

media.addEventListener("change", () => {
  void applyTheme();
});

window.addEventListener("storage", (event) => {
  if (event.key !== storageKey && event.key !== null) return;
  preference = ["light", "dark", "system"].includes(event.newValue) ? event.newValue : "system";
  void applyTheme();
});

const themeReady = applyTheme();
export default themeReady;
