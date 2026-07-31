export type ApprovalStage =
  | 'BUYER'
  | 'SCM_MANAGER'
  | 'SCM_HEAD'
  | 'FINANCE_1'
  | 'FINANCE_2'
  | 'CEO_OFFICE'
  | 'SAP_TEAM';

/**
 * Display label for a level within a stage.
 * SCM CO stage uses SCM CO1, SCM CO2, … per business rebrand.
 * All other stages keep the generic L{n} label.
 */
export function formatStageLevel(stage: ApprovalStage | string, n: number): string {
  if (stage === 'SCM_MANAGER') return `SCM CO${n}`;
  if (stage === 'SCM_HEAD') return 'SCM Head';
  if (stage === 'BUYER') return 'Buyer';
  if (stage === 'FINANCE_1') return 'Finance 1';
  if (stage === 'FINANCE_2') return 'Finance 2';
  if (stage === 'CEO_OFFICE') return 'CEO Office';
  if (stage === 'SAP_TEAM') return 'SAP Team';
  return `L${n}`;
}

/**
 * Display label for the Approval Comments History dialog.
 * SCM CO stage is always shown as plain "SCM CO" without the level number.
 */
export function formatStageLevelHistory(stage: ApprovalStage | string, n: number): string {
  if (stage === 'SCM_MANAGER') return 'SCM CO';
  if (stage === 'SCM_HEAD') return 'SCM Head';
  if (stage === 'BUYER') return 'Buyer';
  if (stage === 'FINANCE_1') return 'Finance 1';
  if (stage === 'FINANCE_2') return 'Finance 2';
  if (stage === 'CEO_OFFICE') return 'CEO Office';
  if (stage === 'SAP_TEAM') return 'SAP Team';
  return `L${n}`;
}

/** Parse a stored levelName like "L2 · ..." / "Level 2 · ..." / "SCM CO2 · ..." → 2 */
export function parseLevelOrdinal(levelName: string | null | undefined): number | null {
  if (!levelName) return null;
  const m =
    levelName.match(/^\s*SCM\s*CO\s*(\d+)/i) ||
    levelName.match(/^\s*Level\s+(\d+)/i) ||
    levelName.match(/^\s*L\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}
