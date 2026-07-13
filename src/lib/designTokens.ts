// Design tokens for runtime UI configuration.
// Stored as JSON in portal_config.ui_design_settings and applied to :root as CSS variables.
import { ensureFontLoaded } from './googleFonts';

export interface DesignSettings {
  theme: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    background: string;
    fontFamily: string;
  };
  typography: {
    fontFamily: string;
    baseFontSize: string;      // e.g. "14px"
    headingFontSize: string;   // e.g. "24px"
    screenNameFontSize: string;// e.g. "18px"
    fontWeight: string;        // e.g. "400"
    screenNameFontWeight: string; // e.g. "600"
    fontColor: string;         // hex
    lineHeight: string;        // e.g. "1.5"
    letterSpacing: string;         // e.g. "normal", "0.01em"
    headingLetterSpacing: string;  // e.g. "-0.01em"
  };

  sidebar: {
    background: string;
    text: string;
    active: string;
    hover: string;
    icon: string;
    width: string;             // e.g. "256px"
  };
  buttons: {
    background: string;
    text: string;
    border: string;
    borderRadius: string;      // e.g. "8px"
    fontSize: string;
    hover: string;
    disabled: string;
    letterSpacing: string;
  };
  forms: {
    inputFontSize: string;
    inputTextColor: string;
    placeholderColor: string;
    borderColor: string;
    borderRadius: string;
    focusBorderColor: string;
    labelFontSize: string;
    labelColor: string;
    inputLetterSpacing: string;
    labelLetterSpacing: string;
  };
  tables: {
    headerBg: string;
    headerText: string;
    rowText: string;
    altRow: string;
    borderColor: string;
    fontSize: string;
    letterSpacing: string;
  };


  cards: {
    background: string;
    header: string;
    border: string;
    borderRadius: string;
    shadow: 'none' | 'sm' | 'md' | 'lg';
  };
}

export const DEFAULT_DESIGN_SETTINGS: DesignSettings = {
  theme: {
    primary: '#1f9d6a',
    secondary: '#e5eaef',
    success: '#1f9d6a',
    warning: '#f59e0b',
    error: '#dc2626',
    background: '#f6f8fa',
    fontFamily: 'Inter',
  },
  typography: {
    fontFamily: 'Inter',
    baseFontSize: '14px',
    headingFontSize: '24px',
    screenNameFontSize: '18px',
    fontWeight: '400',
    screenNameFontWeight: '600',
    fontColor: '#1f2a37',
    lineHeight: '1.5',
    letterSpacing: '0.01em',
    headingLetterSpacing: '-0.01em',
  },
  sidebar: {
    background: '#16262d',
    text: '#d1dbde',
    active: '#233a46',
    hover: '#1c2f38',
    icon: '#23c4b5',
    width: '256px',
  },
  buttons: {
    background: '#1f9d6a',
    text: '#ffffff',
    border: '#1f9d6a',
    borderRadius: '8px',
    fontSize: '14px',
    hover: '#178857',
    disabled: '#9ca3af',
    letterSpacing: '0.02em',
  },
  forms: {
    inputFontSize: '14px',
    inputTextColor: '#1f2a37',
    placeholderColor: '#9ca3af',
    borderColor: '#d5dbe1',
    borderRadius: '8px',
    focusBorderColor: '#1f9d6a',
    labelFontSize: '13px',
    labelColor: '#374151',
    inputLetterSpacing: '0.01em',
    labelLetterSpacing: '0.02em',
  },
  tables: {
    headerBg: '#f3f6f8',
    headerText: '#374151',
    rowText: '#1f2a37',
    altRow: '#f9fafb',
    borderColor: '#e5e7eb',
    fontSize: '14px',
    letterSpacing: '0.01em',
  },

  cards: {
    background: '#ffffff',
    header: '#111827',
    border: '#e5e7eb',
    borderRadius: '12px',
    shadow: 'sm',
  },
};

