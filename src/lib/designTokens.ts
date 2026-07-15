// Design tokens for runtime UI configuration.
// Stored as JSON in portal_config.ui_design_settings and applied to :root as CSS variables.
import { ensureFontLoaded } from './googleFonts';
import { ACTION_KEYS, type ActionKey } from './actionButton';

export interface ActionButtonStyle {
  background: string;
  text: string;
  border: string;
  borderRadius: string;
  fontSize: string;
  hover: string;
  hoverText: string;
  hoverBorder: string;
}

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
    baseFontSize: string;
    headingFontSize: string;
    screenNameFontSize: string;
    fontWeight: string;
    screenNameFontWeight: string;
    fontColor: string;
    lineHeight: string;
    letterSpacing: string;
    headingLetterSpacing: string;
  };

  sidebar: {
    background: string;
    text: string;
    active: string;         // selected menu background
    selectedBorder: string; // selected menu left border
    selectedText: string;   // selected menu text color
    hover: string;
    icon: string;
    width: string;
    fontSize: string;
    fontWeight: string;
  };
  buttons: {
    background: string;
    text: string;
    border: string;
    borderRadius: string;
    fontSize: string;
    hover: string;
    hoverText: string;
    hoverBorder: string;
    disabled: string;
    letterSpacing: string;
  };
  actionButtons: Record<ActionKey, ActionButtonStyle>;
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
    headerFontSize: string;
    headerFontWeight: string;
    bodyFontSize: string;
    bodyFontWeight: string;
  };


  cards: {
    background: string;
    header: string;
    border: string;
    borderRadius: string;
    shadow: 'none' | 'sm' | 'md' | 'lg';
    headerFontSize: string;
    headerFontWeight: string;
    bodyFontSize: string;
    bodyFontWeight: string;
    headerBackground: string;
    bodyTextColor: string;
    paddingTop: string;
    paddingRight: string;
    paddingBottom: string;
    paddingLeft: string;
    headerPaddingTop: string;
    headerPaddingRight: string;
    headerPaddingBottom: string;
    headerPaddingLeft: string;
    marginTop: string;
    marginRight: string;
    marginBottom: string;
    marginLeft: string;
  };
  screen: {
    paddingTop: string;
    paddingRight: string;
    paddingBottom: string;
    paddingLeft: string;
    marginTop: string;
    marginRight: string;
    marginBottom: string;
    marginLeft: string;
    headerFontSize: string;
    headerFontWeight: string;
    headerColor: string;
    headerMarginBottom: string;
  };
}

// Palette used for action-button defaults — mirrors current app colors.
const PRIMARY = '#1f9d6a';
const PRIMARY_HOVER = '#178857';
const DESTRUCTIVE = '#dc2626';
const DESTRUCTIVE_HOVER = '#b91c1c';
const INFO = '#2f80ed';
const INFO_HOVER = '#1e6fd9';
const NEUTRAL = '#6b7280';
const NEUTRAL_HOVER = '#4b5563';
const ACCENT = '#0ea5e9';
const ACCENT_HOVER = '#0284c7';
const WHITE = '#ffffff';

const filled = (bg: string, hover: string): ActionButtonStyle => ({
  background: bg, text: WHITE, border: bg,
  borderRadius: '8px', fontSize: '14px', hover,
  hoverText: WHITE, hoverBorder: hover,
});
const outline = (color: string, hover: string): ActionButtonStyle => ({
  background: WHITE, text: color, border: color,
  borderRadius: '8px', fontSize: '14px', hover,
  hoverText: color, hoverBorder: color,
});

