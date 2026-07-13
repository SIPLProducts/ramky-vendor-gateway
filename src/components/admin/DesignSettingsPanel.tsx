import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useDesignSettings } from '@/hooks/useDesignSettings';
import { DEFAULT_DESIGN_SETTINGS, DesignSettings } from '@/lib/designTokens';
import { ensureFontLoaded } from '@/lib/googleFonts';
import {
  Palette, Type, PanelLeft, MousePointer2, FormInput, Table2, LayoutGrid,
  Save, RotateCcw, AlertCircle,
} from 'lucide-react';

const FONT_GROUPS: { label: string; fonts: string[] }[] = [
  {
    label: 'System',
    fonts: ['System', 'Arial', 'Helvetica', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Segoe UI'],
  },
  {
    label: 'Serif',
    fonts: [
      'Times New Roman', 'Georgia', 'Cambria', 'Garamond', 'Palatino', 'Book Antiqua', 'Baskerville',
      'Merriweather', 'Playfair Display', 'Lora', 'PT Serif', 'Source Serif Pro', 'Cormorant Garamond',
      'Crimson Text', 'Libre Baskerville', 'EB Garamond', 'Bitter', 'Noto Serif',
    ],
  },
  {
    label: 'Sans-serif',
    fonts: [
      'Inter', 'Roboto', 'Open Sans', 'Poppins', 'Lato', 'Nunito', 'Montserrat', 'Raleway',
      'Ubuntu', 'Work Sans', 'Rubik', 'Mulish', 'Manrope', 'DM Sans', 'Karla', 'Barlow',
      'IBM Plex Sans', 'Source Sans Pro', 'PT Sans', 'Fira Sans', 'Noto Sans', 'Quicksand',
      'Cabin', 'Titillium Web', 'Hind', 'Oxygen', 'Heebo', 'Assistant', 'Public Sans',
    ],
  },
  {
    label: 'Display',
    fonts: ['Oswald', 'Bebas Neue', 'Anton', 'Righteous', 'Pacifico', 'Lobster', 'Comfortaa', 'Archivo Black'],
  },
  {
    label: 'Monospace',
    fonts: ['Courier New', 'Consolas', 'Monaco', 'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'IBM Plex Mono', 'Roboto Mono', 'Space Mono'],
  },
];

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-input bg-transparent p-0.5"
          aria-label={label}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 font-mono text-xs uppercase"
          maxLength={7}
        />
      </div>
    </div>
  );
}

