// Shared Address Line 1 → Line 1..4 auto-flow helpers used by both the
// domestic AddressStep and the international Company Details step.

export function splitAddressIntoLines(raw: string): [string, string, string, string] {
  const text = (raw || '').replace(/\s+/g, ' ').trimStart();
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > 0 && chunks.length < 4) {
    if (rest.length <= 40) {
      chunks.push(rest);
      rest = '';
      break;
    }
    let cut = 40;
    const window = rest.slice(0, 40);
    const lastSpace = window.lastIndexOf(' ');
    if (lastSpace > 0 && lastSpace >= 20) cut = lastSpace;
    chunks.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  return [chunks[0] || '', chunks[1] || '', chunks[2] || '', chunks[3] || ''];
}
