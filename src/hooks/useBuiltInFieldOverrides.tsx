import { useMemo } from 'react';
import { useFormFieldConfigs } from '@/hooks/useTenant';
import { BUILTIN_OVERRIDE_MARK, isBuiltInField } from '@/lib/builtInFields';

export interface BuiltInOverride {
  is_visible: boolean;
  is_mandatory?: boolean;
  display_label?: string;
  placeholder?: string;
  help_text?: string;
}

/**
 * Returns a map { [field_name]: override } for the given tenant + built-in
 * step. Vendor step components consult this to decide whether to render a
 * field and whether it should still be required.
 *
 * Only rows tagged with BUILTIN_OVERRIDE_MARK in default_value are treated
 * as overrides (so admin-added custom fields on the same step never affect
 * built-ins by name collision).
 */
export function useBuiltInFieldOverrides(
  tenantId: string | null | undefined,
  stepKey: string,
): Record<string, BuiltInOverride> {
  const { data: configs = [] } = useFormFieldConfigs(tenantId || undefined, stepKey);

  return useMemo(() => {
    const out: Record<string, BuiltInOverride> = {};
    for (const c of configs) {
      if (c.default_value !== BUILTIN_OVERRIDE_MARK) continue;
      if (!isBuiltInField(stepKey, c.field_name)) continue;
      out[c.field_name] = {
        is_visible: c.is_visible !== false,
        is_mandatory: c.is_mandatory,
        display_label: c.display_label,
        placeholder: c.placeholder || undefined,
        help_text: c.help_text || undefined,
      };
    }
    return out;
  }, [configs, stepKey]);
}

/** Convenience: is this built-in field visible right now? */
export function isFieldVisible(
  overrides: Record<string, BuiltInOverride>,
  fieldName: string,
): boolean {
  const o = overrides[fieldName];
  return !o || o.is_visible !== false;
}
