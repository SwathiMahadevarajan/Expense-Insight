import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Register the service worker manually — VitePWA's auto-registration script is
// injected as an empty <script> tag in Replit's proxy environment, so we do it
// ourselves. Dev mode uses /dev-dist/sw.js; production build uses /sw.js.
if ("serviceWorker" in navigator) {
  const swUrl = import.meta.env.DEV ? "/dev-dist/sw.js" : "/sw.js";
  navigator.serviceWorker
    .register(swUrl, { scope: "/" })
    .then((reg) => {
      console.log("[PWA] Service worker registered", reg.scope);
    })
    .catch((err) => {
      console.warn("[PWA] Service worker registration failed", err);
    });
}

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
