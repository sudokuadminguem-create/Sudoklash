import { describe, it } from "vitest";
import { checkBankBatch, variantBankBatches } from "./support/variant-bank-check";

// The Killer bank is the slowest to check: it is split across three files run in parallel.
describe("variant bank (Killer, part 1 of 3)", () => {
  for (const { name, entries } of variantBankBatches("killer", 1, 3))
    it(name, () => checkBankBatch("killer", entries));
});
