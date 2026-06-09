import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export interface ThemePalette {
  key: string;
  label: string;
  primary: string; // HSL triplet "H S% L%"
  accent: string;
  swatch: string; // hex for the picker dot
  accentSwatch: string;
}

export const THEME_PALETTES: ThemePalette[] = [
  { key: 'brand',   label: 'Sharvi Brand',  primary: '24 82% 50%',   accent: '137 100% 32%', swatch: '#e87717', accentSwatch: '#00a13a' },
  { key: 'blue',    label: 'Classic Blue',  primary: '210 100% 40%', accent: '187 85% 43%',  swatch: '#0066cc', accentSwatch: '#14b8c4' },
  { key: 'indigo',  label: 'Indigo',        primary: '239 84% 56%',  accent: '262 83% 58%',  swatch: '#4f46e5', accentSwatch: '#8b5cf6' },
  { key: 'emerald', label: 'Emerald',       primary: '160 84% 32%',  accent: '173 80% 40%',  swatch: '#0d9668', accentSwatch: '#14b8a6' },
  { key: 'rose',    label: 'Rose',          primary: '347 77% 50%',  accent: '24 95% 53%',   swatch: '#e11d48', accentSwatch: '#f97316' },
  { key: 'slate',   label: 'Slate',         primary: '215 28% 25%',  accent: '199 89% 48%',  swatch: '#334155', accentSwatch: '#0ea5e9' },
];

const STORAGE_KEY = 'portal-theme-color';
const DEFAULT_KEY = 'brand';

function applyPalette(p: ThemePalette) {
  const root = document.documentElement;
  root.style.setProperty('--primary', p.primary);
  root.style.setProperty('--ring', p.primary);
  root.style.setProperty('--sidebar-primary', p.primary);
  root.style.setProperty('--sidebar-ring', p.primary);
  root.style.setProperty('--accent', p.accent);
}

interface Ctx {
  current: ThemePalette;
  setColor: (key: string) => void;
  palettes: ThemePalette[];
}

const ThemeColorContext = createContext<Ctx | null>(null);

// Apply saved theme synchronously before first paint
const initialKey = (() => {
  if (typeof window === 'undefined') return DEFAULT_KEY;
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_KEY;
  } catch {
    return DEFAULT_KEY;
  }
})();
const initialPalette = THEME_PALETTES.find(p => p.key === initialKey) || THEME_PALETTES[0];
if (typeof document !== 'undefined') applyPalette(initialPalette);

export function ThemeColorProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ThemePalette>(initialPalette);

  useEffect(() => {
    applyPalette(current);
    try { localStorage.setItem(STORAGE_KEY, current.key); } catch {}
  }, [current]);

  const setColor = (key: string) => {
    const p = THEME_PALETTES.find(x => x.key === key);
    if (p) setCurrent(p);
  };

  return (
    <ThemeColorContext.Provider value={{ current, setColor, palettes: THEME_PALETTES }}>
      {children}
    </ThemeColorContext.Provider>
  );
}

export function useThemeColor() {
  const ctx = useContext(ThemeColorContext);
  if (!ctx) throw new Error('useThemeColor must be used within ThemeColorProvider');
  return ctx;
}
