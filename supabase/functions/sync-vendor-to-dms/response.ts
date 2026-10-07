type SapRow = Record<string, unknown>;

const record = (value: unknown): value is SapRow =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const messageOf = (value: unknown): string => {
  if (typeof value === 'string') return value.trim().slice(0, 300);
  if (!record(value)) return '';
  for (const key of ['MSG', 'LONG_MSG', 'error', 'message']) {
    if (typeof value[key] === 'string' && value[key].trim()) return value[key].trim().slice(0, 300);
  }
  return '';
};

/** HTTP acceptance is not proof of SAP document creation. */
export function assessDmsResponse(text: string, httpStatus: number) {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { parsed = text.trim(); }
  const envelope = record(parsed) && 'sapResponse' in parsed ? parsed : null;
  let inner: unknown = envelope ? envelope.sapResponse : parsed;
  if (typeof inner === 'string') {
    try { inner = JSON.parse(inner); } catch { /* SAP may return a plain error string. */ }
  }
  const rows: SapRow[] = Array.isArray(inner)
    ? inner.filter(record) : record(inner) ? [inner] : [];
  const status = typeof envelope?.sapStatus === 'number' ? envelope.sapStatus : httpStatus;
  const transportOk = httpStatus >= 200 && httpStatus < 300
    && status >= 200 && status < 300 && envelope?.ok !== false;
  const validRows = Array.isArray(inner) ? rows.length === inner.length : record(inner);
  const confirmed = transportOk && validRows && rows.length > 0
    && rows.every(row => row.MSGTYP === 'S');
  const failure = rows.find(row => row.MSGTYP !== 'S');
  const message = confirmed ? messageOf(rows[0]) :
    messageOf(failure) || messageOf(inner) || messageOf(envelope)
    || (!transportOk ? `DMS upload failed (HTTP ${status}).`
      : 'SAP did not return a document creation confirmation. DMS sync remains pending.');
  return { confirmed, transportOk, rows, status, message };
}