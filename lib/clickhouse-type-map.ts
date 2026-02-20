export type PerspectiveType = "float" | "integer" | "string" | "datetime" | "boolean";

function stripWrappers(chType: string): string {
  let t = chType.trim();
  for (;;) {
    const nullable = t.match(/^Nullable\((.+)\)$/);
    if (nullable) {
      t = nullable[1];
      continue;
    }
    const lowCard = t.match(/^LowCardinality\((.+)\)$/);
    if (lowCard) {
      t = lowCard[1];
      continue;
    }
    break;
  }
  return t;
}

export function clickhouseToPerspective(chType: string): PerspectiveType {
  const t = stripWrappers(chType);

  if (/^U?Int\d+$/i.test(t)) return "integer";
  if (/^Float\d+$/i.test(t) || /^Decimal/i.test(t)) return "float";
  if (/^(String|FixedString|Enum)/i.test(t)) return "string";
  if (/^(Date|DateTime)/i.test(t)) return "datetime";
  if (/^Bool$/i.test(t)) return "boolean";

  return "string";
}
