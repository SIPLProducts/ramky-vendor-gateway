// Runtime action-button tagger.
// Presentation-only: scans button-like elements, matches their visible text,
// and stamps a stable `data-action` attribute so per-action CSS variables
// (see index.css) can style them. Never touches handlers or business logic.

export const ACTION_KEYS = [
  'approve-forward',
  'send-vendor',
  'duplicate-close',
  'view-details',
  'add-config',
  'export-excel',
  'export-pdf',
  'export-csv',
  'approve',
  'reject',
  'preview',
  'save',
  'update',
  'create',
  'search',
  'reset',
  'cancel',
  'clear',
  'sync',
  'submit',
  'delete',
  'invite',
] as const;

export type ActionKey = typeof ACTION_KEYS[number];

// Ordered — longer/more specific first so "Approve & Forward" wins over "Approve".
const MATCHERS: { key: ActionKey; test: (t: string) => boolean }[] = [
  { key: 'approve-forward', test: (t) => /\bapprove\s*(&|and)\s*forward\b/.test(t) },
  { key: 'send-vendor',     test: (t) => /\bsend\s+to\s+vendor\b/.test(t) },
  { key: 'duplicate-close', test: (t) => /\bduplicate\s*(&|and)\s*close\b/.test(t) },
  { key: 'view-details',    test: (t) => /\bview\s+details?\b/.test(t) || /^view$/.test(t) },
  { key: 'add-config',      test: (t) => /\badd\s+config(uration)?\b/.test(t) },
  { key: 'export-excel',    test: (t) => /\bexport\b.*\bexcel\b|\bexcel\b/.test(t) },
  { key: 'export-pdf',      test: (t) => /\bexport\b.*\bpdf\b|^pdf$/.test(t) },
  { key: 'export-csv',      test: (t) => /\bexport\b.*\bcsv\b|^csv$/.test(t) },
  { key: 'approve',         test: (t) => /^approve\b/.test(t) || /\bapprove\b/.test(t) },
  { key: 'reject',          test: (t) => /\breject\b/.test(t) },
  { key: 'preview',         test: (t) => /\bpreview\b/.test(t) },
  { key: 'update',          test: (t) => /\bupdate\b/.test(t) },
  { key: 'create',          test: (t) => /\bcreate\b/.test(t) },
  { key: 'invite',          test: (t) => /\binvite\b/.test(t) },
  { key: 'search',          test: (t) => /^search$|\bsearch\b/.test(t) },
  { key: 'reset',           test: (t) => /\breset\b/.test(t) },
  { key: 'cancel',          test: (t) => /\bcancel\b/.test(t) },
  { key: 'clear',           test: (t) => /\bclear\b/.test(t) },
  { key: 'sync',            test: (t) => /\bsync\b/.test(t) },
  { key: 'submit',          test: (t) => /\bsubmit\b/.test(t) },
  { key: 'delete',          test: (t) => /\bdelete\b|\bremove\b/.test(t) },
  { key: 'save',            test: (t) => /\bsave\b/.test(t) },
];

function classify(el: HTMLElement): ActionKey | null {
  const raw = (el.textContent || '').trim().toLowerCase();
  if (!raw || raw.length > 40) return null;
  for (const m of MATCHERS) if (m.test(raw)) return m.key;
  return null;
}

function tagAll(root: ParentNode = document) {
  const btns = root.querySelectorAll<HTMLElement>(
    'button:not([data-action]):not([data-action-skip])'
  );
  btns.forEach((b) => {
    // Skip icon-only / no text buttons
    if (!b.textContent || !b.textContent.trim()) return;
    const key = classify(b);
    if (key) b.setAttribute('data-action', key);
  });
}

let observer: MutationObserver | null = null;

export function startActionButtonTagger() {
  if (typeof document === 'undefined' || observer) return;
  tagAll();
  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((n) => {
        if (n.nodeType === 1) tagAll(n as ParentNode);
      });
      if (m.type === 'characterData' && m.target.parentElement) {
        const btn = (m.target.parentElement.closest('button') as HTMLElement) || null;
        if (btn) {
          btn.removeAttribute('data-action');
          const key = classify(btn);
          if (key) btn.setAttribute('data-action', key);
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

export function stopActionButtonTagger() {
  observer?.disconnect();
  observer = null;
}
