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
  } else if (head === "vendor.reference_no") {
    value = String(ctx.vendor?.id || "").slice(0, 8).toUpperCase();
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

  const isInternational = (vendor as any).vendor_type === 'international';

  if (!isInternational) {
    if (!vendor.registered_state || !resolveRegion(vendor.registered_state)) {
      throw new Error(
        `Vendor's Registered State "${vendor.registered_state || "(empty)"}" is not mapped to an SAP region code for IN.`,
      );
    }
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

  // Load template — DB-first, then fall back to the built-in default so
  // self-hosted deployments without a seeded `sap_payload_templates` row
  // still produce a valid SAP payload.
  let template: any = null;
  try {
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
  } catch (e) {
    console.warn("sap_payload_templates lookup failed, using built-in default:", (e as any)?.message);
  }
  if (!template) {
    const { DEFAULT_SAP_PAYLOAD_TEMPLATE } = await import("./sapDefaultTemplate");
    template = JSON.parse(JSON.stringify(DEFAULT_SAP_PAYLOAD_TEMPLATE));
  }

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
    row.idtype = "SOLMN1";
    row.idnum = String((vendor as any).id || "").slice(0, 8).toUpperCase();
    row.idtype2 = "ZMSMEN";
    row.idnum2 = (vendor as any).msme_number ? String((vendor as any).msme_number).slice(0, 20) : "";

    // Always emit new international bank keys (empty for domestic, populated for intl below)
    if (row.swift_code === undefined) row.swift_code = "";
    if (row.iban === undefined) row.iban = "";
    if (row.iban2 === undefined) row.iban2 = "";

    if (isInternational) {
      const intl = ((vendor as any).international_data || {}) as any;
      const company = intl.company || {};
      const bank = intl.bank || {};
      const trunc = (v: any, n: number) => (v == null ? "" : String(v).slice(0, n));

      const intlOverrides: Record<string, any> = {
        name1: trunc(company.companyName, 40),
        name2: "",
        name3: "",
        sterm1: trunc(company.companyName, 20),
        sterm2: "",
        street: trunc(company.companyAddress, 60),
        house_no: "",
        str_suppl1: trunc(company.companyAddress, 40),
        str_suppl2: "",
        str_suppl3: "",
        location: "",
        district: "",
        city: "",
        postl_cod1: trunc(company.pincode, 10),
        country: trunc(company.country, 3),
        region: trunc(company.region, 3),
        langu: "EN",
        tel_number: trunc(company.contact2, 30),
        mob_number: trunc(company.contact1, 30),
        smtp_addr: trunc(company.email1, 241),
        taxtype: "IN5",
        taxnumxl: "",
        j_1ipanno: "",
        partn_grp: "ZIMP",
        msme: "",
        idnum2: "",
        // Bank
        bank_ctry: trunc(bank.bankCountry || company.country, 3),
        bank_key: trunc(bank.swiftCode || bank.ibanNumber || "", 15),
        bank_acct: trunc(bank.accountNumber, 18),
        accountholder: trunc(bank.companyName, 60),
        bankaccountname: trunc(bank.bankName, 60),
        swift_code: trunc(bank.swiftCode, 11),
        iban: trunc(bank.ibanNumber, 34),
        iban2: "",
      };

      Object.assign(row, intlOverrides);

      if (Array.isArray(row.vendors) && row.vendors[0] && typeof row.vendors[0] === "object") {
        // Apply applicable subset to nested vendors[0]
        const vendorBlockKeys = [
          "name1","name2","name3","sterm1","sterm2","street","house_no",
          "str_suppl1","str_suppl2","str_suppl3","location","district","city",
          "postl_cod1","country","region","langu","tel_number","mob_number",
          "smtp_addr","taxtype","taxnumxl","j_1ipanno","msme",
        ];
        for (const k of vendorBlockKeys) {
          if (k in intlOverrides) row.vendors[0][k] = intlOverrides[k];
        }
        row.vendors[0].partn_grp = "ZIMP";
      }
    }
  }

  return { payload: [row], uploadsCount: uploads.length, skipped };
}