const DEFAULT_ACTION_BUTTONS: Record<ActionKey, ActionButtonStyle> = {
  approve:            filled(PRIMARY, PRIMARY_HOVER),
  'approve-forward':  filled(PRIMARY, PRIMARY_HOVER),
  reject:             filled(DESTRUCTIVE, DESTRUCTIVE_HOVER),
  preview:            outline(INFO, '#eff6ff'),
  'view-details':     outline(INFO, '#eff6ff'),
  'add-config':       filled(PRIMARY, PRIMARY_HOVER),
  save:               filled(PRIMARY, PRIMARY_HOVER),
  update:             filled(PRIMARY, PRIMARY_HOVER),
  create:             filled(PRIMARY, PRIMARY_HOVER),
  search:             filled(INFO, INFO_HOVER),
  reset:              outline(NEUTRAL, '#f3f4f6'),
  'export-excel':     outline('#217346', '#e7f3ec'),
  'export-pdf':       outline('#c1272d', '#fdecec'),
  'export-csv':       outline(INFO, '#eff6ff'),
  cancel:             outline(NEUTRAL, '#f3f4f6'),
  clear:              outline(DESTRUCTIVE, '#fef2f2'),
  sync:               filled(INFO, INFO_HOVER),
  'duplicate-close':  filled(NEUTRAL, NEUTRAL_HOVER),
  'send-vendor':      filled(ACCENT, ACCENT_HOVER),
  submit:             filled(PRIMARY, PRIMARY_HOVER),
  delete:             filled(DESTRUCTIVE, DESTRUCTIVE_HOVER),
  invite:             filled(ACCENT, ACCENT_HOVER),
};

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
    selectedBorder: '#23c4b5',
    selectedText: '#ffffff',
    hover: '#1c2f38',
    icon: '#23c4b5',
    width: '256px',
    fontSize: '14px',
    fontWeight: '500',
  },
  buttons: {
    background: '#1f9d6a',
    text: '#ffffff',
    border: '#1f9d6a',
    borderRadius: '8px',
    fontSize: '14px',
    hover: '#178857',
    hoverText: '#ffffff',
    hoverBorder: '#178857',
    disabled: '#9ca3af',
    letterSpacing: '0.02em',
  },
  actionButtons: DEFAULT_ACTION_BUTTONS,
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
    headerFontSize: '13px',
    headerFontWeight: '600',
    bodyFontSize: '14px',
    bodyFontWeight: '400',
  },

  cards: {
    background: '#ffffff',
    header: '#111827',
    border: '#e5e7eb',
    borderRadius: '12px',
    shadow: 'sm',
    headerFontSize: '16px',
    headerFontWeight: '600',
    bodyFontSize: '14px',
    bodyFontWeight: '400',
    headerBackground: 'transparent',
    bodyTextColor: '#1f2a37',
    paddingTop: '24px',
    paddingRight: '24px',
    paddingBottom: '24px',
    paddingLeft: '24px',
    headerPaddingTop: '20px',
    headerPaddingRight: '24px',
    headerPaddingBottom: '12px',
    headerPaddingLeft: '24px',
    marginTop: '0px',
    marginRight: '0px',
    marginBottom: '16px',
    marginLeft: '0px',
  },
  screen: {
    paddingTop: '20px',
    paddingRight: '24px',
    paddingBottom: '20px',
    paddingLeft: '24px',
    marginTop: '0px',
    marginRight: '0px',
    marginBottom: '0px',
    marginLeft: '0px',
    headerFontSize: '20px',
    headerFontWeight: '600',
    headerColor: '#111827',
    headerMarginBottom: '16px',
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

  r.setProperty('--primary', hexToHslTriplet(s.theme.primary));
  r.setProperty('--ring', hexToHslTriplet(s.theme.primary));
  r.setProperty('--secondary', hexToHslTriplet(s.theme.secondary));
  r.setProperty('--success', hexToHslTriplet(s.theme.success));
  r.setProperty('--warning', hexToHslTriplet(s.theme.warning));
  r.setProperty('--destructive', hexToHslTriplet(s.theme.error));
  r.setProperty('--background', hexToHslTriplet(s.theme.background));

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
  r.setProperty('--sidebar-accent-foreground', hexToHslTriplet(s.sidebar.selectedText));
  r.setProperty('--sidebar-selected-border', s.sidebar.selectedBorder);
  r.setProperty('--sidebar-hover', hexToHslTriplet(s.sidebar.hover));
  r.setProperty('--sidebar-primary', hexToHslTriplet(s.sidebar.icon));
  r.setProperty('--sidebar-width', s.sidebar.width);
  r.setProperty('--sidebar-font-size', s.sidebar.fontSize || '14px');
  r.setProperty('--sidebar-font-weight', s.sidebar.fontWeight || '500');

  // Buttons (global fallback)
  r.setProperty('--btn-bg', s.buttons.background);
  r.setProperty('--btn-text', s.buttons.text);
  r.setProperty('--btn-border', s.buttons.border);
  r.setProperty('--btn-radius', s.buttons.borderRadius);
  r.setProperty('--btn-font-size', s.buttons.fontSize);
  r.setProperty('--btn-hover', s.buttons.hover);
  r.setProperty('--btn-hover-text', s.buttons.hoverText || s.buttons.text);
  r.setProperty('--btn-hover-border', s.buttons.hoverBorder || s.buttons.hover);
  r.setProperty('--btn-disabled', s.buttons.disabled);
  r.setProperty('--btn-letter-spacing', s.buttons.letterSpacing || 'normal');

  // Per-action buttons
  for (const key of ACTION_KEYS) {
    const a = s.actionButtons?.[key] ?? DEFAULT_ACTION_BUTTONS[key];
    if (!a) continue;
    r.setProperty(`--btn-${key}-bg`, a.background);
    r.setProperty(`--btn-${key}-text`, a.text);
    r.setProperty(`--btn-${key}-border`, a.border);
    r.setProperty(`--btn-${key}-radius`, a.borderRadius);
    r.setProperty(`--btn-${key}-font-size`, a.fontSize);
    r.setProperty(`--btn-${key}-hover`, a.hover);
    r.setProperty(`--btn-${key}-hover-text`, a.hoverText || a.text);
    r.setProperty(`--btn-${key}-hover-border`, a.hoverBorder || a.hover);
  }


  // Forms
  r.setProperty('--input-font-size', s.forms.inputFontSize);
  r.setProperty('--input-text', s.forms.inputTextColor);
  r.setProperty('--input-placeholder', s.forms.placeholderColor);
  r.setProperty('--input', hexToHslTriplet(s.forms.borderColor));
  r.setProperty('--input-radius', s.forms.borderRadius);
  r.setProperty('--input-focus', s.forms.focusBorderColor);
  r.setProperty('--label-font-size', s.forms.labelFontSize);
  r.setProperty('--label-color', s.forms.labelColor);
  r.setProperty('--input-letter-spacing', s.forms.inputLetterSpacing || 'normal');
  r.setProperty('--label-letter-spacing', s.forms.labelLetterSpacing || 'normal');


  // Tables
  r.setProperty('--table-header-bg', s.tables.headerBg);
  r.setProperty('--table-header-text', s.tables.headerText);
  r.setProperty('--table-row-text', s.tables.rowText);
  r.setProperty('--table-alt-row', s.tables.altRow);
  r.setProperty('--table-border', s.tables.borderColor);
  r.setProperty('--table-font-size', s.tables.fontSize);
  r.setProperty('--table-letter-spacing', s.tables.letterSpacing || 'normal');
  r.setProperty('--table-header-size', s.tables.headerFontSize || s.tables.fontSize);
  r.setProperty('--table-header-weight', s.tables.headerFontWeight || '600');
  r.setProperty('--table-body-size', s.tables.bodyFontSize || s.tables.fontSize);
  r.setProperty('--table-body-weight', s.tables.bodyFontWeight || '400');


  // Cards
  r.setProperty('--card', hexToHslTriplet(s.cards.background));
  r.setProperty('--card-header-color', s.cards.header);
  r.setProperty('--border', hexToHslTriplet(s.cards.border));
  r.setProperty('--radius', s.cards.borderRadius);
  r.setProperty('--card-shadow', SHADOWS[s.cards.shadow]);
  r.setProperty('--card-header-size', s.cards.headerFontSize || '16px');
  r.setProperty('--card-header-weight', s.cards.headerFontWeight || '600');
  r.setProperty('--card-body-size', s.cards.bodyFontSize || '14px');
  r.setProperty('--card-body-weight', s.cards.bodyFontWeight || '400');
  r.setProperty('--card-header-bg', s.cards.headerBackground || 'transparent');
  r.setProperty('--card-body-color', s.cards.bodyTextColor || 'inherit');
  r.setProperty('--card-pad-t', s.cards.paddingTop || '24px');
  r.setProperty('--card-pad-r', s.cards.paddingRight || '24px');
  r.setProperty('--card-pad-b', s.cards.paddingBottom || '24px');
  r.setProperty('--card-pad-l', s.cards.paddingLeft || '24px');
  r.setProperty('--card-header-pad-t', s.cards.headerPaddingTop || '20px');
  r.setProperty('--card-header-pad-r', s.cards.headerPaddingRight || '24px');
  r.setProperty('--card-header-pad-b', s.cards.headerPaddingBottom || '12px');
  r.setProperty('--card-header-pad-l', s.cards.headerPaddingLeft || '24px');
  r.setProperty('--card-mar-t', s.cards.marginTop || '0px');
  r.setProperty('--card-mar-r', s.cards.marginRight || '0px');
  r.setProperty('--card-mar-b', s.cards.marginBottom || '16px');
  r.setProperty('--card-mar-l', s.cards.marginLeft || '0px');

  // Screen (page container)
  r.setProperty('--screen-pad-t', s.screen?.paddingTop || '20px');
  r.setProperty('--screen-pad-r', s.screen?.paddingRight || '24px');
  r.setProperty('--screen-pad-b', s.screen?.paddingBottom || '20px');
  r.setProperty('--screen-pad-l', s.screen?.paddingLeft || '24px');
  r.setProperty('--screen-mar-t', s.screen?.marginTop || '0px');
  r.setProperty('--screen-mar-r', s.screen?.marginRight || '0px');
  r.setProperty('--screen-mar-b', s.screen?.marginBottom || '0px');
  r.setProperty('--screen-mar-l', s.screen?.marginLeft || '0px');
  r.setProperty('--screen-title-size', s.screen?.headerFontSize || '20px');
  r.setProperty('--screen-title-weight', s.screen?.headerFontWeight || '600');
  r.setProperty('--screen-title-color', s.screen?.headerColor || '#111827');
  r.setProperty('--screen-title-mb', s.screen?.headerMarginBottom || '16px');
}

