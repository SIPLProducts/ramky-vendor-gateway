import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const previewHosts = ["localhost", "127.0.0.1", ".lovableproject.com", ".lovable.app"];
const shouldClearPreviewCache = previewHosts.some((host) =>
  host.startsWith(".")
    ? window.location.hostname.endsWith(host)
    : window.location.hostname === host
);

async function clearPreviewPwaCache() {
  if (!shouldClearPreviewCache || !("serviceWorker" in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));

    if ("caches" in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }
  } catch (error) {
    console.error("Failed to clear preview cache", error);
  }
}

function notifyNewVersion() {
  // Lazy import sonner so it doesn't affect initial bundle critical path
  import("sonner").then(({ toast }) => {
    toast.info("A new version is available", {
      description: "Refreshing in 3 seconds to load the latest update…",
      duration: 3000,
    });
  });
}

clearPreviewPwaCache().finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);

  if (!("serviceWorker" in navigator)) return;

  // Periodically check for updates so long-lived sessions also pick up new versions
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => {
      reg.update();
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            // A newer SW is waiting — let the user know; controllerchange will reload.
            notifyNewVersion();
          }
        });
      });
    });
  });

  // Re-check whenever the tab regains focus
  window.addEventListener("focus", () => {
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.update()));
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    // Small delay so the toast is visible before reload
    setTimeout(() => window.location.reload(), 800);
  });
});