// hex → "H S% L%" (space separated, no hsl())
export function hexToHslTriplet(hex: string): string {
  const h = hex.replace('#', '').trim();
  if (h.length !== 3 && h.length !== 6) return '0 0% 0%';
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let hh = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hh = (g - b) / d + (g < b ? 6 : 0); break;
      case g: hh = (b - r) / d + 2; break;
      case b: hh = (r - g) / d + 4; break;
    }
    hh *= 60;
  }
  return `${Math.round(hh)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const SHADOWS: Record<DesignSettings['cards']['shadow'], string> = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 10px -2px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
  lg: '0 12px 24px -6px rgb(0 0 0 / 0.08), 0 4px 8px -4px rgb(0 0 0 / 0.05)',
};

export function applyDesignSettings(s: DesignSettings) {
  if (typeof document === 'undefined') return;
  const r = document.documentElement.style;

  // Global theme → semantic tokens (HSL triplets to align with index.css)
  r.setProperty('--primary', hexToHslTriplet(s.theme.primary));
  r.setProperty('--ring', hexToHslTriplet(s.theme.primary));
  r.setProperty('--secondary', hexToHslTriplet(s.theme.secondary));
  r.setProperty('--success', hexToHslTriplet(s.theme.success));
  r.setProperty('--warning', hexToHslTriplet(s.theme.warning));
  r.setProperty('--destructive', hexToHslTriplet(s.theme.error));
  r.setProperty('--background', hexToHslTriplet(s.theme.background));

  // Typography — load web fonts on demand
  ensureFontLoaded(s.typography.fontFamily);
  ensureFontLoaded(s.theme.fontFamily);
  r.setProperty('--font-sans', `"${s.typography.fontFamily}", "Inter", system-ui, sans-serif`);
  r.setProperty('--font-base-size', s.typography.baseFontSize);
  r.setProperty('--heading-size', s.typography.headingFontSize);
  r.setProperty('--screen-name-size', s.typography.screenNameFontSize);
  r.setProperty('--font-weight-base', s.typography.fontWeight);
  r.setProperty('--screen-name-weight', s.typography.screenNameFontWeight);
  r.setProperty('--foreground', hexToHslTriplet(s.typography.fontColor));
  r.setProperty('--line-height-base', s.typography.lineHeight);
  r.setProperty('--letter-spacing', s.typography.letterSpacing || 'normal');
  r.setProperty('--heading-letter-spacing', s.typography.headingLetterSpacing || 'normal');


  // Sidebar
  r.setProperty('--sidebar-background', hexToHslTriplet(s.sidebar.background));
  r.setProperty('--sidebar-foreground', hexToHslTriplet(s.sidebar.text));
  r.setProperty('--sidebar-accent', hexToHslTriplet(s.sidebar.active));
  r.setProperty('--sidebar-hover', hexToHslTriplet(s.sidebar.hover));
  r.setProperty('--sidebar-primary', hexToHslTriplet(s.sidebar.icon));
  r.setProperty('--sidebar-width', s.sidebar.width);

  // Buttons
  r.setProperty('--btn-bg', s.buttons.background);
  r.setProperty('--btn-text', s.buttons.text);
  r.setProperty('--btn-border', s.buttons.border);
  r.setProperty('--btn-radius', s.buttons.borderRadius);
  r.setProperty('--btn-font-size', s.buttons.fontSize);
  r.setProperty('--btn-hover', s.buttons.hover);
  r.setProperty('--btn-disabled', s.buttons.disabled);

  // Forms
  r.setProperty('--input-font-size', s.forms.inputFontSize);
  r.setProperty('--input-text', s.forms.inputTextColor);
  r.setProperty('--input-placeholder', s.forms.placeholderColor);
  r.setProperty('--input', hexToHslTriplet(s.forms.borderColor));
  r.setProperty('--input-radius', s.forms.borderRadius);
  r.setProperty('--input-focus', s.forms.focusBorderColor);
  r.setProperty('--label-font-size', s.forms.labelFontSize);
  r.setProperty('--label-color', s.forms.labelColor);

  // Tables
  r.setProperty('--table-header-bg', s.tables.headerBg);
  r.setProperty('--table-header-text', s.tables.headerText);
  r.setProperty('--table-row-text', s.tables.rowText);
  r.setProperty('--table-alt-row', s.tables.altRow);
  r.setProperty('--table-border', s.tables.borderColor);
  r.setProperty('--table-font-size', s.tables.fontSize);

  // Cards
  r.setProperty('--card', hexToHslTriplet(s.cards.background));
  r.setProperty('--card-header-color', s.cards.header);
  r.setProperty('--border', hexToHslTriplet(s.cards.border));
  r.setProperty('--radius', s.cards.borderRadius);
  r.setProperty('--card-shadow', SHADOWS[s.cards.shadow]);
}

export function resetAppliedDesign() {
  if (typeof document === 'undefined') return;
  const props = [
    '--primary','--ring','--secondary','--success','--warning','--destructive','--background',
    '--font-sans','--font-base-size','--heading-size','--screen-name-size','--font-weight-base',
    '--screen-name-weight','--foreground','--line-height-base',
    '--sidebar-background','--sidebar-foreground','--sidebar-accent','--sidebar-hover','--sidebar-primary','--sidebar-width',
    '--btn-bg','--btn-text','--btn-border','--btn-radius','--btn-font-size','--btn-hover','--btn-disabled',
    '--input-font-size','--input-text','--input-placeholder','--input','--input-radius','--input-focus','--label-font-size','--label-color',
    '--table-header-bg','--table-header-text','--table-row-text','--table-alt-row','--table-border','--table-font-size',
    '--card','--card-header-color','--border','--radius','--card-shadow',
  ];
  const s = document.documentElement.style;
  props.forEach((p) => s.removeProperty(p));
}
