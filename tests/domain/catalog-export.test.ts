import { describe, expect, it } from "vitest";

import {
  serializeProductExportRows,
  type ProductExportRow,
} from "@/modules/catalog/catalog-export";

function row(overrides: Partial<ProductExportRow> = {}): ProductExportRow {
  return {
    title: "Booster Box",
    slug: "booster-box",
    gameSlug: "pokemon",
    setCode: "SV",
    type: "SEALED",
    productStatus: "ACTIVE",
    description: "Hộp 36 gói",
    sku: "PKM-SV-BOX",
    variantStatus: "ACTIVE",
    language: "vi",
    condition: null,
    edition: null,
    finish: null,
    priceVnd: 2500000,
    weightGram: 900,
    onHand: 5,
    reserved: 2,
    available: 3,
    reorderPoint: 1,
    ...overrides,
  };
}

describe("catalog CSV export", () => {
  it("uses deterministic columns and RFC 4180 escaping", () => {
    const csv = serializeProductExportRows([
      row({ title: 'Box, "Special"', description: "Dòng 1\nDòng 2" }),
    ]);

    expect(csv).toContain('"title","slug","gameSlug"');
    expect(csv).toContain('"Box, ""Special"""');
    expect(csv).toContain('"Dòng 1\nDòng 2"');
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it.each(["=1+1", "+SUM(A1:A2)", "-10+20", "@cmd", "\tformula", "\rformula"])(
    "neutralizes spreadsheet formula input %j",
    (dangerousValue) => {
      const csv = serializeProductExportRows([row({ title: dangerousValue })]);

      expect(csv).toContain(`"'${dangerousValue}"`);
      expect(csv).not.toContain(`\r\n"${dangerousValue}"`);
    },
  );
});