function TextInputField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9" placeholder={placeholder} />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function FontSelectField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Select
        value={value}
        onValueChange={(v) => { ensureFontLoaded(v); onChange(v); }}
      >
        <SelectTrigger className="h-9" style={{ fontFamily: `"${value}", system-ui, sans-serif` }}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-80">
          {FONT_GROUPS.map((g) => (
            <SelectGroup key={g.label}>
              <SelectLabel>{g.label}</SelectLabel>
              {g.fonts.map((f) => (
                <SelectItem
                  key={f}
                  value={f}
                  style={{ fontFamily: `"${f}", system-ui, sans-serif` }}
                  onMouseEnter={() => ensureFontLoaded(f)}
                >
                  {f}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <Card className="border-l-4 border-l-success">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-success" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

export function DesignSettingsPanel() {
  const { settings, save, reset, preview, loading } = useDesignSettings();
  const { toast } = useToast();
  const [draft, setDraft] = useState<DesignSettings>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(settings); }, [settings]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  const update = <G extends keyof DesignSettings, K extends keyof DesignSettings[G]>(
    group: G, key: K, value: DesignSettings[G][K],
  ) => {
    const next = { ...draft, [group]: { ...draft[group], [key]: value } };
    setDraft(next);
    preview(next);
  };

  const onSave = async () => {
    try {
      setSaving(true);
      await save(draft);
      toast({ title: 'Design settings saved', description: 'Applied across the application.' });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e?.message ?? String(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const onReset = async () => {
    try {
      setSaving(true);
      await reset();
      setDraft(DEFAULT_DESIGN_SETTINGS);
      toast({ title: 'Reset to defaults', description: 'UI design restored.' });
    } catch (e: any) {
      toast({ title: 'Reset failed', description: e?.message ?? String(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading design settings…</div>;

  const shadowOptions = [
    { value: 'none', label: 'None' }, { value: 'sm', label: 'Small' },
    { value: 'md', label: 'Medium' }, { value: 'lg', label: 'Large' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">UI Design Settings</h2>
          <p className="text-sm text-muted-foreground">Configure the application's appearance. Changes apply instantly on save.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onReset} disabled={saving}>
            <RotateCcw className="h-4 w-4 mr-2" />Reset to Defaults
          </Button>
          <Button onClick={onSave} disabled={saving || !dirty}>
            <Save className="h-4 w-4 mr-2" />{saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {dirty && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Unsaved changes are being previewed. Click "Save Changes" to persist them.</AlertDescription>
        </Alert>
      )}

      <SectionCard title="Global Theme" icon={Palette}>
        <ColorInput label="Primary Color"    value={draft.theme.primary}    onChange={(v) => update('theme','primary',v)} />
        <ColorInput label="Secondary Color"  value={draft.theme.secondary}  onChange={(v) => update('theme','secondary',v)} />
        <ColorInput label="Success Color"    value={draft.theme.success}    onChange={(v) => update('theme','success',v)} />
        <ColorInput label="Warning Color"    value={draft.theme.warning}    onChange={(v) => update('theme','warning',v)} />
        <ColorInput label="Error Color"      value={draft.theme.error}      onChange={(v) => update('theme','error',v)} />
        <ColorInput label="Background Color" value={draft.theme.background} onChange={(v) => update('theme','background',v)} />
        <FontSelectField label="Page Font"       value={draft.theme.fontFamily} onChange={(v) => update('theme','fontFamily',v)} />
      </SectionCard>

      <SectionCard title="Typography" icon={Type}>
        <FontSelectField label="Font Family"           value={draft.typography.fontFamily} onChange={(v) => update('typography','fontFamily',v)} />
        <TextInputField label="Base Font Size"     value={draft.typography.baseFontSize} onChange={(v) => update('typography','baseFontSize',v)} placeholder="14px" />
        <TextInputField label="Heading Font Size"  value={draft.typography.headingFontSize} onChange={(v) => update('typography','headingFontSize',v)} placeholder="24px" />
        <TextInputField label="Screen Name Size"   value={draft.typography.screenNameFontSize} onChange={(v) => update('typography','screenNameFontSize',v)} placeholder="18px" />
        <SelectField label="Font Weight"           value={draft.typography.fontWeight} onChange={(v) => update('typography','fontWeight',v)} options={['300','400','500','600','700'].map(v => ({ value: v, label: v }))} />
        <SelectField label="Screen Name Weight"    value={draft.typography.screenNameFontWeight} onChange={(v) => update('typography','screenNameFontWeight',v)} options={['400','500','600','700','800'].map(v => ({ value: v, label: v }))} />
        <ColorInput label="Font Color"             value={draft.typography.fontColor} onChange={(v) => update('typography','fontColor',v)} />
        <TextInputField label="Line Height"        value={draft.typography.lineHeight} onChange={(v) => update('typography','lineHeight',v)} placeholder="1.5" />
        <TextInputField label="Letter Spacing"     value={draft.typography.letterSpacing} onChange={(v) => update('typography','letterSpacing',v)} placeholder="0.01em, normal, 0.5px" />
        <TextInputField label="Heading Letter Spacing" value={draft.typography.headingLetterSpacing} onChange={(v) => update('typography','headingLetterSpacing',v)} placeholder="-0.01em" />

      </SectionCard>

      <SectionCard title="Sidebar" icon={PanelLeft}>
        <ColorInput label="Background Color"  value={draft.sidebar.background} onChange={(v) => update('sidebar','background',v)} />
        <ColorInput label="Text Color"        value={draft.sidebar.text}       onChange={(v) => update('sidebar','text',v)} />
        <ColorInput label="Active Menu Color" value={draft.sidebar.active}     onChange={(v) => update('sidebar','active',v)} />
        <ColorInput label="Hover Color"       value={draft.sidebar.hover}      onChange={(v) => update('sidebar','hover',v)} />
        <ColorInput label="Icon Color"        value={draft.sidebar.icon}       onChange={(v) => update('sidebar','icon',v)} />
        <TextInputField label="Sidebar Width" value={draft.sidebar.width}      onChange={(v) => update('sidebar','width',v)} placeholder="256px" />
      </SectionCard>

      <SectionCard title="Buttons" icon={MousePointer2}>
        <ColorInput label="Background Color"     value={draft.buttons.background}   onChange={(v) => update('buttons','background',v)} />
        <ColorInput label="Text Color"           value={draft.buttons.text}         onChange={(v) => update('buttons','text',v)} />
        <ColorInput label="Border Color"         value={draft.buttons.border}       onChange={(v) => update('buttons','border',v)} />
        <TextInputField label="Border Radius"    value={draft.buttons.borderRadius} onChange={(v) => update('buttons','borderRadius',v)} placeholder="8px" />
        <TextInputField label="Font Size"        value={draft.buttons.fontSize}     onChange={(v) => update('buttons','fontSize',v)} placeholder="14px" />
        <ColorInput label="Hover Color"          value={draft.buttons.hover}        onChange={(v) => update('buttons','hover',v)} />
        <ColorInput label="Disabled State Color" value={draft.buttons.disabled}     onChange={(v) => update('buttons','disabled',v)} />
        <TextInputField label="Letter Spacing"   value={draft.buttons.letterSpacing} onChange={(v) => update('buttons','letterSpacing',v)} placeholder="0.02em" />

      </SectionCard>

      <SectionCard title="Forms" icon={FormInput}>
        <TextInputField label="Input Font Size"   value={draft.forms.inputFontSize}    onChange={(v) => update('forms','inputFontSize',v)} placeholder="14px" />
        <ColorInput label="Input Text Color"      value={draft.forms.inputTextColor}   onChange={(v) => update('forms','inputTextColor',v)} />
        <ColorInput label="Placeholder Color"     value={draft.forms.placeholderColor} onChange={(v) => update('forms','placeholderColor',v)} />
        <ColorInput label="Border Color"          value={draft.forms.borderColor}      onChange={(v) => update('forms','borderColor',v)} />
        <TextInputField label="Border Radius"     value={draft.forms.borderRadius}     onChange={(v) => update('forms','borderRadius',v)} placeholder="8px" />
        <ColorInput label="Focus Border Color"    value={draft.forms.focusBorderColor} onChange={(v) => update('forms','focusBorderColor',v)} />
        <TextInputField label="Label Font Size"   value={draft.forms.labelFontSize}    onChange={(v) => update('forms','labelFontSize',v)} placeholder="13px" />
        <ColorInput label="Label Color"           value={draft.forms.labelColor}       onChange={(v) => update('forms','labelColor',v)} />
      </SectionCard>

      <SectionCard title="Tables" icon={Table2}>
        <ColorInput label="Header Background"    value={draft.tables.headerBg}    onChange={(v) => update('tables','headerBg',v)} />
        <ColorInput label="Header Text Color"    value={draft.tables.headerText}  onChange={(v) => update('tables','headerText',v)} />
        <ColorInput label="Row Text Color"       value={draft.tables.rowText}     onChange={(v) => update('tables','rowText',v)} />
        <ColorInput label="Alternate Row Color"  value={draft.tables.altRow}      onChange={(v) => update('tables','altRow',v)} />
        <ColorInput label="Border Color"         value={draft.tables.borderColor} onChange={(v) => update('tables','borderColor',v)} />
        <TextInputField label="Font Size"        value={draft.tables.fontSize}    onChange={(v) => update('tables','fontSize',v)} placeholder="14px" />
      </SectionCard>

      <SectionCard title="Cards" icon={LayoutGrid}>
        <ColorInput label="Background Color"     value={draft.cards.background}   onChange={(v) => update('cards','background',v)} />
        <ColorInput label="Header Color"         value={draft.cards.header}       onChange={(v) => update('cards','header',v)} />
        <ColorInput label="Border Color"         value={draft.cards.border}       onChange={(v) => update('cards','border',v)} />
        <TextInputField label="Border Radius"    value={draft.cards.borderRadius} onChange={(v) => update('cards','borderRadius',v)} placeholder="12px" />
        <SelectField label="Shadow"              value={draft.cards.shadow}       onChange={(v) => update('cards','shadow', v as any)} options={shadowOptions} />
      </SectionCard>
    </div>
  );
}
