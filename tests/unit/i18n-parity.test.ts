import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * The two locales must carry exactly the same keys. next-intl types the `t()`
 * calls off en.json, so a key missing from es.json is not a type error -- it is
 * a runtime hole that only shows up for Spanish readers.
 */

type Tree = { [k: string]: string | Tree };

function flatten(node: Tree, prefix = ""): string[] {
  return Object.entries(node).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return typeof v === "object" && v !== null
      ? flatten(v as Tree, path)
      : [path];
  });
}

const enKeys = flatten(en as unknown as Tree);
const esKeys = flatten(es as unknown as Tree);

describe("i18n key parity", () => {
  it("has no keys missing from es.json", () => {
    const missing = enKeys.filter((k) => !esKeys.includes(k));
    expect(missing).toEqual([]);
  });

  it("has no keys missing from en.json", () => {
    const extra = esKeys.filter((k) => !enKeys.includes(k));
    expect(extra).toEqual([]);
  });

  it("has no empty translations", () => {
    const empty = [
      ...flattenEntries(en as unknown as Tree),
      ...flattenEntries(es as unknown as Tree),
    ].filter(([, v]) => v.trim().length === 0);
    expect(empty.map(([k]) => k)).toEqual([]);
  });

  it("uses the same ICU placeholders in both locales", () => {
    const enMap = new Map(flattenEntries(en as unknown as Tree));
    const mismatched: string[] = [];
    for (const [key, esValue] of flattenEntries(es as unknown as Tree)) {
      const enValue = enMap.get(key);
      if (enValue === undefined) continue;
      if (placeholders(enValue) !== placeholders(esValue)) mismatched.push(key);
    }
    expect(mismatched).toEqual([]);
  });
});

function flattenEntries(node: Tree, prefix = ""): Array<[string, string]> {
  return Object.entries(node).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return typeof v === "object" && v !== null
      ? flattenEntries(v as Tree, path)
      : ([[path, v as string]] as Array<[string, string]>);
  });
}

/** Sorted, de-duplicated `{name}` placeholders, as a comparable string. */
function placeholders(value: string): string {
  const names = [...value.matchAll(/\{(\w+)/g)].map((m) => m[1]);
  return [...new Set(names)].sort().join(",");
}
