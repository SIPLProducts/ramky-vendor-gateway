// Public IFSC lookup using Razorpay's free, CORS-enabled endpoint.
// Docs: https://razorpay.com/docs/banking/ifsc-codes/

export interface IfscDetails {
  bank: string;
  branch: string;
  address: string;
  city: string;
  state: string;
  ifsc: string;
}

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const cache = new Map<string, IfscDetails | null>();

export function isValidIfsc(ifsc: string | undefined | null): boolean {
  if (!ifsc) return false;
  return IFSC_REGEX.test(ifsc.toUpperCase().trim());
}

export async function lookupIfsc(ifscRaw: string): Promise<IfscDetails | null> {
  const ifsc = (ifscRaw || "").toUpperCase().trim();
  if (!isValidIfsc(ifsc)) return null;
  if (cache.has(ifsc)) return cache.get(ifsc)!;

  try {
    const resp = await fetch(`https://ifsc.razorpay.com/${ifsc}`);
    if (!resp.ok) {
      cache.set(ifsc, null);
      return null;
    }
    const data = await resp.json();
    const result: IfscDetails = {
      bank: data.BANK || "",
      branch: data.BRANCH || "",
      address: data.ADDRESS || "",
      city: data.CITY || "",
      state: data.STATE || "",
      ifsc: data.IFSC || ifsc,
    };
    cache.set(ifsc, result);
    return result;
  } catch (e) {
    console.warn("[ifscLookup] failed", e);
    cache.set(ifsc, null);
    return null;
  }
}
