// Runtime Google Fonts loader.
// Injects <link> tags for web fonts; skips system-installed families.

const SYSTEM_FONTS = new Set(
  [
    'System', 'system-ui', '-apple-system',
    'Arial', 'Helvetica', 'Helvetica Neue',
    'Times New Roman', 'Times', 'Georgia', 'Cambria',
    'Garamond', 'Palatino', 'Book Antiqua', 'Baskerville',
    'Courier New', 'Courier', 'Consolas', 'Monaco', 'Menlo',
    'Trebuchet MS', 'Verdana', 'Tahoma', 'Impact',
    'Comic Sans MS', 'Lucida Console', 'Lucida Sans Unicode',
    'Segoe UI', 'Segoe UI Emoji', 'sans-serif', 'serif', 'monospace',
  ].map((f) => f.toLowerCase()),
);

const loaded = new Set<string>();
let preconnected = false;

function ensurePreconnect() {
  if (preconnected || typeof document === 'undefined') return;
  preconnected = true;
  const h = document.head;
  const l1 = document.createElement('link');
  l1.rel = 'preconnect'; l1.href = 'https://fonts.googleapis.com';
  const l2 = document.createElement('link');
  l2.rel = 'preconnect'; l2.href = 'https://fonts.gstatic.com';
  (l2 as any).crossOrigin = 'anonymous';
  h.appendChild(l1); h.appendChild(l2);
}

export function ensureFontLoaded(family: string) {
  if (!family || typeof document === 'undefined') return;
  const key = family.trim();
  if (!key) return;
  if (SYSTEM_FONTS.has(key.toLowerCase())) return;
  if (loaded.has(key)) return;
  loaded.add(key);
  ensurePreconnect();
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(key).replace(/%20/g, '+')}:wght@300;400;500;600;700;800&display=swap`;
  link.setAttribute('data-gf', key);
  document.head.appendChild(link);
}
