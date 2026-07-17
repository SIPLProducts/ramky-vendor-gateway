import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import { ThemeColorProvider } from "./hooks/useThemeColor";
import { DesignSettingsProvider } from "./hooks/useDesignSettings";
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
      description: "Click Refresh to load the latest update.",
      duration: Infinity,
      action: {
        label: "Refresh",
        onClick: () => window.location.reload(),
      },
    });
  });
}


function mount() {
  createRoot(document.getElementById("root")!).render(
    <HelmetProvider>
      <ThemeColorProvider>
        <DesignSettingsProvider>
          <App />
        </DesignSettingsProvider>
      </ThemeColorProvider>
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

    // Intentionally NOT re-checking SW on window focus and NOT auto-reloading
    // on controllerchange. Auto-reload was causing the whole app to refresh
    // when users switched tabs / minimized the browser, closing open modals
    // and dropping unsaved form state. Users get a persistent toast (see
    // notifyNewVersion) and refresh explicitly when they're ready.
  }
}

