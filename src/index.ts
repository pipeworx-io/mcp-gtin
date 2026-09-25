interface McpToolDefinition {
  name: string;
  description: string;
  /** Human-facing one-liner (fleet #1967). Optional; consumers fall back to
   *  description. Kept in step with shared/src/types.ts — scripts/lib/
   *  check-inlined-types.mjs reports drift at publish time. */
  summary?: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    anyOf?: Array<{ required: string[] }>;
    oneOf?: Array<{ required: string[] }>;
    allOf?: Array<{ required: string[] }>;
  };
  outputSchema?: Record<string, unknown>;
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Barcode / GTIN validation MCP (EAN-13, UPC-A, EAN-8, GTIN-14).
 *
 * Keyless, offline: mod-10 check-digit validation for GS1 barcodes, plus the
 * GS1 prefix → issuing country/region lookup and normalization to GTIN-14.
 * Pure algorithm — no API, no key. Validates the NUMBER; it does not look up
 * the product (use a product-data pack for that).
 */


// GS1 prefix ranges → issuing organization/country. [start, end, label]
const PREFIX: [number, number, string][] = [
  [0, 19, 'United States & Canada (UPC)'], [30, 39, 'United States (drugs / GS1 US)'],
  [50, 59, 'GS1 US (coupons)'], [60, 139, 'United States & Canada'],
  [200, 299, 'Restricted (in-store / internal use)'],
  [300, 379, 'France & Monaco'], [380, 380, 'Bulgaria'], [383, 383, 'Slovenia'],
  [385, 385, 'Croatia'], [387, 387, 'Bosnia and Herzegovina'], [389, 389, 'Montenegro'],
  [400, 440, 'Germany'], [450, 459, 'Japan'], [460, 469, 'Russia'], [471, 471, 'Taiwan'],
  [474, 474, 'Estonia'], [475, 475, 'Latvia'], [476, 476, 'Azerbaijan'], [477, 477, 'Lithuania'],
  [478, 478, 'Uzbekistan'], [479, 479, 'Sri Lanka'], [480, 480, 'Philippines'], [481, 481, 'Belarus'],
  [482, 482, 'Ukraine'], [484, 484, 'Moldova'], [485, 485, 'Armenia'], [486, 486, 'Georgia'],
  [487, 487, 'Kazakhstan'], [489, 489, 'Hong Kong'], [490, 499, 'Japan'],
  [500, 509, 'United Kingdom'], [520, 521, 'Greece'], [528, 528, 'Lebanon'], [529, 529, 'Cyprus'],
  [530, 530, 'Albania'], [531, 531, 'North Macedonia'], [535, 535, 'Malta'], [539, 539, 'Ireland'],
  [540, 549, 'Belgium & Luxembourg'], [560, 560, 'Portugal'], [569, 569, 'Iceland'],
  [570, 579, 'Denmark'], [590, 590, 'Poland'], [594, 594, 'Romania'], [599, 599, 'Hungary'],
  [600, 601, 'South Africa'], [603, 603, 'Ghana'], [608, 608, 'Bahrain'], [609, 609, 'Mauritius'],
  [611, 611, 'Morocco'], [613, 613, 'Algeria'], [615, 615, 'Nigeria'], [616, 616, 'Kenya'],
  [618, 618, 'Côte d’Ivoire'], [619, 619, 'Tunisia'], [620, 620, 'Tanzania'], [621, 621, 'Syria'],
  [622, 622, 'Egypt'], [624, 624, 'Libya'], [625, 625, 'Jordan'], [626, 626, 'Iran'],
  [627, 627, 'Kuwait'], [628, 628, 'Saudi Arabia'], [629, 629, 'United Arab Emirates'],
  [640, 649, 'Finland'], [690, 699, 'China'], [700, 709, 'Norway'], [729, 729, 'Israel'],
  [730, 739, 'Sweden'], [740, 745, 'Central America'], [746, 746, 'Dominican Republic'],
  [750, 750, 'Mexico'], [754, 755, 'Canada'], [759, 759, 'Venezuela'], [760, 769, 'Switzerland'],
  [770, 771, 'Colombia'], [773, 773, 'Uruguay'], [775, 775, 'Peru'], [777, 777, 'Bolivia'],
  [778, 779, 'Argentina'], [780, 780, 'Chile'], [784, 784, 'Paraguay'], [786, 786, 'Ecuador'],
  [789, 790, 'Brazil'], [800, 839, 'Italy'], [840, 849, 'Spain'], [850, 850, 'Cuba'],
  [858, 858, 'Slovakia'], [859, 859, 'Czechia'], [860, 860, 'Serbia'], [865, 865, 'Mongolia'],
  [867, 867, 'North Korea'], [868, 869, 'Turkey'], [870, 879, 'Netherlands'], [880, 880, 'South Korea'],
  [884, 884, 'Cambodia'], [885, 885, 'Thailand'], [888, 888, 'Singapore'], [890, 890, 'India'],
  [893, 893, 'Vietnam'], [896, 896, 'Pakistan'], [899, 899, 'Indonesia'], [900, 919, 'Austria'],
  [930, 939, 'Australia'], [940, 949, 'New Zealand'], [950, 950, 'GS1 Global Office'],
  [955, 955, 'Malaysia'], [958, 958, 'Macau'], [977, 977, 'Serial publications (ISSN)'],
  [978, 979, 'Books & music (ISBN / ISMN)'], [980, 980, 'Refund receipts'],
  [981, 984, 'GS1 coupons'], [990, 999, 'GS1 coupons'],
];

