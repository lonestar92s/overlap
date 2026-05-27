const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const { scoreExpectations } = require("./assertions");
const searchRoute = require("../../../src/routes/search");

async function runParseCase(testCase) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      id: testCase.id,
      scenario: testCase.scenario,
      status: "skipped",
      mode: "parse",
      failures: [],
      skipReason: "OPENAI_API_KEY not configured"
    };
  }

  const startedAt = Date.now();
  try {
    const parsed = await searchRoute.parseNaturalLanguage(
      testCase.input.query,
      testCase.input.conversationHistory || []
    );

    const score = scoreExpectations(
      {
        parsed,
        success: parsed.errorMessage ? false : true,
        isMultiQuery: parsed.isMultiQuery
      },
      testCase.expect
    );

    return {
      id: testCase.id,
      scenario: testCase.scenario,
      status: score.passed ? "passed" : "failed",
      mode: "parse",
      failures: score.failures,
      durationMs: Date.now() - startedAt
    };
  } catch (error) {
    return {
      id: testCase.id,
      scenario: testCase.scenario,
      status: "failed",
      mode: "parse",
      failures: [`parse threw: ${error.message}`],
      durationMs: Date.now() - startedAt
    };
  }
}

module.exports = {
  runParseCase
};
