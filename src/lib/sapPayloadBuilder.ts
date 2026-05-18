import { supabase } from "@/integrations/supabase/client";

// Indian state -> SAP T005S numeric region code for country IN.
const stateToRegion: Record<string, string> = {
  "andhra pradesh": "01", "arunachal pradesh": "02", "assam": "03", "bihar": "04",
  "goa": "05", "gujarat": "06", "haryana": "07", "himachal pradesh": "08",
  "jammu and kashmir": "09", "jammu & kashmir": "09", "j&k": "09",
  "karnataka": "10", "kerala": "11", "madhya pradesh": "12", "maharashtra": "13",
  "manipur": "14", "meghalaya": "15", "mizoram": "16", "nagaland": "17",
  "odisha": "18", "orissa": "18", "punjab": "19", "rajasthan": "20",
  "sikkim": "21", "tamil nadu": "22", "tripura": "23", "uttar pradesh": "24",
  "west bengal": "25", "andaman and nicobar islands": "26", "andaman & nicobar": "26",
  "chandigarh": "27", "dadra and nagar haveli": "28", "dadra & nagar haveli": "28",
  "dadra and nagar haveli and daman and diu": "28", "daman and diu": "29",
  "daman & diu": "29", "delhi": "30", "nct of delhi": "30", "lakshadweep": "31",
  "puducherry": "32", "pondicherry": "32", "chhattisgarh": "33", "chattisgarh": "33",
  "jharkhand": "34", "uttarakhand": "35", "uttaranchal": "35", "telangana": "36",
  "ladakh": "37",
};

export function resolveRegion(state: string | null | undefined): string {
  if (!state) return "";
  const key = String(state).trim().toLowerCase().replace(/\s+/g, " ");
  return stateToRegion[key] || "";
}

const DOC_NAME_MAP: Record<string, string> = {
  pan_card: "pan", gst_certificate: "gst", gst_self_declaration: "gst_self_declaration",
  msme_certificate: "msme", cancelled_cheque: "bank_cheque1", cancelled_cheque_2: "bank_cheque2",
  financial_docs: "financials", dealership_certificate: "dealership", iec_certificate: "iec",
  swift_iban_proof: "swift_iban", incorporation_certificate: "incorporation", other: "other",
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)) as any);
  }
  return btoa(binary);
}

type ResolverCtx = {
  vendor: Record<string, any>;
  override: Record<string, any>;
  classify: Record<string, any>;
  uploads: any[];
  isMsme: boolean;
};