function gtinCheckDigit(data: string): number {
  let sum = 0;
  for (let i = data.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += (data.charCodeAt(i) - 48) * w;
  return (10 - (sum % 10)) % 10;
}

function prefixRegion(gtin13: string): string {
  const p3 = +gtin13.slice(0, 3);
  const hit = PREFIX.find(([a, b]) => p3 >= a && p3 <= b);
  return hit ? hit[2] : 'Unknown / unassigned';
}

const FORMATS: Record<number, string> = { 8: 'EAN-8 (GTIN-8)', 12: 'UPC-A (GTIN-12)', 13: 'EAN-13 (GTIN-13)', 14: 'GTIN-14' };

const tools: McpToolExport['tools'] = [
  {
    name: 'validate_gtin',
    description:
      'Validate a barcode number — EAN-13, UPC-A (12), EAN-8, or GTIN-14 (keyless, offline). Checks the mod-10 check digit, reports the format, normalizes to GTIN-14, and returns the GS1 prefix + issuing country/region. Spaces/dashes ignored. Validates the number, not the product.',
    inputSchema: { type: 'object', properties: { code: { type: 'string', description: 'A barcode/GTIN, e.g. "0036000291452" or "4006381333931".' } }, required: ['code'] },
  },
  {
    name: 'gtin_check_digit',
    description: 'Compute the mod-10 check digit for GTIN/EAN/UPC data digits (all digits EXCEPT the check digit). Use to generate or repair a barcode.',
    inputSchema: { type: 'object', properties: { data: { type: 'string', description: 'The data digits without the check digit, e.g. "400638133393".' } }, required: ['data'] },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'validate_gtin': {
      const code = reqStr(args, 'code', '"4006381333931"').replace(/[\s-]/g, '');
      if (!/^\d+$/.test(code)) return { input: code, valid: false, reason: 'Contains non-digit characters.' };
      if (![8, 12, 13, 14].includes(code.length)) return { input: code, valid: false, reason: `Length ${code.length} is not a GTIN (expected 8, 12, 13 or 14 digits).` };
      const expect = gtinCheckDigit(code.slice(0, -1));
      const ok = expect === +code.slice(-1);
      const gtin14 = code.padStart(14, '0');
      const gtin13 = gtin14.slice(1); // drop the GTIN-14 indicator digit
      return {
        input: code,
        valid: ok,
        format: FORMATS[code.length],
        check_digit: +code.slice(-1),
        expected_check_digit: expect,
        gtin14,
        gs1_prefix: gtin13.slice(0, 3),
        issuing_region: prefixRegion(gtin13),
        reason: ok ? 'Valid GTIN check digit.' : `Check digit ${code.slice(-1)} is wrong; expected ${expect}.`,
      };
    }
    case 'gtin_check_digit': {
      const data = reqStr(args, 'data', '"400638133393"').replace(/[\s-]/g, '');
      if (!/^\d+$/.test(data)) return { input: data, reason: 'Not a numeric string.' };
      return { data, check_digit: gtinCheckDigit(data), full_gtin: data + gtinCheckDigit(data) };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function reqStr(args: Record<string, unknown>, key: string, ex: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`Required argument "${key}" is missing. Pass a string like ${ex}.`);
  return v;
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
