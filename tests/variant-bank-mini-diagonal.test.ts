import { describe, it } from "vitest";
import { checkBankBatch, variantBankBatches } from "./support/variant-bank-check";

describe("variant bank (mini and diagonal)", () => {
  for (const id of ["mini", "diagonal"] as const)
    for (const { name, entries } of variantBankBatches(id))
      it(name, () => checkBankBatch(id, entries));
});