function getPath(obj: any, path: string): any {
  if (!obj) return undefined;
  return path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

function applyFilter(value: any, filter: string): any {
  const [name, arg] = filter.split(":");
  switch (name) {
    case "trunc": {
      const n = parseInt(arg || "0", 10);
      if (value == null) return "";
      return String(value).slice(0, n);
    }
    case "upper": return value == null ? "" : String(value).toUpperCase();
    case "lower": return value == null ? "" : String(value).toLowerCase();
    case "default":
      return (value === undefined || value === null || value === "") ? (arg ?? "") : value;
    default: return value;
  }
}

function resolveExpr(expr: string, ctx: ResolverCtx): any {
  const parts = expr.split("|").map((s) => s.trim());
  const head = parts[0];
  const filters = parts.slice(1);

  let value: any;

  const fnMatch = head.match(/^(\w+)\((.*)\)$/);
  if (fnMatch) {
    const fn = fnMatch[1];
    const innerPath = fnMatch[2].trim();
    const inner = innerPath ? getPath(ctx, innerPath) : undefined;
    if (fn === "region") value = resolveRegion(inner);
    else value = "";
  } else if (head === "uploads") {
    value = ctx.uploads;
  } else if (head === "vendor.trade_name_first_word") {
    const t = ctx.vendor?.trade_name || "";
    value = String(t).split(" ")[0] || "";
  } else if (head === "vendor.registered_address_line3_or_2") {
    value = ctx.vendor?.registered_address_line3 || ctx.vendor?.registered_address_line2 || "";
  } else {
    value = getPath(ctx, head);
  }

  for (const f of filters) {
    const [name] = f.split(":");
    if (name === "msme_flag") {
      if (value === undefined || value === null || value === "") {
        value = ctx.isMsme ? "MIC" : "";
      }
    } else if (name === "msme_idtype") {
      if (value === undefined || value === null || value === "") {
        value = ctx.isMsme ? "ZMSMEN" : "";
      }
    } else if (name === "msme_idnum") {
      if (value === undefined || value === null || value === "") {
        value = ctx.isMsme ? String(ctx.vendor?.msme_number || "").slice(0, 20) : "";
      }
    } else {
      value = applyFilter(value, f);
    }
  }

  if (value === undefined || value === null) value = "";
  return value;
}

function resolveTemplate(node: any, ctx: ResolverCtx): any {
  if (node == null) return node;
  if (typeof node === "string") {
    const whole = node.match(/^\s*\{\{\s*(.+?)\s*\}\}\s*$/);
    if (whole) return resolveExpr(whole[1], ctx);
    return node.replace(/\{\{\s*(.+?)\s*\}\}/g, (_m, expr) => {
      const v = resolveExpr(expr, ctx);
      return v == null ? "" : String(v);
    });
  }
  if (Array.isArray(node)) return node.map((n) => resolveTemplate(n, ctx));
  if (typeof node === "object") {
    const out: Record<string, any> = {};
    for (const k of Object.keys(node)) out[k] = resolveTemplate(node[k], ctx);
    return out;
  }
  return node;
}

async function buildUploads(vendorId: string): Promise<{ uploads: any[]; skipped: string[] }> {
  // SAP document upload is intentionally disabled from this API payload because
  // base64 documents make the request too large for the middleware/SAP route.
  // Keep the key in the final payload as UPLOAD: [] so SAP receives the expected shape.
  return { uploads: [], skipped: [] };
}

export type BuildResult = {
  payload: any[];
  uploadsCount: number;
  skipped: string[];
};

export async function buildSapPayload(
  vendorId: string,
  overrides: Record<string, any> = {},
): Promise<BuildResult> {
  const { data: vendor, error: vErr } = await supabase
    .from("vendors").select("*").eq("id", vendorId).single();
  if (vErr || !vendor) throw new Error(`Vendor not found: ${vErr?.message || ""}`);

  if (!vendor.registered_state || !resolveRegion(vendor.registered_state)) {
    throw new Error(
      `Vendor's Registered State "${vendor.registered_state || "(empty)"}" is not mapped to an SAP region code for IN.`,
    );
  }

  // Merge tenant defaults
  const mergedOverrides: Record<string, any> = { ...(overrides || {}) };
  if (vendor.tenant_id) {
    const { data: defRow } = await supabase
      .from("sap_default_fields").select("*").eq("tenant_id", vendor.tenant_id).maybeSingle();
    if (defRow) {
      for (const k of ["partn_cat","partn_grp","title","taxtype","bukrs","akont","zuawa","fdgrv","vkorg","waers","kalsk","cdi","webre","lebre","ven_class"]) {
        if (mergedOverrides[k] === undefined || mergedOverrides[k] === null || mergedOverrides[k] === "") {
          if ((defRow as any)[k] !== undefined && (defRow as any)[k] !== null) mergedOverrides[k] = (defRow as any)[k];
        }
      }
    }
  }

  const productCats = Array.isArray((vendor as any).product_categories) ? (vendor as any).product_categories : [];
  const ovClassify = (overrides && overrides.classify) || {};
  const toArr = (v: any): string[] =>
    Array.isArray(v) ? v.filter(Boolean).map(String) : (v ? [String(v)] : []);
  const classifyArrays = {
    MGV: toArr(ovClassify.MGV).length ? toArr(ovClassify.MGV)
      : (toArr((vendor as any).material_group_vendors).length ? toArr((vendor as any).material_group_vendors)
      : (toArr((vendor as any).material_group_vendor).length ? toArr((vendor as any).material_group_vendor)
      : productCats.map(String))),
    CATV: toArr(ovClassify.CATV).length ? toArr(ovClassify.CATV)
      : (toArr((vendor as any).vendor_categories).length ? toArr((vendor as any).vendor_categories)
      : toArr((vendor as any).vendor_category || (vendor as any).organization_type || (vendor as any).entity_type)),
    LOCV: toArr(ovClassify.LOCV).length ? toArr(ovClassify.LOCV)
      : (toArr((vendor as any).vendor_locations).length ? toArr((vendor as any).vendor_locations)
      : toArr((vendor as any).vendor_location || vendor.registered_state)),
    IDS: toArr(ovClassify.IDS).length ? toArr(ovClassify.IDS)
      : (toArr((vendor as any).identification_sources).length ? toArr((vendor as any).identification_sources)
      : toArr((vendor as any).identification_source)),
  };
  const classifyCtx = {
    MGV: classifyArrays.MGV[0] || "",
    CATV: classifyArrays.CATV[0] || "",
    LOCV: classifyArrays.LOCV[0] || "",
    IDS: classifyArrays.IDS[0] || "",
  };

  const isMsme = !!(vendor as any).msme_number;

  // Load template
  let template: any = null;
  if (vendor.tenant_id) {
    const { data: tplRow } = await supabase
      .from("sap_payload_templates").select("template")
      .eq("tenant_id", vendor.tenant_id).eq("is_active", true).maybeSingle();
    if ((tplRow as any)?.template) template = (tplRow as any).template;
  }
  if (!template) {
    const { data: tplRow } = await supabase
      .from("sap_payload_templates").select("template")
      .is("tenant_id", null).eq("is_active", true).maybeSingle();
    if ((tplRow as any)?.template) template = (tplRow as any).template;
  }
  if (!template) throw new Error("No SAP payload template configured.");

  const { uploads, skipped } = await buildUploads(vendorId);

  const ctx: ResolverCtx = {
    vendor: vendor as any,
    override: mergedOverrides,
    classify: classifyCtx,
    uploads,
    isMsme,
  };

  const row = resolveTemplate(template, ctx);

  // Post-process CLASSIFY block — emit one object per selected value
  const expand = (arr: string[], key: string) =>
    (arr.filter(Boolean).length ? arr.filter(Boolean) : [""]).map(v => ({ [key]: v }));
  if (row && typeof row === "object") {
    row.CLASSIFY = row.CLASSIFY && typeof row.CLASSIFY === "object" ? row.CLASSIFY : {};
    row.CLASSIFY.MAT_GRP_VENDOR = expand(classifyArrays.MGV, "MGV");
    row.CLASSIFY.CAT_VENDOR = expand(classifyArrays.CATV, "CATV");
    row.CLASSIFY.LOCATION_VENDOR = expand(classifyArrays.LOCV, "LOCV");
    row.CLASSIFY.IDENTIFICATION_SOURCE = expand(classifyArrays.IDS, "IDS");
    row.UPLOAD = [];
  }

  return { payload: [row], uploadsCount: uploads.length, skipped };
}
