// Prints the coverage totals of the last `pnpm test:coverage` run as a Markdown table,
// meant for the GitHub job summary.
import { readFileSync } from "node:fs";

let total;
try {
  total = JSON.parse(readFileSync("coverage/coverage-summary.json", "utf8")).total;
} catch {
  console.log("### Coverage\n\nNo coverage report was produced.");
  process.exit(0);
}
const rows = ["statements", "branches", "functions", "lines"].map(
  (kind) => `| ${kind} | ${total[kind].pct}% | ${total[kind].covered} / ${total[kind].total} |`,
);
console.log(
  ["### Coverage", "", "| | Covered | Count |", "| --- | --- | --- |", ...rows].join("\n"),
);
