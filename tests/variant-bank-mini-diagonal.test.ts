import { describe } from "vitest";
import { checkVariantBank } from "./support/variant-bank-check";

describe("variant bank (mini and diagonal)", () => {
  checkVariantBank("mini");
  checkVariantBank("diagonal");
});
