import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import { ThemeColorProvider } from "./hooks/useThemeColor";
import "./index.css";

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const hostname = window.location.hostname;
const isPreviewHost =
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname.includes("id-preview--") ||
  hostname.endsWith(".lovableproject.com") ||
  hostname.endsWith(".lovable.app") ||
  hostname.endsWith(".lovable.dev");

const shouldDisableSW = isInIframe || isPreviewHost;

async function clearServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (error) {
    console.error("Failed to clear service workers", error);
  }
}

function notifyNewVersion() {
  import("sonner").then(({ toast }) => {
    toast.info("A new version is available", {
      description: "Refreshing in 3 seconds to load the latest update…",
      duration: 3000,
    });
  });
}

function mount() {
  createRoot(document.getElementById("root")!).render(
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );
}

if (shouldDisableSW) {
  // Preview / iframe: ensure no SW controls the page, then mount.
  clearServiceWorkers().finally(mount);
} else {
  mount();

  if (!("serviceWorker" in navigator)) {
    // nothing else to do
  } else {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => {
        reg.update();
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              notifyNewVersion();
            }
          });
        });
      });
    });

    window.addEventListener("focus", () => {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.update()));
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      setTimeout(() => window.location.reload(), 800);
    });
  }
}
