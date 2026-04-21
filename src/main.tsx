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

clearPreviewPwaCache().finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);

  // Always check for SW updates on every page load and reload when a new one activates
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.update());
    });
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }
});
