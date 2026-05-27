#!/usr/bin/env node
const path = require("path");
const { loadCases } = require("./lib/loadCases");
const { runParseCase } = require("./lib/parseRunner");
const { runApiCase, cleanupApiRunner } = require("./lib/apiRunner");
const { summarize, format, write } = require("./lib/report");

function parseArgs(argv) {
  const args = {
    mode: "parse",
    casesDir: path.resolve(__dirname, "cases"),
    output: path.resolve(__dirname, "results/latest.json"),
    scenario: null,
    minPassRate: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--mode") args.mode = argv[i + 1] || args.mode;
    if (arg === "--scenario") args.scenario = argv[i + 1] || null;
    if (arg === "--output") args.output = path.resolve(process.cwd(), argv[i + 1]);
    if (arg === "--min-pass-rate") args.minPassRate = Number(argv[i + 1]);
  }

  if (!["parse", "api"].includes(args.mode)) {
    throw new Error(`Unsupported --mode "${args.mode}". Use "parse" or "api".`);
  }

  return args;
}

async function main() {
  const startedAt = Date.now();
  const args = parseArgs(process.argv.slice(2));
  let cases = loadCases(args.casesDir);

  if (args.scenario) {
    cases = cases.filter((testCase) => testCase.scenario === args.scenario);
  }

  if (cases.length === 0) {
    throw new Error("No eval cases found for selection.");
  }

  const runOne = args.mode === "api" ? runApiCase : runParseCase;
  const results = [];

  for (const testCase of cases) {
    if (Array.isArray(testCase.modes) && !testCase.modes.includes(args.mode)) {
      results.push({
        id: testCase.id,
        scenario: testCase.scenario,
        status: "skipped",
        mode: args.mode,
        failures: [],
        skipReason: `Case does not run in ${args.mode} mode`
      });
      continue;
    }
    const result = await runOne(testCase);
    results.push(result);
    const icon = result.status === "passed" ? "PASS" : result.status === "failed" ? "FAIL" : "SKIP";
    console.log(`${icon} ${result.id} (${result.scenario})`);
  }

  if (args.mode === "api") {
    await cleanupApiRunner();
  }

  const summary = summarize(results, {
    mode: args.mode,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt
  });

  write(summary, args.output);
  console.log("");
  console.log(format(summary));
  console.log(`\nSaved JSON report: ${args.output}`);

  if (typeof args.minPassRate === "number" && summary.passRate < args.minPassRate) {
    process.exitCode = 1;
  }
}

main()
  .then(() => {
    process.exit(process.exitCode || 0);
  })
  .catch((error) => {
    console.error(`Eval harness failed: ${error.message}`);
    process.exit(1);
  });
