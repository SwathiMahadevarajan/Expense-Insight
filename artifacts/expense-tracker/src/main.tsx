import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Capture the browser's PWA install prompt as early as possible.
// The event fires before any React components mount, so we park it on window
// and dispatch a custom event so the Settings page can react reactively.
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  (window as any).__pwaInstallPrompt = e;
  window.dispatchEvent(new CustomEvent("pwa-prompt-ready"));
});

window.addEventListener("appinstalled", () => {
  delete (window as any).__pwaInstallPrompt;
  window.dispatchEvent(new CustomEvent("pwa-installed"));
});

createRoot(document.getElementById("root")!).render(<App />);
