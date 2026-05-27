const fs = require("fs");
const path = require("path");

function summarize(results, meta = {}) {
  const passed = results.filter((r) => r.status === "passed").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const total = results.length;
  const evaluated = Math.max(total - skipped, 1);

  return {
    ...meta,
    total,
    passed,
    failed,
    skipped,
    passRate: passed / evaluated,
    results
  };
}

function format(summary) {
  const lines = [];
  lines.push("NL Search Eval Report");
  lines.push("=====================");
  lines.push(
    `Mode: ${summary.mode} | Cases: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed} | Skipped: ${summary.skipped} | Pass rate: ${(summary.passRate * 100).toFixed(1)}%`
  );

  const byScenario = {};
  summary.results.forEach((result) => {
    const scenario = result.scenario || "unknown";
    byScenario[scenario] = byScenario[scenario] || { passed: 0, total: 0 };
    byScenario[scenario].total += 1;
    if (result.status === "passed") byScenario[scenario].passed += 1;
  });

  lines.push("");
  Object.entries(byScenario).forEach(([scenario, counts]) => {
    lines.push(`${scenario}: ${counts.passed}/${counts.total}`);
  });

  const failures = summary.results.filter((r) => r.status === "failed");
  if (failures.length > 0) {
    lines.push("");
    lines.push("Failures:");
    failures.forEach((failure) => {
      lines.push(`- ${failure.id}: ${failure.failures.join("; ")}`);
    });
  }

  return lines.join("\n");
}

function write(summary, outputPath) {
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
}

module.exports = {
  summarize,
  format,
  write
};