export function resetAppliedDesign() {
  if (typeof document === 'undefined') return;
  const base = [
    '--primary','--ring','--secondary','--success','--warning','--destructive','--background',
    '--font-sans','--font-base-size','--heading-size','--screen-name-size','--font-weight-base',
    '--screen-name-weight','--foreground','--line-height-base','--letter-spacing','--heading-letter-spacing',
    '--sidebar-background','--sidebar-foreground','--sidebar-accent','--sidebar-accent-foreground','--sidebar-selected-border','--sidebar-hover','--sidebar-primary','--sidebar-width','--sidebar-font-size','--sidebar-font-weight',
    '--btn-bg','--btn-text','--btn-border','--btn-radius','--btn-font-size','--btn-hover','--btn-hover-text','--btn-hover-border','--btn-disabled','--btn-letter-spacing',
    '--input-font-size','--input-text','--input-placeholder','--input','--input-radius','--input-focus','--label-font-size','--label-color','--input-letter-spacing','--label-letter-spacing',
    '--table-header-bg','--table-header-text','--table-row-text','--table-alt-row','--table-border','--table-font-size','--table-letter-spacing','--table-header-size','--table-header-weight','--table-body-size','--table-body-weight',
    '--card','--card-header-color','--border','--radius','--card-shadow','--card-header-size','--card-header-weight','--card-body-size','--card-body-weight',
  ];
  const perAction: string[] = [];
  for (const k of ACTION_KEYS) {
    perAction.push(
      `--btn-${k}-bg`, `--btn-${k}-text`, `--btn-${k}-border`,
      `--btn-${k}-radius`, `--btn-${k}-font-size`, `--btn-${k}-hover`,
      `--btn-${k}-hover-text`, `--btn-${k}-hover-border`,
    );
  }
  const s = document.documentElement.style;
  [...base, ...perAction].forEach((p) => s.removeProperty(p));
}
