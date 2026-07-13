import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  DesignSettings,
  DEFAULT_DESIGN_SETTINGS,
  applyDesignSettings,
  resetAppliedDesign,
} from '@/lib/designTokens';
import { startActionButtonTagger, stopActionButtonTagger } from '@/lib/actionButton';


const CONFIG_KEY = 'ui_design_settings';

function mergeDeep(base: DesignSettings, override: Partial<DesignSettings> | null | undefined): DesignSettings {
  if (!override) return base;
  const out: any = { ...base };
  for (const k of Object.keys(base) as (keyof DesignSettings)[]) {
    out[k] = { ...(base as any)[k], ...((override as any)[k] ?? {}) };
  }
  return out as DesignSettings;
}

interface Ctx {
  settings: DesignSettings;
  loading: boolean;
  preview: (s: DesignSettings) => void;
  save: (s: DesignSettings) => Promise<void>;
  reset: () => Promise<void>;
}

const DesignSettingsContext = createContext<Ctx | null>(null);

export function DesignSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<DesignSettings>(DEFAULT_DESIGN_SETTINGS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('portal_config')
      .select('config_value')
      .eq('config_key', CONFIG_KEY)
      .maybeSingle();
    const merged = mergeDeep(DEFAULT_DESIGN_SETTINGS, (data?.config_value as any) ?? null);
    setSettings(merged);
    applyDesignSettings(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    startActionButtonTagger();
    const channel = supabase
      .channel('portal_config_design')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'portal_config', filter: `config_key=eq.${CONFIG_KEY}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      stopActionButtonTagger();
    };
  }, [load]);


  const preview = useCallback((s: DesignSettings) => {
    applyDesignSettings(s);
  }, []);

  const save = useCallback(async (s: DesignSettings) => {
    const { error } = await supabase
      .from('portal_config')
      .upsert(
        [{
          config_key: CONFIG_KEY,
          config_value: s as unknown as any,
          description: 'Runtime UI design settings',
        }],
        { onConflict: 'config_key' },
      );
    if (error) throw error;
    setSettings(s);
    applyDesignSettings(s);
  }, []);

  const reset = useCallback(async () => {
    resetAppliedDesign();
    await supabase.from('portal_config').delete().eq('config_key', CONFIG_KEY);
    setSettings(DEFAULT_DESIGN_SETTINGS);
    applyDesignSettings(DEFAULT_DESIGN_SETTINGS);
  }, []);

  const value = useMemo(() => ({ settings, loading, preview, save, reset }), [settings, loading, preview, save, reset]);

  return <DesignSettingsContext.Provider value={value}>{children}</DesignSettingsContext.Provider>;
}

export function useDesignSettings() {
  const ctx = useContext(DesignSettingsContext);
  if (!ctx) throw new Error('useDesignSettings must be used within DesignSettingsProvider');
  return ctx;
}
