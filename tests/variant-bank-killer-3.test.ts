import { describe } from "vitest";
import { checkVariantBank } from "./support/variant-bank-check";

// The Killer bank is the slowest to check: it is split across three files run in parallel.
describe("variant bank (Killer, part 3 of 3)", () => checkVariantBank("killer", 3, 3));
